/**
 * Zod response schemas for all API endpoints.
 *
 * These schemas define the **contract** between API routes and their consumers.
 * Each route handler validates its response body against the corresponding schema
 * at runtime (dev only by default, configurable via NEXT_PUBLIC_VALIDATE_RESPONSES).
 *
 * Benefits:
 * - Type-safe response inference via `z.infer<typeof schema>`
 * - Runtime catch of response shape regressions during development
 * - Self-documenting API contract
 * - Centralized place to understand every endpoint's response shape
 *
 * Usage:
 *   import { safeResponse, responseSchemas } from "@/lib/response-schemas";
 *   return safeResponse(responseSchemas.chat.post, { message: "Hello" });
 */

import { z } from "zod";
import { NextResponse } from "next/server";

// ─── Shared/Common Response Schemas ────────────────────────────────────────

/** Standard error response */
export const errorResponseSchema = z.object({
  error: z.string().min(1),
});

/** Standard success boolean response */
export const successResponseSchema = z.object({
  success: z.literal(true),
});

/** Paginated response envelope */
export function paginatedEnvelopeSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    total: z.number().int().min(0),
    returned: z.number().int().min(0),
    data: itemSchema.array(),
  });
}

// ─── /api/ ────────────────────────────────────────────────────────────────

export const apiHealthSchema = z.object({
  message: z.string(),
});

// ─── /api/auth/status ─────────────────────────────────────────────────────

export const authStatusSchema = z.union([
  z.object({
    connected: z.literal(true),
    expiresAt: z.string().optional(),
    isExpired: z.boolean().optional(),
    scope: z.string().nullable().optional(),
    source: z.enum(["cookie", "db"]).optional(),
    lastUpdated: z.string().optional(),
  }),
  z.object({
    connected: z.literal(false),
    error: z.string().optional(),
  }),
]);

// ─── /api/auth/disconnect ─────────────────────────────────────────────────

export const authDisconnectSchema = z.object({
  disconnected: z.literal(true),
});

// ─── /api/auth/rotate ─────────────────────────────────────────────────────

export const rotationEventSchema = z.object({
  id: z.string(),
  rotatedAt: z.string(),
  rotatedBy: z.string(),
  status: z.enum(["success", "failed"]),
  reason: z.string(),
  gracePeriodEndsAt: z.string(),
});

export const tokenInfoSchema = z.object({
  expiresAt: z.string(),
  updatedAt: z.string(),
  scope: z.string().nullable().optional(),
  isExpired: z.boolean(),
});

export const authRotateGetSchema = z.object({
  connected: z.boolean(),
  tokenInfo: tokenInfoSchema.nullable(),
  gracePeriodActive: z.boolean(),
  activeGraceCount: z.number().int().min(0),
  rotationHistory: rotationEventSchema.array(),
});

export const authRotatePostSchema = z.object({
  success: z.literal(true),
  rotated: z.literal(true),
  newExpiresAt: z.string(),
  gracePeriodEndsAt: z.string(),
  gracePeriodMinutes: z.number(),
  message: z.string(),
});

// ─── /api/fanvue/refresh-token ────────────────────────────────────────────

export const tokenRefreshSchema = z.object({
  success: z.literal(true),
  expiresIn: z.number().int().positive(),
});

// ─── /api/chat ─────────────────────────────────────────────────────────────

export const chatResponseSchema = z.object({
  message: z.string().min(1),
});

// ─── /api/webhooks/fanvue ─────────────────────────────────────────────────

export const webhookEventTypeSchema = z.enum([
  "message-received",
  "message-read",
  "new-follower",
  "new-subscriber",
  "tip-received",
]);

