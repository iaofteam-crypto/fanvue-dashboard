/**
 * Audit Logging — In-memory store with dual API surface.
 *
 * Supports TWO APIs:
 *
 * **Legacy API** (kept for backward compatibility):
 *   - `logAction(action, request, details?, success?)` — simple audit entries
 *   - `getAuditLogs(options?)` — retrieve with basic filtering
 *   - Types: `AuditAction`, `AuditEntry`
 *
 * **Structured API** (used by newer route handlers):
 *   - `logAudit(input)` — structured entry with category/severity/method/route
 *   - `queryAuditLogs(query)` — advanced filtering with category, severity, etc.
 *   - `getAuditStats()` — aggregated statistics
 *   - `clearAuditLogs()` — delete all entries, returns count
 *   - `extractAuditActor(request)` — extract actor identifier from request
 *   - Types: `AuditCategory`, `AuditSeverity`, `StructuredAuditEntry`
 *
 * FIFO capped at 1000 entries. No persistence — resets on cold starts.
 */

import type { NextRequest } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────

/** Legacy action type (kept for backward compatibility) */
export type AuditAction =
  | 'auth.connect'
  | 'auth.disconnect'
  | 'auth.refresh_token'
  | 'data.sync'
  | 'data.sync_error'
  | 'content.create'
  | 'content.update'
  | 'content.delete'
  | 'message.send'
  | 'message.bulk_send'
  | 'webhook.received'
  | 'webhook.invalid_signature'
  | 'admin.settings_update'
  | 'rate_limit.blocked';

/** Legacy audit entry shape (kept for backward compatibility) */
export interface AuditEntry {
  id: string;
  action: AuditAction;
  timestamp: string;
  ip: string;
  userAgent: string;
  details?: Record<string, unknown>;
  success: boolean;
}

/** Structured audit categories */
export type AuditCategory =
  | "auth"
  | "delete"
  | "update"
  | "upload"
  | "webhook"
  | "sync"
  | "security"
  | "ai"
  | "read";

/** Structured audit severity levels */
export type AuditSeverity = "info" | "warn" | "error" | "critical";

/** Input for the structured `logAudit` function */
export interface LogAuditInput {
  category: AuditCategory;
  severity: AuditSeverity;
  method: string;
  route: string;
  action: string;
  status: string;
  actor: string;
  resourceId?: string;
  metadata?: Record<string, string | number | boolean>;
}

/** Structured audit entry as stored and returned by query functions */
export interface StructuredAuditEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  severity: AuditSeverity;
  method: string;
  route: string;
  action: string;
  resourceId?: string;
  status: string;
  actor: string;
  metadata?: Record<string, string | number | boolean>;
}

/** Query parameters for `queryAuditLogs` */
export interface AuditLogQuery {
  category?: AuditCategory;
  severity?: AuditSeverity;
  method?: string;
  routePrefix?: string;
  actor?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

/** Statistics returned by `getAuditStats` */
export interface AuditStats {
  total: number;
  byCategory: Record<AuditCategory, number>;
  bySeverity: Record<AuditSeverity, number>;
  byMethod: Record<string, number>;
  oldestEntry: string | null;
  newestEntry: string | null;
}

// ─── In-Memory Stores ─────────────────────────────────────────────────────

const MAX_ENTRIES = 1000;
const legacyStore: AuditEntry[] = [];
const structuredStore: StructuredAuditEntry[] = [];

// ─── IP / Actor Extraction ───────────────────────────────────────────────

/** Extract client IP from request headers */
function extractIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP.trim();

  return 'unknown';
}

/**
 * Extract a human-readable actor identifier from a request.
 * Tries IP first, then falls back to a generic label.
 *
 * @param request - The incoming request object.
 * @returns A string identifying the actor (IP address or "system").
 */
export function extractAuditActor(request: NextRequest): string {
  return extractIP(request) || "system";
}

// ─── Legacy API ──────────────────────────────────────────────────────────

/**
 * Log an audit action to the in-memory store (legacy API).
 * Extracts IP and User-Agent from the request automatically.
 *
 * @param action - The audit action type.
 * @param request - The incoming request (used for IP and User-Agent extraction).
 * @param details - Optional key-value metadata attached to the entry.
 * @param success - Whether the action succeeded (default `true`).
 * @returns The created {@link AuditEntry}.
 */
export function logAction(
  action: AuditAction,
  request: Request,
  details?: Record<string, unknown>,
  success: boolean = true,
): AuditEntry {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    action,
    timestamp: new Date().toISOString(),
    ip: extractIP(request),
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    details,
    success,
  };

  legacyStore.unshift(entry);
  if (legacyStore.length > MAX_ENTRIES) {
    legacyStore.length = MAX_ENTRIES;
  }

  console.log(
    `[audit] ${entry.action} | success=${entry.success} | ip=${entry.ip} | id=${entry.id} | store_size=${legacyStore.length}`,
  );

  return entry;
}

/**
 * Retrieve legacy audit log entries with optional filtering.
 *
 * @param options - Optional filters.
 * @returns An array of matching {@link AuditEntry} objects.
 */
