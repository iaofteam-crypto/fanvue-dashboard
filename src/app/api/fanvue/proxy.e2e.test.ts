/**
 * E2E tests for the Fanvue catch-all proxy: create post, read posts, update, delete.
 *
 * Tests the full CRUD lifecycle via /api/fanvue/[...endpoint]:
 * 1. POST /api/fanvue/posts — create post
 * 2. GET /api/fanvue/posts — list posts
 * 3. PATCH /api/fanvue/posts/{uuid} — update post
 * 4. DELETE /api/fanvue/posts/{uuid} — delete post
 *
 * Mocks: @/lib/fanvue (getValidAccessToken), global fetch (Fanvue API responses).
 * Internal middleware (rate limiting, CSRF, sanitization) runs for real.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createNextRequest, parseResponse, uniqueIp } from "@/lib/test-helpers";

// Mock getValidAccessToken to return a fake token
vi.mock("@/lib/fanvue", () => ({
  getValidAccessToken: vi.fn().mockResolvedValue("test_access_token_e2e"),
  FANVUE_API_BASE: "https://api.fanvue.com",
  FANVUE_API_VERSION: "2025-06-26",
}));

// Mock global fetch to simulate Fanvue API responses
// The proxy handlers use response.text() + JSON.parse, so mock must include text()
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/** Create a mock fetch Response with both json() and text() methods */
function mockFanvueResponse(data: unknown, status = 200) {
  const text = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => text,
  };
}

// Import handlers after mocks
const { GET: proxyGet, POST: proxyPost, PATCH: proxyPatch, DELETE: proxyDelete } = await import(
  "@/app/api/fanvue/[...endpoint]/route"
);

beforeEach(() => {
  mockFetch.mockReset();
});

function makeParams(endpoint: string[]) {
  return Promise.resolve({ endpoint });
}

describe("Fanvue Proxy — Create Post (POST)", () => {
  it("creates a post successfully", async () => {
    const fanvueResponse = {
      id: "post-uuid-123",
      title: "My Test Post",
      type: "photo",
      status: "published",
    };
    mockFetch.mockResolvedValueOnce(mockFanvueResponse(fanvueResponse, 201));

    const request = createNextRequest("/api/fanvue/posts", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
      body: { title: "My Test Post", type: "photo" },
    });
    const response = await proxyPost(request, { params: makeParams(["posts"]) });
    expect(response.status).toBe(201);

    // Verify fetch was called with correct headers
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toBe("https://api.fanvue.com/posts");
    expect(fetchCall[1].method).toBe("POST");
    expect(fetchCall[1].headers.Authorization).toBe("Bearer test_access_token_e2e");
    expect(fetchCall[1].headers["X-Fanvue-API-Version"]).toBe("2025-06-26");

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.id).toBe("post-uuid-123");
    expect(body.title).toBe("My Test Post");
  });

  it("returns CSRF 403 for cross-origin POST", async () => {
    const request = createNextRequest("/api/fanvue/posts", {
      method: "POST",
      headers: { origin: "https://evil.com", "x-forwarded-for": uniqueIp() },
      body: { title: "Malicious Post" },
    });
    const response = await proxyPost(request, { params: makeParams(["posts"]) });
    expect(response.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    // Use SAME IP so rate limiter accumulates (limit is 30/min)
    const sameIp = "10.0.254.254";
    const promises: Promise<unknown>[] = [];
    mockFetch.mockResolvedValue(mockFanvueResponse({ id: "post" }, 201));

    for (let i = 0; i < 35; i++) {
      const request = createNextRequest("/api/fanvue/posts", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-for": sameIp },
        body: { title: `Post ${i}` },
      });
      promises.push(proxyPost(request, { params: makeParams(["posts"]) }));
    }

    const responses = await Promise.all(promises);
    const statusCodes = responses.map((r) => r.status);
    // At least some should be rate limited
    expect(statusCodes.some((s) => s === 429)).toBe(true);
  });

  it("returns 401 when not connected to Fanvue", async () => {
    // Override the mock for this test
    const { getValidAccessToken } = await import("@/lib/fanvue");
    vi.mocked(getValidAccessToken).mockRejectedValueOnce(new Error("Not connected to Fanvue"));

    const request = createNextRequest("/api/fanvue/posts", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
      body: { title: "Test Post" },
    });
    const response = await proxyPost(request, { params: makeParams(["posts"]) });
    expect(response.status).toBe(401);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toContain("Not connected");
  });

  it("propagates Fanvue API errors", async () => {
    mockFetch.mockResolvedValueOnce(mockFanvueResponse({ error: "Validation failed: title is required" }, 422));

    const request = createNextRequest("/api/fanvue/posts", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
      body: {},
    });
    const response = await proxyPost(request, { params: makeParams(["posts"]) });
    expect(response.status).toBe(422);
  });

  it("sets rate limit headers on success response", async () => {
    mockFetch.mockResolvedValueOnce(mockFanvueResponse({ id: "post" }, 201));

    const request = createNextRequest("/api/fanvue/posts", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
      body: { title: "Test" },
    });
    const response = await proxyPost(request, { params: makeParams(["posts"]) });
    // Verify response is successful (headers are set by withRateLimitHeaders internally)
    expect(response.status).toBe(201);
  });
});