export const webhookEventSchema = z.object({
  id: z.string(),
  type: webhookEventTypeSchema,
  receivedAt: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export const webhookPostResponseSchema = z.object({
  received: z.literal(true),
  eventId: z.string(),
  type: webhookEventTypeSchema,
});

export const webhookGetResponseSchema = z.object({
  events: webhookEventSchema.array(),
  total: z.number().int().min(0),
  returned: z.number().int().min(0),
});

// ─── /api/sync-data ───────────────────────────────────────────────────────

export const syncDataAllKeysSchema = z.object({
  keys: z.string().array(),
  data: z.record(z.string(), z.unknown()),
  syncedAt: z.string(),
});

export const syncDataSingleKeySchema = z.union([
  z.object({
    key: z.string(),
    status: z.string(),
    data: z.unknown().optional(),
    updatedAt: z.string().optional(),
    error: z.string().optional(),
  }),
  z.object({
    key: z.string(),
    status: z.literal("not_found"),
    data: z.literal(null),
  }),
]);

// ─── /api/sync ─────────────────────────────────────────────────────────────

export const syncPostResponseSchema = z.object({
  success: z.literal(true),
  fanvue: z.union([
    z.object({
      synced: z.string().array(),
      failed: z.string().array(),
    }),
    z.literal("skipped"),
  ]),
  repo: z.string(),
});

export const syncLogEntrySchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  message: z.string().optional(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});

// ─── /api/csp-report ──────────────────────────────────────────────────────

export const cspViolationSchema = z.object({
  "document-uri": z.string().optional(),
  referrer: z.string().optional(),
  "violated-directive": z.string().optional(),
  "effective-directive": z.string().optional(),
  "original-policy": z.string().optional(),
  disposition: z.string().optional(),
  "blocked-uri": z.string().optional(),
  "line-number": z.number().optional(),
  "column-number": z.number().optional(),
  "source-file": z.string().optional(),
  "status-code": z.number().optional(),
  "script-sample": z.string().optional(),
});

export const cspReportGetSchema = z.object({
  count: z.number().int().min(0),
  reports: cspViolationSchema.array(),
});

// ─── /api/audit-logs ──────────────────────────────────────────────────────

export const auditLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  category: z.enum(["auth", "delete", "update", "upload", "webhook", "sync", "security", "ai", "read"]),
  severity: z.enum(["info", "warn", "error", "critical"]),
  method: z.string(),
  route: z.string(),
  action: z.string(),
  resourceId: z.string().optional(),
  status: z.string(),
  actor: z.string(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const auditLogsGetSchema = z.object({
  entries: auditLogEntrySchema.array(),
  total: z.number().int().min(0),
  returned: z.number().int().min(0),
});

export const auditLogStatsSchema = z.object({
  total: z.number().int().min(0),
  byCategory: z.object({
    auth: z.number().int().min(0),
    delete: z.number().int().min(0),
    update: z.number().int().min(0),
    upload: z.number().int().min(0),
    webhook: z.number().int().min(0),
    sync: z.number().int().min(0),
    security: z.number().int().min(0),
    ai: z.number().int().min(0),
    read: z.number().int().min(0),
  }),
  bySeverity: z.object({
    info: z.number().int().min(0),
    warn: z.number().int().min(0),
    error: z.number().int().min(0),
    critical: z.number().int().min(0),
  }),
  byMethod: z.record(z.string(), z.number().int().min(0)),
  oldestEntry: z.string().nullable(),
  newestEntry: z.string().nullable(),
});

export const auditLogsDeleteSchema = z.object({
  success: z.literal(true),
  cleared: z.number().int().min(0),
  message: z.string(),
});

// ─── /api/crons/sync-fanvue ───────────────────────────────────────────────

export const syncFanvueCronSchema = z.object({
  status: z.enum(["completed", "error"]),
  synced: z.string().array(),
  failed: z.string().array().optional(),
  total: z.number().int().min(0),
});

// ─── /api/crons/sync-repo ─────────────────────────────────────────────────

export const syncRepoCronSchema = z.object({
  status: z.enum(["completed", "skipped"]),
  reason: z.string().optional(),
});

// ─── /api/github/[...path] ────────────────────────────────────────────────

export const githubFileSchema = z.object({
  content: z.string(),
  path: z.string(),
});

// ─── Registry: All Response Schemas by Route ───────────────────────────────

/**
 * Central registry mapping routes and methods to their response schemas.
 * Used by `safeResponse()` for runtime validation.
 *
 * Proxy routes (fanvue/[...endpoint], fanvue/upload) are intentionally
 * excluded — their response shapes depend on the upstream Fanvue API.
 */
export const responseSchemas = {
  "GET /api/": apiHealthSchema,
  "POST /api/auth/disconnect": authDisconnectSchema,
  "POST /api/auth/rotate": authRotatePostSchema,
  "GET /api/auth/rotate": authRotateGetSchema,
  "GET /api/auth/status": authStatusSchema,
  "POST /api/fanvue/refresh-token": tokenRefreshSchema,
  "POST /api/chat": chatResponseSchema,
  "POST /api/webhooks/fanvue": webhookPostResponseSchema,
  "GET /api/webhooks/fanvue": webhookGetResponseSchema,
  "GET /api/csp-report": cspReportGetSchema,
  "GET /api/audit-logs": auditLogsGetSchema,
  "GET /api/audit-logs/stats": auditLogStatsSchema,
  "DELETE /api/audit-logs": auditLogsDeleteSchema,
  "POST /api/sync": syncPostResponseSchema,
  "GET /api/crons/sync-fanvue": syncFanvueCronSchema,
  "GET /api/crons/sync-repo": syncRepoCronSchema,
} as const;

// ─── Helper: Type-safe Response Validation ─────────────────────────────────

/**
 * Validate a response body against its schema and return a NextResponse.
 *
 * In development mode, validates the response body and logs warnings for
 * schema mismatches (helps catch regressions during development).
 * In production, skips validation for zero overhead.
 *
 * @param schema - Zod schema to validate against
 * @param data - Response data object
 * @param init - Optional NextResponse init (status, headers)
 * @returns NextResponse.json with the data
 *
 * @example
 * ```ts
 * return safeResponse(tokenRefreshSchema, { success: true, expiresIn: 3600 });
 * ```
 */
export function safeResponse<T extends z.ZodTypeAny>(
  schema: T,
  data: z.input<T>,
  init?: ResponseInit
): NextResponse {
  // Only validate in development
  if (process.env.NODE_ENV === "development") {
    const result = schema.safeParse(data);
    if (!result.success) {
      const issues = result.error.issues.map(
        (i) => `  ${i.path.join(".")}: ${i.message} (input: ${JSON.stringify(i.input ?? "undefined").slice(0, 80)})`
      );
      console.warn(
        `[response-schema] Validation warning:\n${issues.join("\n")}`
      );
    }
  }

  return NextResponse.json(data, init);
}

/**
 * Build a schema key from method and pathname for lookup in responseSchemas.
 *
 * @example
 * buildSchemaKey("GET", "/api/auth/status") // "GET /api/auth/status"
 * buildSchemaKey("GET", "/api/audit-logs/stats") // "GET /api/audit-logs/stats"
 */
export function buildSchemaKey(method: string, pathname: string): string {
  return `${method.toUpperCase()} ${pathname}`;
}

/**
 * Validate a response against the schema registry (convenience wrapper).
 * Looks up the schema by method + pathname, then validates.
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param pathname - Request pathname (e.g. /api/auth/status)
 * @param data - Response data to validate
 * @param init - Optional NextResponse init
 * @returns NextResponse.json with the data
 */
export function validatedResponse(
  method: string,
  pathname: string,
  data: unknown,
  init?: ResponseInit
): NextResponse {
  const key = buildSchemaKey(method, pathname);
  const schema = (responseSchemas as Record<string, z.ZodTypeAny>)[key];

  if (!schema) {
    // No schema registered for this route — return as-is
    return NextResponse.json(data, init);
  }

  if (process.env.NODE_ENV === "development") {
    const result = schema.safeParse(data);
    if (!result.success) {
      const issues = result.error.issues.map(
        (i) => `  ${i.path.join(".")}: ${i.message} (input: ${JSON.stringify(i.input ?? "undefined").slice(0, 80)})`
      );
      console.warn(
        `[response-schema:${key}] Validation warning:\n${issues.join("\n")}`
      );
    }
  }

  return NextResponse.json(data, init);
}
