/**
 * E2E tests for the Login flow: auth status + disconnect.
 *
 * Tests the full authentication lifecycle:
 * 1. GET /api/auth/status — connection state detection
 * 2. POST /api/auth/disconnect — token cleanup
 *
 * Uses the real in-memory db (no mocking) for realistic E2E behavior.
 * Only mocks are for Next.js internals that don't work in test env.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createNextRequest, parseResponse, encodeFanvueToken, uniqueIp } from "@/lib/test-helpers";

// Import db for seeding/verification
import { db } from "@/lib/db";

// Reset in-memory store between tests
beforeEach(async () => {
  // Clear tokens
  try { await db.oAuthToken.delete({ where: { id: "fanvue_primary" } }); } catch { /* noop */ }
});

// Import handlers after db reset
const { GET: authStatusGet } = await import("@/app/api/auth/status/route");
const { POST: authDisconnectPost } = await import("@/app/api/auth/disconnect/route");

describe("Login Flow — Auth Status", () => {
  it("returns connected:false when no token exists in store", async () => {
    const request = createNextRequest("/api/auth/status", {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await authStatusGet(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.connected).toBe(false);
  });

  it("returns connected:true with token details from store", async () => {
    // Seed a valid token
    const futureExpiry = new Date(Date.now() + 3600_000).toISOString();
    await db.oAuthToken.upsert({
      where: { id: "fanvue_primary" },
      update: {
        accessToken: "test_access_token_abc123",
        refreshToken: "test_refresh_token_xyz",
        expiresIn: 3600,
        expiresAt: futureExpiry,
        scope: "read:self write:chat",
      },
      create: {
        id: "fanvue_primary",
        provider: "fanvue",
        accessToken: "test_access_token_abc123",
        refreshToken: "test_refresh_token_xyz",
        expiresIn: 3600,
        expiresAt: futureExpiry,
        scope: "read:self write:chat",
      },
    });

    const request = createNextRequest("/api/auth/status", {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await authStatusGet(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.connected).toBe(true);
    expect(body.isExpired).toBe(false);
    expect(body.scope).toBe("read:self write:chat");
  });

  it("returns connected:true with isExpired:true for expired token", async () => {
    const pastExpiry = new Date(Date.now() - 3600_000).toISOString();
    await db.oAuthToken.upsert({
      where: { id: "fanvue_primary" },
      update: {
        accessToken: "expired_token",
        refreshToken: "refresh_tok",
        expiresIn: 0,
        expiresAt: pastExpiry,
        scope: "read:self",
      },
      create: {
        id: "fanvue_primary",
        provider: "fanvue",
        accessToken: "expired_token",
        refreshToken: "refresh_tok",
        expiresIn: 0,
        expiresAt: pastExpiry,
        scope: "read:self",
      },
    });

    const request = createNextRequest("/api/auth/status", {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await authStatusGet(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.connected).toBe(true);
    expect(body.isExpired).toBe(true);
  });

  it("returns connected:true from cookie fallback (cold start recovery)", async () => {
    // No token in store — simulate cold start
    const tokenCookie = encodeFanvueToken({
      accessToken: "cookie_access_token",
      refreshToken: "cookie_refresh",
      expiresIn: 3600,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      scope: "read:self write:post",
    });

    const request = createNextRequest("/api/auth/status", {
      headers: { "x-forwarded-for": uniqueIp() },
      cookies: { fanvue_token: tokenCookie },
    });
    const response = await authStatusGet(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.connected).toBe(true);
    expect(body.source).toBe("cookie");
    expect(body.isExpired).toBe(false);
    expect(body.scope).toBe("read:self write:post");
  });

  it("returns connected:false for expired cookie token", async () => {
    const expiredCookie = encodeFanvueToken({
      accessToken: "expired_cookie_token",
      refreshToken: "expired_refresh",
      expiresIn: 0,
      expiresAt: new Date(Date.now() - 600_000).toISOString(),
      scope: null,
    });

    const request = createNextRequest("/api/auth/status", {
      headers: { "x-forwarded-for": uniqueIp() },
      cookies: { fanvue_token: expiredCookie },
    });
    const response = await authStatusGet(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.connected).toBe(false);
  });

  it("returns 500 on unexpected error from db", async () => {
    // Force a db error by temporarily breaking the store
    vi.spyOn(db.oAuthToken, "findUnique").mockRejectedValueOnce(new Error("DB connection failed"));

    const request = createNextRequest("/api/auth/status", {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await authStatusGet(request);
    // Response should still have connected:false with error info
    expect(response.status).toBe(500);
    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.connected).toBe(false);
    expect(body.error).toBeDefined();
  });
});

describe("Login Flow — Auth Disconnect", () => {
  it("successfully disconnects when token exists", async () => {
    // Seed a token
    await db.oAuthToken.upsert({
      where: { id: "fanvue_primary" },
      update: { accessToken: "tok", refreshToken: "ref", expiresIn: 3600, expiresAt: new Date(Date.now() + 3600_000).toISOString() },
      create: { id: "fanvue_primary", provider: "fanvue", accessToken: "tok", refreshToken: "ref", expiresIn: 3600, expiresAt: new Date(Date.now() + 3600_000).toISOString() },
    });

    const request = createNextRequest("/api/auth/disconnect", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
    });
    const response = await authDisconnectPost(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.disconnected).toBe(true);

    // Verify token was deleted
    const token = await db.oAuthToken.findUnique({ where: { id: "fanvue_primary" } });
    expect(token).toBeNull();
  });

  it("successfully disconnects even when no token exists (idempotent)", async () => {
    const request = createNextRequest("/api/auth/disconnect", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
    });
    const response = await authDisconnectPost(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.disconnected).toBe(true);
  });

  it("blocks disconnect without CSRF origin check", async () => {
    const request = createNextRequest("/api/auth/disconnect", {
      method: "POST",
      headers: { origin: "https://evil.com", "x-forwarded-for": uniqueIp() },
    });
    const response = await authDisconnectPost(request);
    expect(response.status).toBe(403);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toBe("Forbidden");
  });

  it("allows disconnect with no origin header (server-to-server)", async () => {
    const request = createNextRequest("/api/auth/disconnect", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await authDisconnectPost(request);
    expect(response.status).toBe(200);
  });

  it("allows disconnect from same-origin domain (host matches origin)", async () => {
    const request = createNextRequest("/api/auth/disconnect", {
      method: "POST",
      headers: { origin: "https://my-app.vercel.app", host: "my-app.vercel.app", "x-forwarded-for": uniqueIp() },
    });
    const response = await authDisconnectPost(request);
    expect(response.status).toBe(200);
  });
});