export function getAuditLogs(options?: {
  action?: AuditAction;
  limit?: number;
  since?: string;
}): AuditEntry[] {
  let results = legacyStore;

  if (options?.action) {
    results = results.filter((entry) => entry.action === options.action);
  }

  if (options?.since) {
    const sinceDate = new Date(options.since).getTime();
    if (!isNaN(sinceDate)) {
      results = results.filter(
        (entry) => new Date(entry.timestamp).getTime() > sinceDate,
      );
    }
  }

  const limit = options?.limit ?? 100;
  return results.slice(0, limit);
}

// ─── Structured API ──────────────────────────────────────────────────────

/**
 * Log a structured audit entry with category, severity, method, route, etc.
 *
 * @param input - The structured audit input.
 * @returns The created {@link StructuredAuditEntry}.
 */
export function logAudit(input: LogAuditInput): StructuredAuditEntry {
  const entry: StructuredAuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    category: input.category,
    severity: input.severity,
    method: input.method,
    route: input.route,
    action: input.action,
    resourceId: input.resourceId,
    status: input.status,
    actor: input.actor,
    metadata: input.metadata,
  };

  structuredStore.unshift(entry);
  if (structuredStore.length > MAX_ENTRIES) {
    structuredStore.length = MAX_ENTRIES;
  }

  console.log(
    `[audit] ${entry.category}/${entry.severity} | ${entry.method} ${entry.route} | ${entry.action} | actor=${entry.actor} | status=${entry.status} | id=${entry.id} | store_size=${structuredStore.length}`,
  );

  return entry;
}

/**
 * Query structured audit log entries with advanced filtering.
 *
 * @param query - Filter parameters.
 * @returns An object with `entries`, `total`, and `returned` counts.
 */
export function queryAuditLogs(query: AuditLogQuery): {
  entries: StructuredAuditEntry[];
  total: number;
  returned: number;
} {
  let results = structuredStore;

  // Filter by category
  if (query.category) {
    results = results.filter((entry) => entry.category === query.category);
  }

  // Filter by severity
  if (query.severity) {
    results = results.filter((entry) => entry.severity === query.severity);
  }

  // Filter by HTTP method
  if (query.method) {
    results = results.filter(
      (entry) => entry.method.toUpperCase() === query.method!.toUpperCase(),
    );
  }

  // Filter by route prefix
  if (query.routePrefix) {
    results = results.filter((entry) =>
      entry.route.startsWith(query.routePrefix!),
    );
  }

  // Filter by actor
  if (query.actor) {
    results = results.filter((entry) => entry.actor === query.actor);
  }

  // Filter by since timestamp
  if (query.since) {
    const sinceDate = new Date(query.since).getTime();
    if (!isNaN(sinceDate)) {
      results = results.filter(
        (entry) => new Date(entry.timestamp).getTime() >= sinceDate,
      );
    }
  }

  // Filter by until timestamp
  if (query.until) {
    const untilDate = new Date(query.until).getTime();
    if (!isNaN(untilDate)) {
      results = results.filter(
        (entry) => new Date(entry.timestamp).getTime() <= untilDate,
      );
    }
  }

  const total = results.length;

  // Apply offset
  const offset = query.offset ?? 0;
  if (offset > 0) {
    results = results.slice(offset);
  }

  // Apply limit
  const limit = query.limit ?? 100;
  const entries = results.slice(0, limit);

  return { entries, total, returned: entries.length };
}

/**
 * Get aggregated statistics about the structured audit log.
 *
 * @returns An {@link AuditStats} object with counts by category, severity, method, etc.
 */
export function getAuditStats(): AuditStats {
  const byCategory: Record<AuditCategory, number> = {
    auth: 0,
    delete: 0,
    update: 0,
    upload: 0,
    webhook: 0,
    sync: 0,
    security: 0,
    ai: 0,
    read: 0,
  };

  const bySeverity: Record<AuditSeverity, number> = {
    info: 0,
    warn: 0,
    error: 0,
    critical: 0,
  };

  const byMethod: Record<string, number> = {};

  let oldestEntry: string | null = null;
  let newestEntry: string | null = null;

  for (const entry of structuredStore) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;
    byMethod[entry.method] = (byMethod[entry.method] ?? 0) + 1;

    // Track oldest (store is newest-first, so oldest is at the end)
    const ts = entry.timestamp;
    if (!newestEntry || ts > newestEntry) newestEntry = ts;
    if (!oldestEntry || ts < oldestEntry) oldestEntry = ts;
  }

  return {
    total: structuredStore.length,
    byCategory,
    bySeverity,
    byMethod,
    oldestEntry,
    newestEntry,
  };
}

/**
 * Clear all structured audit log entries.
 *
 * @returns The number of entries that were cleared.
 */
export function clearAuditLogs(): number {
  const count = structuredStore.length;
  structuredStore.length = 0;
  console.log(`[audit] Cleared ${count} structured audit log entries`);
  return count;
}
