// Backup API — export/import dashboard data
//
// GET /api/backup?mode=summary — store sizes (fast, no serialization)
// GET /api/backup?mode=export&ephemeral=true — full backup download as JSON
// POST /api/backup?action=validate — validate backup JSON body
// POST /api/backup?action=dry-run — simulate restore, return counts
// POST /api/backup?action=restore — validate + restore from backup JSON body

import { NextRequest, NextResponse } from "next/server";
import { verifyOrigin, rateLimitResponse, withRateLimitHeaders, sanitizeErrorMessage } from "@/lib/security";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createBackup,
  validateBackup,
  restoreBackup,
  getStoreSummary,
  formatBytes,
  type BackupSnapshot,
  type RestoreOptions,
} from "@/lib/backup";
import { logAudit, extractAuditActor } from "@/lib/audit-log";

const BACKUP_READ_LIMIT = 30;
const BACKUP_WRITE_LIMIT = 2;
const MAX_BACKUP_SIZE = 50 * 1024 * 1024; // 50MB

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, {
    tier: "user",
    maxRequests: BACKUP_READ_LIMIT,
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, rateLimit.limit);
  }

  try {
    const mode = request.nextUrl.searchParams.get("mode") || "summary";
    const actor = extractAuditActor(request);

    if (mode === "summary") {
      const summary = await getStoreSummary();

      logAudit({
        category: "read",
        severity: "info",
        method: "GET",
        route: "/api/backup",
        action: "Viewed backup summary",
        status: "success",
        actor,
      });

      return withRateLimitHeaders(NextResponse.json({
        summary,
        formattedSize: formatBytes(summary.totalSizeBytes),
        capabilities: {
          export: true,
          import: true,
          restoreTokens: false,
          restorePayments: "webhook-only",
          includeEphemeral: true,
        },
      }), rateLimit);
    }

    if (mode === "export") {
      const includeEphemeral = request.nextUrl.searchParams.get("ephemeral") === "true";
      const snapshot = await createBackup({
        includeEphemeral,
        includePayments: true,
        includeAuditLogs: true,
      });

      logAudit({
        category: "read",
        severity: "info",
        method: "GET",
        route: "/api/backup",
        action: `Exported backup (${formatBytes(snapshot.summary.totalSizeBytes)}, ${includeEphemeral ? "full" : "core"})`,
        status: "success",
        actor,
        metadata: {
          totalSizeBytes: snapshot.summary.totalSizeBytes,
          includeEphemeral: String(includeEphemeral),
          storeCount: String(
            snapshot.summary.syncedData +
            snapshot.summary.discoveries +
            snapshot.summary.auditLogs +
            snapshot.summary.integrationTemplates +
            snapshot.summary.relayTargets +
            snapshot.summary.payments
          ),
        },
      });

      const response = new NextResponse(JSON.stringify(snapshot, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="fanvue-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
      return withRateLimitHeaders(response, rateLimit);
    }

    return NextResponse.json(
      { error: "Invalid mode. Use ?mode=summary or ?mode=export" },
      { status: 400 }
    );
  } catch (err: unknown) {
    logAudit({
      category: "read",
      severity: "error",
      method: "GET",
      route: "/api/backup",
      action: "Backup read failed",
      status: err instanceof Error ? err.message : "Unknown error",
      actor: extractAuditActor(request),
    });
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // CSRF protection via verifyOrigin
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = checkRateLimit(request, {
    tier: "user",
    maxRequests: BACKUP_WRITE_LIMIT,
  });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, rateLimit.limit);
  }

  try {
    const action = request.nextUrl.searchParams.get("action") || "validate";
    const actor = extractAuditActor(request);

    // Read body
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
    }

    if (!bodyText || bodyText.trim().length === 0) {
      return NextResponse.json({ error: "Request body is empty. Provide backup JSON." }, { status: 400 });
    }

    // Size check
    const bodySize = new TextEncoder().encode(bodyText).length;
    if (bodySize > MAX_BACKUP_SIZE) {
      return NextResponse.json(
        { error: `Backup too large: ${formatBytes(bodySize)}. Maximum: ${formatBytes(MAX_BACKUP_SIZE)}.` },
        { status: 413 }
      );
    }

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "Invalid JSON: could not parse backup data" }, { status: 400 });
    }

    // Validate structure
    const validation = validateBackup(data);

    if (action === "validate") {
      const summary = validation.valid
        ? (data as BackupSnapshot).summary
        : undefined;

      logAudit({
        category: "read",
        severity: validation.valid ? "info" : "warn",
        method: "POST",
        route: "/api/backup",
        action: `Validated backup (${validation.valid ? "valid" : "invalid"})`,
        status: validation.valid ? "success" : "validation_failed",
        actor,
        metadata: {
          valid: String(validation.valid),
          errorCount: String(validation.errors.length),
          backupSize: formatBytes(bodySize),
        },
      });

      return withRateLimitHeaders(NextResponse.json({
        valid: validation.valid,
        errors: validation.errors,
        summary,
        backupSize: formatBytes(bodySize),
      }), rateLimit);
    }

    if (action === "restore" || action === "dry-run") {
      if (!validation.valid) {
        logAudit({
          category: "update",
          severity: "error",
          method: "POST",
          route: "/api/backup",
          action: "Restore rejected: validation failed",
          status: `errors: ${validation.errors.length}`,
          actor,
        });
        return NextResponse.json(
          { error: "Backup validation failed. Fix errors before restoring.", errors: validation.errors },
          { status: 400 }
        );
      }

      const restoreOptions: RestoreOptions = {
        dryRun: action === "dry-run",
        restoreSyncedData: request.nextUrl.searchParams.get("syncedData") !== "false",
        restoreAuditLogs: request.nextUrl.searchParams.get("auditLogs") !== "false",
        restoreIntegrations: request.nextUrl.searchParams.get("integrations") !== "false",
        restorePayments: request.nextUrl.searchParams.get("payments") !== "false",
        restoreMonitoring: false,
        restoreTokens: false,
      };

      const result = await restoreBackup(data as BackupSnapshot, restoreOptions);

      logAudit({
        category: action === "dry-run" ? "read" : "update",
        severity: result.success ? "info" : "error",
        method: "POST",
        route: "/api/backup",
        action: `${action === "dry-run" ? "Dry-run restore" : "Restored backup"}`,
        status: result.success ? "success" : `errors: ${result.errors.length}`,
        actor,
        metadata: {
          dryRun: String(action === "dry-run"),
          totalRestored: String(
            result.restored.syncedData +
            result.restored.discoveries +
            result.restored.auditLogs +
            result.restored.integrationTemplates +
            result.restored.relayTargets
          ),
          skipped: String(result.skipped.length),
          errors: String(result.errors.length),
        },
      });

      return withRateLimitHeaders(NextResponse.json({
        success: result.success,
        action,
        restored: result.restored,
        skipped: result.skipped,
        errors: result.errors.length > 0 ? result.errors : undefined,
        backupSize: formatBytes(bodySize),
      }), rateLimit);
    }

    return NextResponse.json(
      { error: "Invalid action. Use ?action=validate, ?action=restore, or ?action=dry-run" },
      { status: 400 }
    );
  } catch (err: unknown) {
    logAudit({
      category: "update",
      severity: "error",
      method: "POST",
      route: "/api/backup",
      action: "Backup operation failed",
      status: err instanceof Error ? err.message : "Unknown error",
      actor: extractAuditActor(request),
    });
    return NextResponse.json({ error: sanitizeErrorMessage(err) }, { status: 500 });
  }
}
