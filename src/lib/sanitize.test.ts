/**
 * Unit tests for src/lib/sanitize.ts
 * Tests string sanitization, UUID validation, body size, email/URL helpers.
 */

import { describe, it, expect } from "vitest";

const {
  sanitizeString,
  sanitizeAlphaNumeric,
  sanitizeHtml,
  stripHtml,
  sanitizeQueryParams,
  validateBodySize,
  isValidUUID,
  sanitizeUUID,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeMediaType,
} = await import("@/lib/sanitize");

function createMockRequest(headers: Record<string, string>): Request {
  return {
    headers: new Headers(headers),
  } as unknown as Request;
}

// ─── sanitizeString ──────────────────────────────────────────────────────

describe("sanitizeString", () => {
  it("trims whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });

  it("normalizes unicode", () => {
    expect(sanitizeString("caf\u00E9")).toBe("caf\u00E9");
  });

  it("removes control characters except \\n, \\r, \\t", () => {
    expect(sanitizeString("hello\x00world\x1F")).toBe("helloworld");
    expect(sanitizeString("line1\nline2")).toBe("line1\nline2");
    expect(sanitizeString("tab\there")).toBe("tab\there");
    expect(sanitizeString("cr\there")).toBe("cr\there");
  });

  it("enforces max length", () => {
    expect(sanitizeString("a".repeat(200), 100)).toHaveLength(100);
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error — testing runtime behavior
    expect(sanitizeString(null)).toBe("");
    // @ts-expect-error
    expect(sanitizeString(undefined)).toBe("");
    // @ts-expect-error
    expect(sanitizeString(123)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeString("")).toBe("");
  });

  it("uses default max length of 10000", () => {
    const long = "a".repeat(20000);
    expect(sanitizeString(long).length).toBe(10000);
  });
});

// ─── sanitizeAlphaNumeric ────────────────────────────────────────────────

describe("sanitizeAlphaNumeric", () => {
  it("keeps letters, numbers, spaces, hyphens, underscores, dots, @", () => {
    expect(sanitizeAlphaNumeric("Hello_World-123.test@email")).toBe("Hello_World-123.test@email");
  });

  it("removes special characters", () => {
    expect(sanitizeAlphaNumeric("hello<script>alert(1)</script>")).toBe("helloscriptalert1script");
  });

  it("enforces max length", () => {
    expect(sanitizeAlphaNumeric("a".repeat(300), 100).length).toBe(100);
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error
    expect(sanitizeAlphaNumeric(null)).toBe("");
  });
});

// ─── sanitizeHtml ────────────────────────────────────────────────────────

describe("sanitizeHtml", () => {
  it("removes script tags", () => {
    const result = sanitizeHtml("<script>alert('xss')</script><p>Hello</p>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("<p>Hello</p>");
  });

  it("removes iframe tags", () => {
    const result = sanitizeHtml('<iframe src="https://evil.com"></iframe>');
    expect(result).not.toContain("<iframe");
  });

  it("removes event handler attributes", () => {
    const result = sanitizeHtml('<div onclick="alert(1)">click</div>');
    expect(result).not.toContain("onclick");
  });

  it("removes javascript: URLs", () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">link</a>');
    expect(result).not.toContain("javascript:");
  });

  it("keeps safe HTML tags", () => {
    const result = sanitizeHtml("<b>bold</b> <i>italic</i> <a href='https://example.com'>link</a>");
    expect(result).toContain("<b>bold</b>");
    expect(result).toContain("<i>italic</i>");
    expect(result).toContain("<a");
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error
    expect(sanitizeHtml(null)).toBe("");
  });
});

describe("stripHtml", () => {
  it("removes all HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error
    expect(stripHtml(null)).toBe("");
  });
});

// ─── sanitizeQueryParams ─────────────────────────────────────────────────