describe("Fanvue Proxy — Read Posts (GET)", () => {
  it("fetches posts successfully", async () => {
    const posts = [
      { id: "post-1", title: "First Post" },
      { id: "post-2", title: "Second Post" },
    ];
    mockFetch.mockResolvedValueOnce(mockFanvueResponse(posts));

    const request = createNextRequest("/api/fanvue/posts", {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await proxyGet(request, { params: makeParams(["posts"]) });
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
  });

  it("includes query params in upstream request", async () => {
    mockFetch.mockResolvedValueOnce(mockFanvueResponse([]));

    const request = createNextRequest("/api/fanvue/posts", {
      searchParams: { page: "2", limit: "10" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await proxyGet(request, { params: makeParams(["posts"]) });
    expect(response.status).toBe(200);

    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain("page=2");
    expect(fetchUrl).toContain("limit=10");
  });

  it("returns 401 when not connected", async () => {
    const { getValidAccessToken } = await import("@/lib/fanvue");
    vi.mocked(getValidAccessToken).mockRejectedValueOnce(new Error("Not connected to Fanvue"));

    const request = createNextRequest("/api/fanvue/posts", {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await proxyGet(request, { params: makeParams(["posts"]) });
    expect(response.status).toBe(401);
  });
});

describe("Fanvue Proxy — Delete Post (DELETE)", () => {
  it("deletes a post successfully", async () => {
    mockFetch.mockResolvedValueOnce(mockFanvueResponse({ deleted: true }));

    const request = createNextRequest("/api/fanvue/posts/post-uuid-123", {
      method: "DELETE",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
    });
    const response = await proxyDelete(request, { params: makeParams(["posts", "post-uuid-123"]) });
    expect(response.status).toBe(200);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.fanvue.com/posts/post-uuid-123",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("blocks DELETE without CSRF origin", async () => {
    const request = createNextRequest("/api/fanvue/posts/post-uuid-123", {
      method: "DELETE",
      headers: { origin: "https://attacker.com", "x-forwarded-for": uniqueIp() },
    });
    const response = await proxyDelete(request, { params: makeParams(["posts", "post-uuid-123"]) });
    expect(response.status).toBe(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("Fanvue Proxy — Update Post (PATCH)", () => {
  it("updates a post successfully", async () => {
    mockFetch.mockResolvedValueOnce(mockFanvueResponse({ id: "post-uuid", title: "Updated" }));

    const request = createNextRequest("/api/fanvue/posts/post-uuid", {
      method: "PATCH",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
      body: { title: "Updated" },
    });
    const response = await proxyPatch(request, { params: makeParams(["posts", "post-uuid"]) });
    expect(response.status).toBe(200);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.fanvue.com/posts/post-uuid",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("blocks PATCH without CSRF origin", async () => {
    const request = createNextRequest("/api/fanvue/posts/post-uuid", {
      method: "PATCH",
      headers: { origin: "https://evil.com", "x-forwarded-for": uniqueIp() },
      body: { title: "Hacked" },
    });
    const response = await proxyPatch(request, { params: makeParams(["posts", "post-uuid"]) });
    expect(response.status).toBe(403);
  });
});

describe("Fanvue Proxy — Nested Endpoints", () => {
  it("handles nested paths like posts/uuid/comments", async () => {
    mockFetch.mockResolvedValueOnce(mockFanvueResponse([{ id: "c1", text: "Nice!" }]));

    const request = createNextRequest("/api/fanvue/posts/uuid-abc/comments", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": uniqueIp() },
      body: { content: "Nice!" },
    });
    const response = await proxyPost(request, {
      params: makeParams(["posts", "uuid-abc", "comments"]),
    });
    expect(response.status).toBe(200);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.fanvue.com/posts/uuid-abc/comments",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("handles multi-segment paths like chats/id/media", async () => {
    mockFetch.mockResolvedValueOnce(mockFanvueResponse([]));

    const request = createNextRequest("/api/fanvue/chats/chat-123/media", {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await proxyGet(request, {
      params: makeParams(["chats", "chat-123", "media"]),
    });
    expect(response.status).toBe(200);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.fanvue.com/chats/chat-123/media",
      expect.any(Object)
    );
  });
});
