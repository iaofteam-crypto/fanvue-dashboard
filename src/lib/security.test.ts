/**
 * Unit tests for src/lib/security.ts
 * Tests CSRF verification, error sanitization, and rate limit responses.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock NextRequest since we can't import it directly in vitest
function createMockRequest(headers: Record<string, string>): Request {
  return {
    headers: new Headers(headers),
  } as unknown as Request;
}

// Import after mock setup
const { verifyOrigin, sanitizeErrorMessage } = await import("@/lib/security");

// ─── verifyOrigin ────────────────────────────────────────────────────────

describe("verifyOrigin", () => {
  it("allows requests with no origin header (server-to-server)", () => {
    const request = createMockRequest({ host: "example.com" });
    expect(verifyOrigin(request)).toBe(true);
  });

  it("allows same-origin requests via VERCEL_URL env (production)", () => {
    // Set VERCEL_URL to simulate Vercel environment
    process.env.VERCEL_URL = "fanvue-dashboard.vercel.app";
    const request = createMockRequest({
      origin: "https://fanvue-dashboard.vercel.app",
    });
    expect(verifyOrigin(request)).toBe(true);
    delete process.env.VERCEL_URL;
  });

  it("allows same-origin requests (origin matches host)", () => {
    const request = createMockRequest({
      origin: "https://fanvue-dashboard.vercel.app",
      host: "fanvue-dashboard.vercel.app",
    });
    expect(verifyOrigin(request)).toBe(true);
  });

  it("allows localhost origins (development)", () => {
    expect(verifyOrigin(createMockRequest({ origin: "http://localhost:3000" }))).toBe(true);
    expect(verifyOrigin(createMockRequest({ origin: "http://localhost:3001" }))).toBe(true);
    expect(verifyOrigin(createMockRequest({ origin: "https://127.0.0.1:3000" }))).toBe(true);
    expect(verifyOrigin(createMockRequest({ origin: "http://127.0.0.1" }))).toBe(true);
  });

  it("rejects cross-origin requests from other Vercel deployments", () => {
    // CRITICAL security fix: other .vercel.app domains are now rejected
    expect(verifyOrigin(createMockRequest({ origin: "https://evil.vercel.app" }))).toBe(false);
    expect(verifyOrigin(createMockRequest({ origin: "https://attacker-project.vercel.app" }))).toBe(false);
    expect(verifyOrigin(createMockRequest({ origin: "https://phishing.vercel.app.evil.com" }))).toBe(false);
  });

  it("rejects cross-origin requests from unknown domains", () => {
    expect(verifyOrigin(createMockRequest({ origin: "https://evil.com" }))).toBe(false);
    expect(verifyOrigin(createMockRequest({ origin: "https://malware.site" }))).toBe(false);
  });

  it("allows requests with no host and no origin", () => {
    const request = createMockRequest({});
    expect(verifyOrigin(request)).toBe(true);
  });
});

// ─── sanitizeErrorMessage ────────────────────────────────────────────────

describe("sanitizeErrorMessage", () => {
  it("returns 'An unexpected error occurred' for non-Error values", () => {
    expect(sanitizeErrorMessage("string error")).toBe("An unexpected error occurred");
    expect(sanitizeErrorMessage(42)).toBe("An unexpected error occurred");
    expect(sanitizeErrorMessage(null)).toBe("An unexpected error occurred");
    expect(sanitizeErrorMessage(undefined)).toBe("An unexpected error occurred");
  });

  it("sanitizes ECONNREFUSED errors", () => {
    const error = new Error("ECONNREFUSED: connection refused at 127.0.0.1:5432");
    expect(sanitizeErrorMessage(error)).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes ENOTFOUND errors", () => {
    const error = new Error("ENOTFOUND: getaddrinfo ENOTFOUND api.fanvue.com");
    expect(sanitizeErrorMessage(error)).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes fetch failed errors", () => {
    const error = new Error("fetch failed");
    expect(sanitizeErrorMessage(error)).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes Cannot find module errors", () => {
    const error = new Error("Cannot find module '@/lib/nonexistent'");
    expect(sanitizeErrorMessage(error)).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes webpack/node_modules errors", () => {
    expect(sanitizeErrorMessage(new Error("webpack error in bundle"))).toBe("An internal error occurred. Please try again.");
    expect(sanitizeErrorMessage(new Error("Error in node_modules/some-package"))).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes Cannot read property errors", () => {
    const error = new Error("Cannot read properties of undefined (reading 'id')");
    expect(sanitizeErrorMessage(error)).toBe("An internal error occurred. Please try again.");
  });

  it("allows safe error messages through", () => {
    expect(sanitizeErrorMessage(new Error("Not connected to Fanvue"))).toBe("Not connected to Fanvue");
    expect(sanitizeErrorMessage(new Error("Token expired"))).toBe("Token expired");
    expect(sanitizeErrorMessage(new Error("Invalid input"))).toBe("Invalid input");
  });

  it("truncates long error messages to 200 chars", () => {
    const longMsg = "A".repeat(300);
    const error = new Error(longMsg);
    const result = sanitizeErrorMessage(error);
    expect(result.length).toBeLessThanOrEqual(204); // 200 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("does not truncate messages under 200 chars", () => {
    const error = new Error("Short error");
    expect(sanitizeErrorMessage(error)).toBe("Short error");
  });

  it("sanitizes 'is not a function' errors", () => {
    expect(sanitizeErrorMessage(new Error("x.y is not a function"))).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes 'is not defined' errors", () => {
    expect(sanitizeErrorMessage(new Error("foo is not defined"))).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes 'private field' errors", () => {
    expect(sanitizeErrorMessage(new Error("Cannot access private field"))).toBe("An internal error occurred. Please try again.");
  });
});
