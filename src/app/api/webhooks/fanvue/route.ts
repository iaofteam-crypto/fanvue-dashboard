// Fanvue Webhook Endpoint
// Receives real-time events from Fanvue via HMAC-SHA256 verified POST requests.
// Supported events: message-received, message-read, new-follower, new-subscriber, tip-received
//
// Setup: Fanvue Developer Area → App → Webhooks tab → Enter this URL → Enable
// Env: FANVUE_WEBHOOK_SECRET (required)

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeErrorMessage } from "@/lib/security";

// ─── Configuration ──────────────────────────────────────────────────────────

const WEBHOOK_SECRET = process.env.FANVUE_WEBHOOK_SECRET;
const TOLERANCE_SECONDS = 300; // 5-minute window for replay protection

/** Fanvue webhook event types we recognize */
const VALID_EVENT_TYPES = [
  "message-received",
  "message-read",
  "new-follower",
  "new-subscriber",
  "tip-received",
] as const;

type FanvueEventType = (typeof VALID_EVENT_TYPES)[number];

/** A stored webhook event for in-memory log */
export interface WebhookEvent {
  id: string;
  type: FanvueEventType;
  receivedAt: string;
  payload: Record<string, unknown>;
}

// ─── In-Memory Event Store ──────────────────────────────────────────────────
// NOTE: In-memory only — resets on cold starts. For production persistence,
// store events in Vercel KV, a database, or push to a message queue.
// This is sufficient for Vercel Hobby + real-time SSE/polling layer.

const MAX_STORED_EVENTS = 200;
const eventStore: WebhookEvent[] = [];

/** Add an event to the in-memory store (newest first, capped) */
function storeEvent(event: WebhookEvent): void {
  eventStore.unshift(event);
  if (eventStore.length > MAX_STORED_EVENTS) {
    eventStore.length = MAX_STORED_EVENTS;
  }
}

// ─── Signature Verification ─────────────────────────────────────────────────

/**
 * Verify the HMAC-SHA256 signature from the X-Fanvue-Signature header.
 * Format: t={unix_timestamp},v0={hmac_hex}
 *
 * Steps:
 * 1. Extract timestamp (t) and signature (v0) from header
 * 2. Check timestamp is within tolerance window (anti-replay)
 * 3. Construct signed payload: "{timestamp}.{rawBody}"
 * 4. Compute expected HMAC-SHA256 hex digest
 * 5. Timing-safe compare to prevent timing attacks
 */
function verifySignature(
  payload: string,
  signatureHeader: string
): { valid: boolean; reason: string } {
  if (!WEBHOOK_SECRET) {
    return { valid: false, reason: "FANVUE_WEBHOOK_SECRET not configured" };
  }

  if (!signatureHeader) {
    return { valid: false, reason: "Missing X-Fanvue-Signature header" };
  }

  // Parse "t={timestamp},v0={signature}" format
  const parts = signatureHeader.split(",");
  let timestampStr: string | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key === "t") timestampStr = value;
    if (key === "v0") signature = value;
  }

  if (!timestampStr || !signature) {
    return { valid: false, reason: "Invalid signature format: missing t or v0" };
  }

  // Check timestamp within tolerance (anti-replay)
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, reason: "Invalid timestamp in signature" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) {
    return {
      valid: false,
      reason: `Timestamp outside tolerance: diff=${Math.abs(now - timestamp)}s, max=${TOLERANCE_SECONDS}s`,
    };
  }

  // Compute expected HMAC-SHA256
  const signedPayload = `${timestampStr}.${payload}`;
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");

  // Timing-safe comparison
  try {
    const expectedBuf = Buffer.from(expected, "utf-8");
    const receivedBuf = Buffer.from(signature, "utf-8");

    if (expectedBuf.length !== receivedBuf.length) {
      return { valid: false, reason: "Signature length mismatch" };
    }

    if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return { valid: false, reason: "Signature mismatch" };
    }

    return { valid: true, reason: "ok" };
  } catch {
    return { valid: false, reason: "Signature comparison failed" };
  }
}

// ─── Event Validation ───────────────────────────────────────────────────────

