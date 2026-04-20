import { NextRequest, NextResponse } from "next/server";
import { logAudit, extractAuditActor } from "@/lib/audit-log";
import { safeResponse, cspReportGetSchema } from "@/lib/response-schemas";

/**
 * CSP Violation Report Endpoint
 * Receives Content-Security-Policy violation reports from browsers.
 * Stores reports in memory (max 100) for debugging.
 * In production, consider logging to Vercel Logs or external service.
 */

interface CSPViolationReport {
  "csp-report": {
    "document-uri"?: string;
    referrer?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    "disposition"?: string;
    "blocked-uri"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "source-file"?: string;
    "status-code"?: number;
    "script-sample"?: string;
  };
}

const MAX_REPORTS = 100;
const cspReports: CSPViolationReport[] = [];

export async function POST(request: NextRequest) {
  try {
    const report = (await request.json()) as CSPViolationReport;

    if (!report || !report["csp-report"]) {
      return NextResponse.json({ error: "Invalid report" }, { status: 400 });
    }

    const violation = report["csp-report"];

    // Store report (capped)
    cspReports.unshift(report);
    if (cspReports.length > MAX_REPORTS) {
      cspReports.length = MAX_REPORTS;
    }

    // Log violation for server-side debugging
    // In production, send to logging service (Sentry, Datadog, etc.)
    console.warn(
      "[CSP Violation]",
      violation["violated-directive"] ?? "unknown",
      violation["blocked-uri"] ?? "unknown",
      violation["document-uri"] ?? "unknown"
    );

    logAudit({
      category: "security",
      severity: "warn",
      method: "POST",
      route: "/api/csp-report",
      action: `CSP violation: ${violation["violated-directive"] ?? "unknown"}`,
      status: "violation",
      actor: extractAuditActor(request),
      metadata: {
        directive: violation["violated-directive"] ?? "unknown",
        blockedUri: (violation["blocked-uri"] ?? "").slice(0, 200),
        documentUri: (violation["document-uri"] ?? "").slice(0, 200),
      },
    });

    // Always return 204 — browsers ignore the response body
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[CSP Report Error]", message);
    return new NextResponse(null, { status: 204 });
  }
}

export async function GET() {
  // Internal endpoint to inspect stored CSP reports
  return safeResponse(cspReportGetSchema, {
    count: cspReports.length,
    reports: cspReports.map((r) => r["csp-report"]),
  });
}
