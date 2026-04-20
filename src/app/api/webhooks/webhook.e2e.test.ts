/**
 * E2E tests for the Fanvue Webhook endpoint.
 *
 * Tests the full webhook flow:
 * 1. POST — receive webhook events with HMAC-SHA256 signature verification
 * 2. GET — poll stored events with filtering
 *
 * Mocks: env var FANVUE_WEBHOOK_SECRET.
 * Internal middleware (rate limiting, signature verification, validation) runs for real.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createNextRequest, parseResponse, generateWebhookSignature, uniqueIp } from "@/lib/test-helpers";

// Set webhook secret for signature verification (env-based, not stubGlobal)
process.env.FANVUE_WEBHOOK_SECRET = "test_webhook_secret_for_e2e";

// Import handlers after env setup
const { POST: webhookPost, GET: webhookGet, getStoredEvents } = await import(
  "@/app/api/webhooks/fanvue/route"
);

const VALID_EVENT_TYPES = [
  "message-received",
  "message-read",
  "new-follower",
  "new-subscriber",
  "tip-received",
] as const;

function createWebhookRequest(
  eventType: string,
  payload: Record<string, unknown> = {},
  overrides?: { secret?: string; timestamp?: number }
): NextRequest {
  const fullPayload = { type: eventType, ...payload };
  const bodyStr = JSON.stringify(fullPayload);
  const signature = generateWebhookSignature(bodyStr, overrides?.secret ?? process.env.FANVUE_WEBHOOK_SECRET, overrides?.timestamp);

  return createNextRequest("/api/webhooks/fanvue", {
    method: "POST",
    headers: {
      "x-fanvue-signature": signature,
      "x-forwarded-for": uniqueIp(),
    },
    body: fullPayload,
  });
}

describe("Webhook — Receive Events (POST)", () => {
  it("accepts valid message-received event", async () => {
    const request = createWebhookRequest("message-received", {
      messageUuid: "550e8400-e29b-41d4-a716-446655440001",
    });
    const response = await webhookPost(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.received).toBe(true);
    expect(body.eventId).toBeTruthy();
    expect(body.type).toBe("message-received");
  });

  it("accepts valid message-read event", async () => {
    const request = createWebhookRequest("message-read", {
      messageUuid: "550e8400-e29b-41d4-a716-446655440002",
    });
    const response = await webhookPost(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.type).toBe("message-read");
  });

  it("accepts valid new-follower event", async () => {
    const request = createWebhookRequest("new-follower", {
      follower: { id: "fan-1", displayName: "John Doe" },
    });
    const response = await webhookPost(request);
    expect(response.status).toBe(200);
    expect((await parseResponse(response) as Record<string, unknown>).type).toBe("new-follower");
  });

  it("accepts valid new-subscriber event", async () => {
    const request = createWebhookRequest("new-subscriber", {
      subscriber: { id: "sub-1", tier: "vip" },
    });
    const response = await webhookPost(request);
    expect(response.status).toBe(200);
    expect((await parseResponse(response) as Record<string, unknown>).type).toBe("new-subscriber");
  });

  it("accepts valid tip-received event", async () => {
    const request = createWebhookRequest("tip-received", {
      tip: { amount: 50, currency: "USD" },
    });
    const response = await webhookPost(request);
    expect(response.status).toBe(200);
    expect((await parseResponse(response) as Record<string, unknown>).type).toBe("tip-received");
  });

  it("rejects event with invalid signature", async () => {
    const request = createWebhookRequest("message-received", {}, { secret: "wrong_secret" });
    const response = await webhookPost(request);
    expect(response.status).toBe(401);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toContain("Invalid signature");
  });

  it("rejects event with missing signature header", async () => {
    const request = createNextRequest("/api/webhooks/fanvue", {
      method: "POST",
      headers: { "x-forwarded-for": uniqueIp() },
      body: { type: "message-received" },
    });
    const response = await webhookPost(request);
    expect(response.status).toBe(401);

    const body = await parseResponse(response) as Record<string, unknown>;
    // Handler returns { error: "Invalid signature" } — detail no longer exposed to client
    expect(body.error).toBe("Invalid signature");
  });

  it("rejects event with expired timestamp (>5 min old)", async () => {
    const sixMinutesAgo = Math.floor(Date.now() / 1000) - 360;
    const request = createWebhookRequest("message-received", {}, { timestamp: sixMinutesAgo });
    const response = await webhookPost(request);
    expect(response.status).toBe(401);

    const body = await parseResponse(response) as Record<string, unknown>;
    // Detail no longer exposed to client (security fix)
  });

  it("rejects event with future timestamp (>5 min ahead)", async () => {
    const sixMinutesFuture = Math.floor(Date.now() / 1000) + 360;
    const request = createWebhookRequest("message-received", {}, { timestamp: sixMinutesFuture });
    const response = await webhookPost(request);
    expect(response.status).toBe(401);
  });

  it("rejects event with invalid JSON body", async () => {
    const bodyStr = "not json";
    const signature = generateWebhookSignature(bodyStr, process.env.FANVUE_WEBHOOK_SECRET!);
    const request = createNextRequest("/api/webhooks/fanvue", {
      method: "POST",
      headers: {
        "x-fanvue-signature": signature,
        "x-forwarded-for": uniqueIp(),
      },
      body: bodyStr, // This will be JSON-stringified by createNextRequest, but the content is still "not json"
    });
    // Override the body to be raw invalid JSON
    const rawRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: bodyStr,
    });

    const response = await webhookPost(rawRequest as unknown as import("next/server").NextRequest);
    expect(response.status).toBe(400);
  });

  it("rejects event with invalid event type", async () => {
    const fullPayload = { type: "unknown-event", data: "test" };
    const bodyStr = JSON.stringify(fullPayload);
    const signature = generateWebhookSignature(bodyStr, process.env.FANVUE_WEBHOOK_SECRET!);

    const request = createNextRequest("/api/webhooks/fanvue", {
      method: "POST",
      headers: {
        "x-fanvue-signature": signature,
        "x-forwarded-for": uniqueIp(),
      },
      body: fullPayload,
    });
    const response = await webhookPost(request);
    expect(response.status).toBe(400);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(body.error).toContain("type");
  });

  it("stores events and returns unique IDs", async () => {
    const r1 = await webhookPost(createWebhookRequest("message-received"));
    const r2 = await webhookPost(createWebhookRequest("new-follower"));

    const b1 = (await parseResponse(r1)) as Record<string, unknown>;
    const b2 = (await parseResponse(r2)) as Record<string, unknown>;

    expect(b1.eventId).toBeTruthy();
    expect(b2.eventId).toBeTruthy();
    expect(b1.eventId).not.toBe(b2.eventId);
  });

  it("accepts events with no origin header (server-to-server)", async () => {
    const request = createWebhookRequest("message-received");
    // Remove origin if present
    request.headers.delete("origin");
    const response = await webhookPost(request);
    expect(response.status).toBe(200);
  });
});

describe("Webhook — Poll Events (GET)", () => {
  it("returns empty events list initially", async () => {
    // Note: events from other tests may accumulate, but this test just checks shape
    const request = createNextRequest("/api/webhooks/fanvue", {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await webhookGet(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    expect(Array.isArray(body.events)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(typeof body.returned).toBe("number");
  });

  it("filters events by type", async () => {
    // Post a known event type
    await webhookPost(createWebhookRequest("tip-received", {
      tip: { amount: 100 },
    }));

    const request = createNextRequest("/api/webhooks/fanvue", {
      searchParams: { type: "tip-received" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await webhookGet(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    const events = body.events as Array<Record<string, unknown>>;
    // All returned events should be tip-received
    for (const event of events) {
      expect(event.type).toBe("tip-received");
    }
  });

  it("filters events by since timestamp", async () => {
    const futureTime = new Date(Date.now() + 60_000).toISOString();
    const request = createNextRequest("/api/webhooks/fanvue", {
      searchParams: { since: futureTime },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await webhookGet(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    // Should return 0 events since we're asking for events after future time
    expect(body.events).toEqual([]);
  });

  it("limits results to 50 events", async () => {
    // The implementation caps at 50 — this just verifies the response shape
    const request = createNextRequest("/api/webhooks/fanvue", {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await webhookGet(request);
    expect(response.status).toBe(200);

    const body = await parseResponse(response) as Record<string, unknown>;
    const events = body.events as unknown[];
    expect(events.length).toBeLessThanOrEqual(50);
  });

  it("ignores invalid type filter gracefully", async () => {
    const request = createNextRequest("/api/webhooks/fanvue", {
      searchParams: { type: "invalid-type" },
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const response = await webhookGet(request);
    expect(response.status).toBe(200);

    // Should return all events (filter not applied for invalid type)
    const body = await parseResponse(response) as Record<string, unknown>;
    expect(Array.isArray(body.events)).toBe(true);
  });
});