/** Validate the event payload has required fields */
function validateEventPayload(
  eventType: FanvueEventType,
  body: Record<string, unknown>
): string | null {
  switch (eventType) {
    case "message-received":
      if (!body.messageUuid || typeof body.messageUuid !== "string") {
        return "message-received requires 'messageUuid' (string)";
      }
      break;

    case "message-read":
      if (!body.messageUuid || typeof body.messageUuid !== "string") {
        return "message-read requires 'messageUuid' (string)";
      }
      break;

    case "new-follower":
      if (!body.follower || typeof body.follower !== "object") {
        return "new-follower requires 'follower' (object)";
      }
      break;

    case "new-subscriber":
      if (!body.subscriber || typeof body.subscriber !== "object") {
        return "new-subscriber requires 'subscriber' (object)";
      }
      break;

    case "tip-received":
      if (!body.tip || typeof body.tip !== "object") {
        return "tip-received requires 'tip' (object)";
      }
      break;
  }

  return null; // valid
}

// ─── POST Handler: Receive Webhook Event ────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limit: allow 120 webhooks per minute per IP (generous for Fanvue servers)
  const rateLimit = checkRateLimit(request, { maxRequests: 120 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many webhook requests" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  try {
    // Read raw body for signature verification (must be exact bytes)
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("X-Fanvue-Signature") ?? "";

    // Verify HMAC-SHA256 signature
    const sigResult = verifySignature(rawBody, signatureHeader);
    if (!sigResult.valid) {
      console.warn(`[webhook] Signature verification failed: ${sigResult.reason}`);
      return NextResponse.json(
        { error: "Invalid signature", detail: sigResult.reason },
        { status: 401 }
      );
    }

    // Parse event payload
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Validate event type
    const eventType = body.type as string | undefined;
    if (!eventType || !(VALID_EVENT_TYPES as readonly string[]).includes(eventType)) {
      return NextResponse.json(
        {
          error: `Unknown event type: ${eventType ?? "missing"}`,
          validTypes: VALID_EVENT_TYPES,
        },
        { status: 400 }
      );
    }

    // Validate payload for known event type
    const validationError = validateEventPayload(
      eventType as FanvueEventType,
      body
    );
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    // Store the event in memory
    const storedEvent: WebhookEvent = {
      id: crypto.randomUUID(),
      type: eventType as FanvueEventType,
      receivedAt: new Date().toISOString(),
      payload: body,
    };
    storeEvent(storedEvent);

    console.log(
      `[webhook] Received: ${eventType} | id=${storedEvent.id} | store_size=${eventStore.length}`
    );

    // Respond quickly — Fanvue expects 200 within timeout
    return NextResponse.json({
      received: true,
      eventId: storedEvent.id,
      type: eventType,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[webhook] Error processing event: ${msg}`);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

// ─── GET Handler: Retrieve Stored Events ────────────────────────────────────
// Allows the frontend to poll for recent webhook events for real-time updates.
// No CSRF check needed — this is a read-only polling endpoint.

export async function GET(request: NextRequest) {
  // Rate limit: allow 60 polls per minute per client
  const rateLimit = checkRateLimit(request, { maxRequests: 60 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many polling requests" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }

  // Optional query param: ?since=ISO_TIMESTAMP to get events after a given time
  const sinceParam = request.nextUrl.searchParams.get("since");
  let events = eventStore;

  if (sinceParam) {
    const sinceDate = new Date(sinceParam).getTime();
    if (!isNaN(sinceDate)) {
      events = events.filter((e) => new Date(e.receivedAt).getTime() > sinceDate);
    }
  }

  // Optional query param: ?type=message-received to filter by event type
  const typeParam = request.nextUrl.searchParams.get("type");
  if (typeParam && (VALID_EVENT_TYPES as readonly string[]).includes(typeParam)) {
    events = events.filter((e) => e.type === typeParam);
  }

  // Limit to 50 events per response
  const limited = events.slice(0, 50);

  return NextResponse.json({
    events: limited,
    total: events.length,
    returned: limited.length,
  });
}

// ─── Utility: Export event store for internal use ───────────────────────────
// Can be imported by other modules (e.g., SSE endpoint, sync trigger)

export function getStoredEvents(): WebhookEvent[] {
  return [...eventStore];
}

export function getStoredEventById(id: string): WebhookEvent | undefined {
  return eventStore.find((e) => e.id === id);
}