describe("sanitizeQueryParams", () => {
  it("returns only allowed params", () => {
    const params = new URLSearchParams({ foo: "bar", baz: "qux", evil: "<script>" });
    const result = sanitizeQueryParams(params, ["foo", "baz"]);
    expect(result).toEqual({ foo: "bar", baz: "qux" });
    expect(result.evil).toBeUndefined();
  });

  it("sanitizes values", () => {
    const params = new URLSearchParams({ key: "  hello  " });
    const result = sanitizeQueryParams(params, ["key"]);
    expect(result.key).toBe("hello");
  });

  it("returns empty object when no params match", () => {
    const params = new URLSearchParams({ a: "1" });
    expect(sanitizeQueryParams(params, ["b"])).toEqual({});
  });
});

// ─── validateBodySize ────────────────────────────────────────────────────

describe("validateBodySize", () => {
  it("returns null when content-length is within limit", () => {
    const request = createMockRequest({ "content-length": "1000" });
    expect(validateBodySize(request, 1024 * 1024)).toBeNull();
  });

  it("returns error message when content-length exceeds limit", () => {
    const request = createMockRequest({ "content-length": "2000000" });
    expect(validateBodySize(request, 1024)).toMatch(/too large/i);
  });

  it("returns null when no content-length header", () => {
    const request = createMockRequest({});
    expect(validateBodySize(request, 1024)).toBeNull();
  });

  it("returns null when content-length is not a number", () => {
    const request = createMockRequest({ "content-length": "not-a-number" });
    expect(validateBodySize(request, 1024)).toBeNull();
  });

  it("allows exactly the limit", () => {
    const request = createMockRequest({ "content-length": "1024" });
    expect(validateBodySize(request, 1024)).toBeNull();
  });
});

// ─── isValidUUID / sanitizeUUID ──────────────────────────────────────────

describe("isValidUUID", () => {
  it("accepts valid UUID v4", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isValidUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    expect(isValidUUID("")).toBe(false);
    expect(isValidUUID("not-a-uuid")).toBe(false);
    expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false); // missing segment
    expect(isValidUUID("550e8400-e29b-41d4-a716-44665544000g")).toBe(false); // invalid char
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true); // uppercase ok
  });
});

describe("sanitizeUUID", () => {
  it("returns valid UUID unchanged", () => {
    expect(sanitizeUUID("550e8400-e29b-41d4-a716-446655440000")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns empty string for invalid UUID", () => {
    expect(sanitizeUUID("invalid")).toBe("");
  });

  it("trims whitespace before validation", () => {
    expect(sanitizeUUID("  550e8400-e29b-41d4-a716-446655440000  ")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error
    expect(sanitizeUUID(null)).toBe("");
  });
});

// ─── sanitizeEmail ───────────────────────────────────────────────────────

describe("sanitizeEmail", () => {
  it("trims and lowercases email", () => {
    expect(sanitizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("normalizes unicode", () => {
    expect(sanitizeEmail("caf\u00E9@example.com")).toBe("caf\u00E9@example.com");
  });

  it("returns empty string for emails over 254 chars", () => {
    const longEmail = `a@${"b".repeat(250)}.com`;
    expect(sanitizeEmail(longEmail)).toBe("");
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error
    expect(sanitizeEmail(null)).toBe("");
  });
});

// ─── sanitizeUrl ─────────────────────────────────────────────────────────

describe("sanitizeUrl", () => {
  it("trims whitespace", () => {
    expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("returns empty string for URLs over 2048 chars", () => {
    expect(sanitizeUrl("https://example.com/" + "a".repeat(2100))).toBe("");
  });

  it("returns empty string for non-string input", () => {
    // @ts-expect-error
    expect(sanitizeUrl(null)).toBe("");
  });
});

// ─── sanitizeMediaType ──────────────────────────────────────────────────

describe("sanitizeMediaType", () => {
  it("accepts valid media types", () => {
    expect(sanitizeMediaType("image")).toBe("image");
    expect(sanitizeMediaType("video")).toBe("video");
    expect(sanitizeMediaType("audio")).toBe("audio");
    expect(sanitizeMediaType("document")).toBe("document");
  });

  it("rejects invalid media types", () => {
    expect(sanitizeMediaType("application")).toBeNull();
    expect(sanitizeMediaType("IMAGE")).toBe("image"); // lowercased
    expect(sanitizeMediaType("")).toBeNull();
  });

  it("returns null for non-string input", () => {
    // @ts-expect-error
    expect(sanitizeMediaType(null)).toBeNull();
  });
});
