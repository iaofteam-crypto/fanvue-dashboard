/**
 * Lightweight in-memory audit logging for the Fanvue Ops Dashboard.
 *
 * Records security-relevant actions (auth, data sync, content changes,
 * messages, webhooks, admin settings, rate limits) with IP and user-agent
 * context. FIFO capped at 500 entries. No persistence — resets on cold starts.
 *
 * NOTE: In-memory only — for production with multiple instances, use Vercel KV,
 * Redis, or a structured logging service. This is sufficient for Vercel Hobby
 * (single instance) and local development.
 */

// ─── Types ────────────────────────────────────────────────────────────────

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

export interface AuditEntry {
  id: string;
  action: AuditAction;
  timestamp: string;
  ip: string;
  userAgent: string;
  details?: Record<string, unknown>;
  success: boolean;
}

// ─── In-Memory Store ──────────────────────────────────────────────────────

const MAX_ENTRIES = 500;
const auditStore: AuditEntry[] = [];

// ─── IP Extraction (mirrors rate-limit.ts) ────────────────────────────────

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

// ─── Core Functions ───────────────────────────────────────────────────────

/**
 * Log an audit action to the in-memory store.
 * Extracts IP and User-Agent from the request automatically.
 *
 * @param action - The audit action type (e.g. `'auth.connect'`, `'data.sync'`).
 * @param request - The incoming request (used for IP and User-Agent extraction).
 * @param details - Optional key-value metadata attached to the entry.
 * @param success - Whether the action succeeded (default `true`).
 * @returns The created {@link AuditEntry} (with generated `id` and `timestamp`).
 *
 * @example
 * ```ts
 * import { logAction } from '@/lib/audit-log';
 *
 * logAction('auth.connect', request, { provider: 'fanvue' }, true);
 * logAction('data.sync_error', request, { error: 'timeout' }, false);
 * ```
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

  auditStore.unshift(entry);
  if (auditStore.length > MAX_ENTRIES) {
    auditStore.length = MAX_ENTRIES;
  }

  console.log(
    `[audit] ${entry.action} | success=${entry.success} | ip=${entry.ip} | id=${entry.id} | store_size=${auditStore.length}`,
  );

  return entry;
}

/**
 * Retrieve audit log entries with optional filtering.
 * Results are returned most-recent-first (up to `limit`).
 *
 * @param options - Optional filters: `action` to filter by type, `since` as ISO timestamp,
 *   and `limit` (default 100) to cap results.
 * @returns An array of matching {@link AuditEntry} objects.
 *
 * @example
 * ```ts
 * // All logs, most recent 100
 * const logs = getAuditLogs({ limit: 100 });
 *
 * // Only auth actions since a given timestamp
 * const authLogs = getAuditLogs({ action: 'auth.connect', since: '2024-01-01T00:00:00Z' });
 * ```
 */
export function getAuditLogs(options?: {
  action?: AuditAction;
  limit?: number;
  since?: string;
}): AuditEntry[] {
  let results = auditStore;

  // Filter by action type
  if (options?.action) {
    results = results.filter((entry) => entry.action === options.action);
  }

  // Filter by timestamp (since)
  if (options?.since) {
    const sinceDate = new Date(options.since).getTime();
    if (!isNaN(sinceDate)) {
      results = results.filter(
        (entry) => new Date(entry.timestamp).getTime() > sinceDate,
      );
    }
  }

  // Apply limit (default: 100)
  const limit = options?.limit ?? 100;
  return results.slice(0, limit);
}
