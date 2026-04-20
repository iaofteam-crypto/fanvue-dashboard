/**
 * E2E tests for the Chat / AI endpoint: POST /api/chat.
 *
 * Tests the full chat flow:
 * 1. Valid message → success response
 * 2. Validation errors (missing messages, invalid role, too long)
 * 3. Body size limit (413)
 * 4. Rate limiting
 * 5. LLM error handling
 *
 * Mocks: z-ai-web-dev-sdk (ZAI.create + completions).
 * Internal middleware (rate limiting, validation, sanitization) runs for real.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createNextRequest, parseResponse, uniqueIp } from "@/lib/test-helpers";

// Mock z-ai-web-dev-sdk
const mockCreate = vi.fn();
vi.mock("z-ai-web-dev-sdk", () => ({
  default: {
    create: mockCreate,
  },
}));

// Mock db to avoid real KV calls
vi.mock("@/lib/db", () => ({
  db: {
    syncedData: {
      getKeys: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Import handlers after mocks
const { POST: chatPost } = await import("@/app/api/chat/route");

beforeEach(() => {
  mockCreate.mockReset();
});

describe("Chat — Send Message", () => {
  it("returns AI response for valid message", async () => {
    mockCreate.mockResolvedValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Hello! How can I help you today?" } }],
          }),
        },
      },
    });

    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [{ role: "user", content: "Hi, I need help with my Fanvue account" }],
        mode: "ops",
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.message).toBe("Hello! How can I help you today?");
  });

  it("uses default mode 'ops' when not specified", async () => {
    mockCreate.mockResolvedValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Default ops response" } }],
          }),
        },
      },
    });

    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [{ role: "user", content: "Hello" }],
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.message).toBe("Default ops response");
  });

  it("works with 'analyst' mode", async () => {
    mockCreate.mockResolvedValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Analyst insight: Your top fan is..." } }],
          }),
        },
      },
    });

    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [{ role: "user", content: "Analyze my fans" }],
        mode: "analyst",
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.message).toContain("Analyst insight");
  });

  it("works with 'creative' mode", async () => {
    mockCreate.mockResolvedValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Creative suggestion: Try posting a behind-the-scenes video!" } }],
          }),
        },
      },
    });

    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [{ role: "user", content: "Suggest a post idea" }],
        mode: "creative",
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(200);
  });
});

describe("Chat — Validation Errors", () => {
  it("returns 400 for empty messages array", async () => {
    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: { messages: [] },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(400);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toContain("messages");
  });

  it("returns 400 for missing messages field", async () => {
    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: { mode: "ops" },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid role", async () => {
    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [{ role: "invalid_role", content: "Hello" }],
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(400);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toContain("role");
  });

  it("returns 400 for message content too long (>4000 chars)", async () => {
    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [{ role: "user", content: "A".repeat(4001) }],
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(400);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toContain("too long");
  });

  it("returns 400 for too many messages (>50)", async () => {
    const messages = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? "user" as const : "assistant" as const,
      content: `Message ${i}`,
    }));

    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: { messages },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid mode", async () => {
    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [{ role: "user", content: "Hello" }],
        mode: "invalid_mode",
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(400);
  });

  it("returns 413 for body exceeding 500KB limit", async () => {
    // Create a body larger than 512KB (the validateBodySize limit)
    const largeMessages = [{ role: "user" as const, content: "X".repeat(600_000) }];

    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: {
        "x-forwarded-for": uniqueIp(),
        "content-length": String(700_000),
      },
      body: { messages: largeMessages },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(413);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toContain("too large");
  });
});

describe("Chat — Rate Limiting", () => {
  it("returns 429 after exceeding rate limit", async () => {
    mockCreate.mockResolvedValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Response" } }],
          }),
        },
      },
    });

    // Use same IP to accumulate rate limit (limit is 10/min)
    const sameIp = "10.0.253.253";
    // Send 15 requests
    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < 15; i++) {
      const request = createNextRequest("/api/chat", {
        method: "POST",
        headers: { "x-forwarded-for": sameIp },
        body: {
          messages: [{ role: "user", content: `Message ${i}` }],
        },
      });
      promises.push(chatPost(request));
    }

    const responses = await Promise.all(promises);
    const statusCodes = responses.map((r: Response) => r.status);
    expect(statusCodes.some((s) => s === 429)).toBe(true);
  });
});

describe("Chat — Error Handling", () => {
  it("returns 500 when LLM returns empty response", async () => {
    mockCreate.mockResolvedValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: null } }],
          }),
        },
      },
    });

    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [{ role: "user", content: "Hello" }],
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(500);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toContain("No response generated");
  });

  it("returns 500 when LLM throws an error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [{ role: "user", content: "Hello" }],
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(500);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  it("handles multi-turn conversation", async () => {
    mockCreate.mockResolvedValueOnce({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Based on our conversation..." } }],
          }),
        },
      },
    });

    const request = createNextRequest("/api/chat", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: {
        messages: [
          { role: "user", content: "I want to increase my subscriber count" },
          { role: "assistant", content: "Here are some strategies..." },
          { role: "user", content: "Tell me more about the first one" },
        ],
      },
    });
    const response = await chatPost(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.message).toContain("Based on our conversation");
  });
});
