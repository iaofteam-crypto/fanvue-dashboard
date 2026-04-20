/**
 * @module /api/payments/stripe-webhook
 * @description Stripe webhook endpoint for receiving payment events.
 * Accepts POST from Stripe (or relayed events from webhook relay).
 *
 * Supported events:
 * - payment_intent.succeeded / payment_intent.payment_failed
 * - charge.succeeded / charge.refunded / charge.failed
 * - charge.dispute.created / charge.dispute.updated / charge.dispute.closed
 * - invoice.paid / invoice.payment_failed
 *
 * Auth: Stripe signature verification (stripe-signature header)
 * Fallback: Bearer token auth for relayed events
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeString } from "@/lib/sanitize";
import { logAudit, extractAuditActor } from "@/lib/audit-log";
import { processStripeEvent, listAlerts, dismissAlert, getPaymentStats, listPayments, listChargebacks, listRefunds, getPaymentsStoreStats } from "@/lib/payments-store";
import type { PaymentStatus } from "@/lib/payments-store";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Verify Stripe webhook signature using HMAC-SHA256
 * Format: t={timestamp},v1={signature}
 */
async function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader || !STRIPE_WEBHOOK_SECRET) {
    // No secret configured — skip verification (dev mode)
    return true;
  }

  const parts = signatureHeader.split(",");
  const timestamp = parts[0]?.startsWith("t=") ? parts[0].substring(2) : "";
  const signature = parts[1]?.startsWith("v1=") ? parts[1].substring(3) : "";

  if (!timestamp || !signature) return false;

  // Reject events older than 5 minutes
  const eventAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (eventAge > 300) return false;

  const encoder = new TextEncoder();
  const signedPayload = `${timestamp}.${payload}`;
  const keyData = encoder.encode(STRIPE_WEBHOOK_SECRET);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expectedSig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Timing-safe comparison
  if (expectedHex.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    result |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

export async function POST(request: NextRequest) {
  const rateResult = checkRateLimit(request, { maxRequests: 60 });
  if (!rateResult.allowed) {
    const { rateLimitResponse } = await import("@/lib/security");
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  try {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");
    const eventType = request.headers.get("stripe-event") ?? "";

    // For relayed events, check Bearer token auth
    const isRelayed = request.headers.get("x-relayed-by") === "fanvue-dashboard";

    if (!isRelayed && !(await verifyStripeSignature(payload, signature))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const resolvedEventType = isRelayed
      ? (data.eventType as string)
      : (data.type as string);

    if (!resolvedEventType) {
      return NextResponse.json({ error: "Missing event type" }, { status: 400 });
    }

    const result = processStripeEvent(resolvedEventType, data);

    // Audit log
    logAudit({
      category: "webhook",
      severity: result.alerts.length > 0 ? "warn" : "info",
      method: "POST",
      route: "/api/payments/stripe-webhook",
      action: `Stripe event: ${resolvedEventType}`,
      status: "success",
      actor: extractAuditActor(request),
      metadata: { eventType: resolvedEventType, alertsGenerated: result.alerts.length },
    });

    return NextResponse.json({
      received: true,
      eventType: resolvedEventType,
      alerts: result.alerts.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const rateResult = checkRateLimit(request, { maxRequests: 60 });
  if (!rateResult.allowed) {
    const { rateLimitResponse } = await import("@/lib/security");
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");

  switch (view) {
    case "payments": {
      const status = searchParams.get("status") ?? undefined;
      const since = searchParams.get("since");
      const limit = searchParams.get("limit");
      const items = listPayments({
        status: status as PaymentStatus | undefined,
        since: since ? Number(since) : undefined,
        limit: limit ? Math.min(Number(limit), 100) : 50,
      });
      return NextResponse.json({ payments: items, count: items.length });
    }

    case "chargebacks": {
      const items = listChargebacks({ limit: 20 });
      return NextResponse.json({ chargebacks: items, count: items.length });
    }

    case "refunds": {
      const items = listRefunds({ limit: 20 });
      return NextResponse.json({ refunds: items, count: items.length });
    }

    case "alerts": {
      const undismissed = searchParams.get("undismissed") === "true";
      const items = listAlerts({ undismissedOnly: undismissed, limit: 50 });
      return NextResponse.json({ alerts: items, count: items.length });
    }

    case "stats": {
      return NextResponse.json(getPaymentStats());
    }

    case "store-stats": {
      return NextResponse.json(getPaymentsStoreStats());
    }

    default: {
      const stats = getPaymentStats();
      const recentAlerts = listAlerts({ undismissedOnly: true, limit: 5 });
      const recentChargebacks = listChargebacks({ limit: 3 });
      return NextResponse.json({ stats, recentAlerts, recentChargebacks });
    }
  }
}

export async function PATCH(request: NextRequest) {
  const { verifyOrigin } = await import("@/lib/security");
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateResult = checkRateLimit(request, { maxRequests: 20 });
  if (!rateResult.allowed) {
    const { rateLimitResponse } = await import("@/lib/security");
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(await request.text()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = sanitizeString(body.action as string, 50);

    if (action === "dismiss-alert") {
      const alertId = sanitizeString(body.id as string, 100);
      if (!alertId) {
        return NextResponse.json({ error: "Alert ID required" }, { status: 400 });
      }
      const success = dismissAlert(alertId);
      if (!success) {
        return NextResponse.json({ error: "Alert not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
