/**
 * Unit tests for src/lib/response-schemas.ts
 * Tests Zod response schemas and safeResponse/validatedResponse helpers.
 */

import { describe, it, expect } from "vitest";

const {
  apiHealthSchema,
  authStatusSchema,
  authDisconnectSchema,
  tokenRefreshSchema,
  chatResponseSchema,
  webhookPostResponseSchema,
  webhookGetResponseSchema,
  syncDataAllKeysSchema,
  syncDataSingleKeySchema,
  syncPostResponseSchema,
  cspReportGetSchema,
  auditLogsGetSchema,
  auditLogStatsSchema,
  auditLogsDeleteSchema,
  syncFanvueCronSchema,
  syncRepoCronSchema,
  githubFileSchema,
  errorResponseSchema,
  safeResponse,
  buildSchemaKey,
} = await import("@/lib/response-schemas");

// ─── Schema Validation Tests ─────────────────────────────────────────────

describe("apiHealthSchema", () => {
  it("accepts valid health response", () => {
    expect(apiHealthSchema.safeParse({ message: "Hello, world!" }).success).toBe(true);
  });
  it("rejects response without message", () => {
    expect(apiHealthSchema.safeParse({}).success).toBe(false);
  });
});

describe("authStatusSchema", () => {
  it("accepts connected=true with all fields", () => {
    expect(authStatusSchema.safeParse({
      connected: true,
      expiresAt: "2099-01-01T00:00:00Z",
      isExpired: false,
      scope: "read:self",
      source: "cookie",
      lastUpdated: "2026-04-19T00:00:00Z",
    }).success).toBe(true);
  });

  it("accepts connected=false", () => {
    expect(authStatusSchema.safeParse({ connected: false }).success).toBe(true);
  });

  it("accepts connected=false with error", () => {
    expect(authStatusSchema.safeParse({ connected: false, error: "Not found" }).success).toBe(true);
  });

  it("accepts null scope", () => {
    expect(authStatusSchema.safeParse({
      connected: true,
      scope: null,
    }).success).toBe(true);
  });

  it("rejects connected=true as string", () => {
    expect(authStatusSchema.safeParse({ connected: "true" }).success).toBe(false);
  });
});

describe("authDisconnectSchema", () => {
  it("accepts valid disconnect response", () => {
    expect(authDisconnectSchema.safeParse({ disconnected: true }).success).toBe(true);
  });

  it("rejects disconnected=false", () => {
    expect(authDisconnectSchema.safeParse({ disconnected: false }).success).toBe(false);
  });
});

describe("tokenRefreshSchema", () => {
  it("accepts valid refresh response", () => {
    expect(tokenRefreshSchema.safeParse({ success: true, expiresIn: 3600 }).success).toBe(true);
  });

  it("rejects expiresIn=0", () => {
    expect(tokenRefreshSchema.safeParse({ success: true, expiresIn: 0 }).success).toBe(false);
  });

  it("rejects negative expiresIn", () => {
    expect(tokenRefreshSchema.safeParse({ success: true, expiresIn: -1 }).success).toBe(false);
  });
});

describe("chatResponseSchema", () => {
  it("accepts valid chat response", () => {
    expect(chatResponseSchema.safeParse({ message: "Hello!" }).success).toBe(true);
  });

  it("rejects empty message", () => {
    expect(chatResponseSchema.safeParse({ message: "" }).success).toBe(false);
  });
});

describe("webhookPostResponseSchema", () => {
  const validEventTypes = ["message-received", "message-read", "new-follower", "new-subscriber", "tip-received"];
  for (const type of validEventTypes) {
    it(`accepts type '${type}'`, () => {
      expect(webhookPostResponseSchema.safeParse({
        received: true,
        eventId: "550e8400-e29b-41d4-a716-446655440000",
        type,
      }).success).toBe(true);
    });
  }

  it("rejects received=false", () => {
    expect(webhookPostResponseSchema.safeParse({
      received: false,
      eventId: "test",
      type: "message-received",
    }).success).toBe(false);
  });
});

describe("webhookGetResponseSchema", () => {
  it("accepts valid webhook list response", () => {
    expect(webhookGetResponseSchema.safeParse({
      events: [
        { id: "uuid-1", type: "message-received", receivedAt: "2026-04-19T00:00:00Z", payload: {} },
      ],
      total: 1,
      returned: 1,
    }).success).toBe(true);
  });
});

describe("syncDataAllKeysSchema", () => {
  it("accepts valid all-keys response", () => {
    expect(syncDataAllKeysSchema.safeParse({
      keys: ["me", "chats", "posts"],
      data: { me: { id: "123" } },
      syncedAt: "2026-04-19T00:00:00Z",
    }).success).toBe(true);
  });
});

describe("syncDataSingleKeySchema", () => {
  it("accepts found record", () => {
    expect(syncDataSingleKeySchema.safeParse({
      key: "me",
      status: "success",
      data: { id: "123" },
    }).success).toBe(true);
  });

  it("accepts not_found", () => {
    expect(syncDataSingleKeySchema.safeParse({
      key: "missing",
      status: "not_found",
      data: null,
    }).success).toBe(true);
  });
});

