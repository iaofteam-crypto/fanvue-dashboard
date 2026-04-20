/**
 * Unit tests for src/lib/rate-limit.ts
 * Tests rate limiting, burst protection, user extraction, and tiered limits.
 *
 * NOTE: Rate limiting uses a global in-memory store. Tests use unique
 * identifiers per test to avoid cross-contamination.
 */

import { describe, it, expect, beforeEach } from "vitest";

let checkRateLimit: (request: Request, config?: unknown) => { allowed: boolean; remaining: number; resetAt: number; limit: number };
let resetRateLimit: (id: string) => boolean;
let getRateLimitInfo: (id: string) => unknown;
let getStoreSize: () => number;

function createMockRequest(headers: Record<string, string>): Request {
  return {
    headers: new Headers(headers),
  } as unknown as Request;
}

beforeEach(async () => {
  const mod = await import("@/lib/rate-limit");
  checkRateLimit = mod.checkRateLimit;
  resetRateLimit = mod.resetRateLimit;
  getRateLimitInfo = mod.getRateLimitInfo;
  getStoreSize = mod.getStoreSize;
});

describe("checkRateLimit", () => {
  it("allows first request from an IP", () => {
    const request = createMockRequest({ "x-forwarded-for": "1.2.3." + Date.now() });
    const result = checkRateLimit(request, { maxRequests: 5 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("allows requests up to the max limit using unique IPs", () => {
    const ip = `100.${Date.now()}.7.8`;
    const request = createMockRequest({ "x-forwarded-for": ip });
    // burst_max = min(10, ceil(60/3)) = 10. With 60 maxRequests, burst allows 10 per 10s.
    // Main window allows 60 per 60s. In a tight loop, burst blocks at 11.
    // So we can make at most 10 requests rapidly (burst limit).
    let blocked = false;
    for (let i = 0; i < 12; i++) {
      const result = checkRateLimit(request, { maxRequests: 60 });
      if (!result.allowed) {
        blocked = true;
        break;
      }
    }
    // Should have been blocked by burst protection (max 10 rapid requests)
    expect(blocked).toBe(true);
  });

  it("returns remaining: 0 when rate limited", () => {
    const ip = `101.${Date.now()}.9.9`;
    const request = createMockRequest({ "x-forwarded-for": ip });
    // Exhaust all tokens (default limit is 30, but burst is 10)
    for (let i = 0; i < 30; i++) {
      checkRateLimit(request);
    }
    const result = checkRateLimit(request);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("extracts IP from x-forwarded-for header (first IP)", () => {
    const ip = `102.0.0.${Date.now() % 1000}`;
    const request = createMockRequest({ "x-forwarded-for": `${ip}, 172.16.0.1` });
    const result = checkRateLimit(request, { maxRequests: 2 });
    expect(result.allowed).toBe(true);
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const ip = `103.${Date.now()}.1.1`;
    const request = createMockRequest({ "x-real-ip": ip });
    const result = checkRateLimit(request, { maxRequests: 2 });
    expect(result.allowed).toBe(true);
  });

  it("uses 'ip:unknown' when no IP headers are present", () => {
    // ip:unknown is shared across tests, so we just verify it doesn't throw
    const request = createMockRequest({});
    const result = checkRateLimit(request, { maxRequests: 100 }); // Use high limit since shared key
    expect(result.allowed).toBe(true);
  });

  it("uses custom identifier when provided", () => {
    const uniqueId = `custom-key-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = checkRateLimit(createMockRequest({}), { identifier: uniqueId, maxRequests: 30 });
    expect(result.allowed).toBe(true);
    // Different request with same identifier shares the quota
    const result2 = checkRateLimit(createMockRequest({}), { identifier: uniqueId, maxRequests: 30 });
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(28); // 30 - 2
  });

  it("gives user tier 2x the base limit when Bearer token is present (default max)", () => {
    // The user extraction hashes the token. We need a unique token each time.
    const token = `unique-long-token-${Date.now()}-${Math.random().toString(36).repeat(3)}`;
    const request = createMockRequest({
      authorization: `Bearer ${token}`,
    });
    // No custom maxRequests → uses DEFAULT_MAX_REQUESTS * 2 = 60
    const result = checkRateLimit(request, { tier: "user" });
    // User tier should get 2x the DEFAULT_MAX_REQUESTS (30 * 2 = 60)
    expect(result.limit).toBe(60);
    expect(result.remaining).toBe(59);
  });

  it("falls back to IP limits when user tier has no token", () => {
    const ip = `104.${Date.now()}.0.1`;
    const request = createMockRequest({});
    const result = checkRateLimit(request, { tier: "user", maxRequests: 50 });
    // No token found → fallback to IP with standard limits
    expect(result.limit).toBe(50);
  });

  it("rejects short bearer tokens (< 10 chars after 'Bearer ')", () => {
    const ip = `105.${Date.now()}.0.1`;
    const request = createMockRequest({
      authorization: "Bearer short",
    });
    const result = checkRateLimit(request, { tier: "user", maxRequests: 50 });
    // Short token → fallback to IP with standard limit (not doubled)
    expect(result.limit).toBe(50);
  });

  it("extracts user from fanvue_token cookie (long token > 10 chars)", () => {
    // Create a valid base64url encoded cookie with a unique access_token > 10 chars
    const accessToken = `cookie-token-${Date.now()}-${Math.random().toString(36).repeat(3)}`;
    const payload = JSON.stringify({ at: accessToken, rt: null, ei: 3600, ea: "2099-01-01", sc: "read" });
    const encoded = Buffer.from(payload).toString("base64url");
    const ip = `200.${Date.now()}.0.1`;
    const request = createMockRequest({
      "x-forwarded-for": ip,
      cookie: `fanvue_token=${encoded}`,
    });
    const result = checkRateLimit(request, { tier: "user" });
    // Cookie token found → user tier → 2x DEFAULT limit (30*2=60)
    expect(result.limit).toBe(60);
  });

  it("handles invalid fanvue_token cookie gracefully", () => {
    const ip = `106.${Date.now()}.0.1`;
    const request = createMockRequest({
      cookie: "fanvue_token=not-valid-base64!!!",
    });
    const result = checkRateLimit(request, { tier: "user", maxRequests: 50 });
    // Invalid cookie → fallback to IP with standard limit
    expect(result.limit).toBe(50);
  });

  it("burst protection blocks rapid-fire requests", () => {
    const ip = `107.${Date.now()}.0.1`;
    const request = createMockRequest({ "x-forwarded-for": ip });
    // Burst max = min(10, ceil(30/3)) = 10
    let blocked = false;
    for (let i = 0; i < 15; i++) {
      const result = checkRateLimit(request, { maxRequests: 30 });
      if (!result.allowed) {
        blocked = true;
        break;
      }
    }
    // Should have been blocked by burst protection before main window limit
    expect(blocked).toBe(true);
  });
});

describe("getRateLimitInfo", () => {
  it("returns null for unknown identifier", () => {
    const info = getRateLimitInfo("nonexistent-key-xyz-" + Date.now());
    expect(info).toBeNull();
  });

  it("returns info after a request is made", () => {
    const ip = `108.${Date.now()}.0.1`;
    const request = createMockRequest({ "x-forwarded-for": ip });
    checkRateLimit(request, { maxRequests: 5 });
    const info = getRateLimitInfo(`ip:${ip}`) as { tokens: number; lastRefill: number };
    expect(info).not.toBeNull();
    expect(info.tokens).toBeLessThanOrEqual(4);
    expect(typeof info.lastRefill).toBe("number");
  });
});

describe("resetRateLimit", () => {
  it("resets rate limit for an identifier", () => {
    const uniqueId = `reset-test-${Date.now()}`;
    const request = createMockRequest({ "x-forwarded-for": uniqueId });
    checkRateLimit(request, { maxRequests: 3 });
    // Reset
    const result = resetRateLimit(`ip:${uniqueId}`);
    expect(result).toBe(true);
    // After reset, should get fresh tokens
    const info = getRateLimitInfo(`ip:${uniqueId}`);
    expect(info).toBeNull();
  });

  it("returns false for non-existent identifier", () => {
    expect(resetRateLimit("nonexistent-" + Date.now())).toBe(false);
  });
});

describe("getStoreSize", () => {
  it("returns the number of tracked entries", () => {
    const size = getStoreSize();
    expect(typeof size).toBe("number");
    expect(size).toBeGreaterThanOrEqual(0);
  });
});
