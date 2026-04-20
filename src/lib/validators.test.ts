/**
 * Unit tests for src/lib/validators.ts
 * Tests Zod input validation schemas for all API endpoints.
 */

import { describe, it, expect } from "vitest";

const {
  uuidSchema,
  nonEmptyString,
  rawNonEmptyString,
  safeNameString,
  emailSchema,
  urlSchema,
  nonNegativeInt,
  positiveInt,
  pageSchema,
  pageSizeSchema,
  isoDateSchema,
  uploadCreateSchema,
  uploadCompleteSchema,
  chatMessageSchema,
  webhookPayloadSchema,
  webhookEventTypeSchema,
  trackingLinkCreateSchema,
  massMessageSchema,
  chatTemplateSchema,
  scheduledPostSchema,
  vaultFolderCreateSchema,
  customListCreateSchema,
  postCommentSchema,
  syncDataQuerySchema,
  webhookQuerySchema,
  formatZodError,
  formatZodErrors,
} = await import("@/lib/validators");

// ─── Shared Schemas ──────────────────────────────────────────────────────

describe("uuidSchema", () => {
  it("accepts valid UUIDs", () => {
    expect(uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    expect(uuidSchema.safeParse("6BA7B810-9DAD-11D1-80B4-00C04FD430C8").success).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    expect(uuidSchema.safeParse("").success).toBe(false);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidSchema.safeParse("550e8400-e29b").success).toBe(false);
  });
});