describe("syncPostResponseSchema", () => {
  it("accepts response with fanvue data", () => {
    expect(syncPostResponseSchema.safeParse({
      success: true,
      fanvue: { synced: ["me", "chats"], failed: ["posts"] },
      repo: "synced (5 discoveries)",
    }).success).toBe(true);
  });

  it("accepts response with skipped fanvue", () => {
    expect(syncPostResponseSchema.safeParse({
      success: true,
      fanvue: "skipped",
      repo: "synced",
    }).success).toBe(true);
  });
});

describe("auditLogsGetSchema", () => {
  it("accepts valid audit log query response", () => {
    expect(auditLogsGetSchema.safeParse({
      entries: [
        {
          id: "uuid",
          timestamp: "2026-04-19T00:00:00Z",
          category: "auth",
          severity: "info",
          method: "POST",
          route: "/api/auth/rotate",
          action: "Token rotated",
          status: "success",
          actor: "user:abc123",
        },
      ],
      total: 1,
      returned: 1,
    }).success).toBe(true);
  });
});

describe("auditLogStatsSchema", () => {
  it("accepts valid stats response", () => {
    expect(auditLogStatsSchema.safeParse({
      total: 100,
      byCategory: {
        auth: 10, delete: 5, update: 20, upload: 15,
        webhook: 10, sync: 10, security: 10, ai: 15, read: 5,
      },
      bySeverity: { info: 50, warn: 30, error: 15, critical: 5 },
      byMethod: { GET: 40, POST: 35, DELETE: 15, PATCH: 10 },
      oldestEntry: "2026-04-19T00:00:00Z",
      newestEntry: "2026-04-19T23:59:59Z",
    }).success).toBe(true);
  });

  it("accepts null oldest/newest entries", () => {
    expect(auditLogStatsSchema.safeParse({
      total: 0,
      byCategory: { auth: 0, delete: 0, update: 0, upload: 0, webhook: 0, sync: 0, security: 0, ai: 0, read: 0 },
      bySeverity: { info: 0, warn: 0, error: 0, critical: 0 },
      byMethod: {},
      oldestEntry: null,
      newestEntry: null,
    }).success).toBe(true);
  });
});

describe("cspReportGetSchema", () => {
  it("accepts valid CSP report response", () => {
    expect(cspReportGetSchema.safeParse({
      count: 1,
      reports: [
        {
          "document-uri": "https://example.com",
          "violated-directive": "script-src",
          "blocked-uri": "https://evil.com/script.js",
        },
      ],
    }).success).toBe(true);
  });

  it("accepts empty reports array", () => {
    expect(cspReportGetSchema.safeParse({ count: 0, reports: [] }).success).toBe(true);
  });
});

describe("syncFanvueCronSchema", () => {
  it("accepts completed status", () => {
    expect(syncFanvueCronSchema.safeParse({
      status: "completed",
      synced: ["me", "chats"],
      total: 9,
    }).success).toBe(true);
  });

  it("accepts error status", () => {
    expect(syncFanvueCronSchema.safeParse({
      status: "error",
      synced: [],
      failed: ["me"],
      total: 9,
    }).success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(syncFanvueCronSchema.safeParse({ status: "unknown" }).success).toBe(false);
  });
});

describe("syncRepoCronSchema", () => {
  it("accepts completed status", () => {
    expect(syncRepoCronSchema.safeParse({ status: "completed" }).success).toBe(true);
  });

  it("accepts skipped with reason", () => {
    expect(syncRepoCronSchema.safeParse({ status: "skipped", reason: "github_not_configured" }).success).toBe(true);
  });
});

describe("githubFileSchema", () => {
  it("accepts valid file response", () => {
    expect(githubFileSchema.safeParse({
      content: "Hello world",
      path: "README.md",
    }).success).toBe(true);
  });
});

// ─── Helper Functions ────────────────────────────────────────────────────

describe("buildSchemaKey", () => {
  it("generates correct key format", () => {
    expect(buildSchemaKey("GET", "/api/auth/status")).toBe("GET /api/auth/status");
    expect(buildSchemaKey("POST", "/api/chat")).toBe("POST /api/chat");
    expect(buildSchemaKey("get", "/api/test")).toBe("GET /api/test");
  });
});

describe("safeResponse", () => {
  it("returns a NextResponse with JSON data", () => {
    const response = safeResponse(apiHealthSchema, { message: "Hello" });
    expect(response.status).toBe(200);
  });

  it("accepts custom status code", () => {
    const response = safeResponse(apiHealthSchema, { message: "Hello" }, { status: 201 });
    expect(response.status).toBe(201);
  });
});

describe("errorResponseSchema", () => {
  it("accepts valid error", () => {
    expect(errorResponseSchema.safeParse({ error: "Something went wrong" }).success).toBe(true);
  });

  it("rejects empty error string", () => {
    expect(errorResponseSchema.safeParse({ error: "" }).success).toBe(false);
  });
});