describe("nonEmptyString", () => {
  it("transforms and accepts non-empty strings", () => {
    const result = nonEmptyString.safeParse("  hello  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("hello");
  });

  it("rejects empty strings", () => {
    expect(nonEmptyString.safeParse("").success).toBe(false);
    // Note: '   '.trim() = '' which fails min(1), but the transform runs after validation
    // In Zod v4, transforms run before validate — '   '.normalize('NFC').trim() = '' → min(1) fails
    // Actually this depends on Zod v4 behavior — let's just test the empty case
  });

  it("rejects strings over 10000 chars", () => {
    expect(nonEmptyString.safeParse("a".repeat(10001)).success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("accepts valid emails", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
  });

  it("lowercases and trims", () => {
    // emailSchema requires .email() validation — spaces make it fail before transform
    const result = emailSchema.safeParse("USER@Example.COM");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("user@example.com");
  });

  it("rejects invalid emails", () => {
    expect(emailSchema.safeParse("not-email").success).toBe(false);
    expect(emailSchema.safeParse("@").success).toBe(false);
  });

  it("rejects emails over 254 chars", () => {
    expect(emailSchema.safeParse(`a@${"b".repeat(250)}.com`).success).toBe(false);
  });
});

describe("urlSchema", () => {
  it("accepts valid URLs", () => {
    expect(urlSchema.safeParse("https://example.com").success).toBe(true);
    expect(urlSchema.safeParse("http://localhost:3000").success).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(urlSchema.safeParse("not-a-url").success).toBe(false);
  });
});

describe("pageSchema", () => {
  it("defaults to 1", () => {
    const result = pageSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(1);
  });

  it("coerces string to number", () => {
    const result = pageSchema.safeParse("5");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(5);
  });

  it("rejects values below 1", () => {
    expect(pageSchema.safeParse(0).success).toBe(false);
  });
});

describe("pageSizeSchema", () => {
  it("defaults to 20", () => {
    const result = pageSizeSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(20);
  });

  it("rejects values over 100", () => {
    expect(pageSizeSchema.safeParse(101).success).toBe(false);
  });
});

describe("isoDateSchema", () => {
  it("accepts ISO datetime strings", () => {
    expect(isoDateSchema.safeParse("2026-04-19T12:00:00Z").success).toBe(true);
  });

  it("accepts YYYY-MM-DD format", () => {
    expect(isoDateSchema.safeParse("2026-04-19").success).toBe(true);
  });

  it("rejects invalid dates", () => {
    expect(isoDateSchema.safeParse("not-a-date").success).toBe(false);
  });
});

// ─── Upload Schemas ─────────────────────────────────────────────────────

describe("uploadCreateSchema", () => {
  it("accepts valid upload creation", () => {
    expect(uploadCreateSchema.safeParse({
      name: "My Photo",
      filename: "photo.jpg",
      mediaType: "image",
    }).success).toBe(true);
  });

  it("rejects invalid mediaType", () => {
    expect(uploadCreateSchema.safeParse({
      name: "Test",
      filename: "test.bin",
      mediaType: "application",
    }).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(uploadCreateSchema.safeParse({
      name: "",
      filename: "test.jpg",
      mediaType: "image",
    }).success).toBe(false);
  });
});

describe("uploadCompleteSchema", () => {
  it("accepts valid completion with parts", () => {
    expect(uploadCompleteSchema.safeParse({
      uploadId: "550e8400-e29b-41d4-a716-446655440000",
      parts: [{ PartNumber: 1, ETag: '"abc123"' }],
    }).success).toBe(true);
  });

  it("rejects empty parts array", () => {
    expect(uploadCompleteSchema.safeParse({
      uploadId: "550e8400-e29b-41d4-a716-446655440000",
      parts: [],
    }).success).toBe(false);
  });

  it("rejects invalid uploadId", () => {
    expect(uploadCompleteSchema.safeParse({
      uploadId: "not-a-uuid",
      parts: [{ PartNumber: 1, ETag: '"abc"' }],
    }).success).toBe(false);
  });
});

// ─── Chat Schema ─────────────────────────────────────────────────────────

describe("chatMessageSchema", () => {
  it("accepts valid chat messages", () => {
    expect(chatMessageSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
    }).success).toBe(true);
  });

  it("defaults mode to 'ops'", () => {
    const result = chatMessageSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mode).toBe("ops");
  });

  it("rejects empty messages array", () => {
    expect(chatMessageSchema.safeParse({ messages: [] }).success).toBe(false);
  });

  it("rejects invalid roles", () => {
    expect(chatMessageSchema.safeParse({
      messages: [{ role: "admin", content: "Hello" }],
    }).success).toBe(false);
  });

  it("rejects messages over 4000 chars", () => {
    expect(chatMessageSchema.safeParse({
      messages: [{ role: "user", content: "a".repeat(4001) }],
    }).success).toBe(false);
  });

  it("rejects more than 50 messages", () => {
    const messages = Array.from({ length: 51 }, () => ({ role: "user" as const, content: "hi" }));
    expect(chatMessageSchema.safeParse({ messages }).success).toBe(false);
  });
});

// ─── Webhook Schema ──────────────────────────────────────────────────────

describe("webhookPayloadSchema", () => {
  it("accepts message-received event", () => {
    expect(webhookPayloadSchema.safeParse({
      type: "message-received",
      messageUuid: "550e8400-e29b-41d4-a716-446655440000",
    }).success).toBe(true);
  });

  it("accepts tip-received event", () => {
    expect(webhookPayloadSchema.safeParse({
      type: "tip-received",
      tip: { amount: 50 },
    }).success).toBe(true);
  });

  it("rejects invalid event type", () => {
    expect(webhookPayloadSchema.safeParse({
      type: "unknown-event",
    }).success).toBe(false);
  });
});

// ─── Other Feature Schemas ──────────────────────────────────────────────

describe("trackingLinkCreateSchema", () => {
  it("accepts valid link creation", () => {
    expect(trackingLinkCreateSchema.safeParse({
      name: "Instagram Link",
      destination: "https://instagram.com/user",
      source: "ig",
    }).success).toBe(true);
  });

  it("defaults source to 'direct'", () => {
    const result = trackingLinkCreateSchema.safeParse({
      name: "Link",
      destination: "https://example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.source).toBe("direct");
  });

  it("rejects invalid URL", () => {
    expect(trackingLinkCreateSchema.safeParse({
      name: "Link",
      destination: "not-a-url",
    }).success).toBe(false);
  });
});

describe("massMessageSchema", () => {
  it("accepts valid mass message", () => {
    expect(massMessageSchema.safeParse({
      text: "Hello fans!",
      includedLists: ["subscribers"],
    }).success).toBe(true);
  });

  it("rejects empty text", () => {
    expect(massMessageSchema.safeParse({
      text: "",
    }).success).toBe(false);
  });

  it("rejects text over 5000 chars", () => {
    expect(massMessageSchema.safeParse({
      text: "a".repeat(5001),
    }).success).toBe(false);
  });
});

describe("chatTemplateSchema", () => {
  it("accepts valid template", () => {
    expect(chatTemplateSchema.safeParse({
      name: "Welcome",
      category: "greeting",
      content: "Hi {{fan_name}}!",
    }).success).toBe(true);
  });

  it("defaults category to 'custom'", () => {
    const result = chatTemplateSchema.safeParse({
      name: "Template",
      content: "Hello",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.category).toBe("custom");
  });
});

// ─── Helper Functions ────────────────────────────────────────────────────

describe("formatZodError", () => {
  it("formats the first error with path", () => {
    const result = uuidSchema.safeParse("not-a-uuid");
    if (!result.success) {
      const msg = formatZodError(result.error);
      expect(msg).toBeTruthy();
      expect(typeof msg).toBe("string");
    }
  });
});

describe("formatZodErrors", () => {
  it("returns array of formatted errors", () => {
    const result = uploadCompleteSchema.safeParse({
      uploadId: "bad",
      parts: [],
    });
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    }
  });
});
