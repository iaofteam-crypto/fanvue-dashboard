/**
 * @module /api/integrations/webhook-relay
 * @description Webhook relay management and event forwarding.
 * GET: List relay targets or relay log (?view=log|stats)
 * POST: Create relay target or relay event (?view=relay)
 * PATCH: Update a relay target
 * DELETE: Delete a relay target
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyOrigin, rateLimitResponse } from "@/lib/security";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeString, sanitizeUrl } from "@/lib/sanitize";
import {
  listRelayTargets,
  createRelayTarget,
  updateRelayTarget,
  deleteRelayTarget,
  relayEvent,
  getRelayLog,
  getIntegrationsStoreStats,
} from "@/lib/integrations-store";

export async function GET(request: NextRequest) {
  const rateResult = checkRateLimit(request, { maxRequests: 60 });
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");

  if (view === "log") {
    const targetId = searchParams.get("targetId") ?? undefined;
    const eventType = searchParams.get("eventType") ?? undefined;
    const sinceParam = searchParams.get("since");
    const since = sinceParam ? Number(sinceParam) : undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Number(limitParam), 100) : 50;

    const log = getRelayLog({ targetId, eventType, limit, since });
    return NextResponse.json({ log, count: log.length });
  }

  if (view === "stats") {
    const stats = getIntegrationsStoreStats();
    return NextResponse.json(stats);
  }

  const targets = listRelayTargets();
  return NextResponse.json({ targets, count: targets.length });
}

export async function POST(request: NextRequest) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateResult = checkRateLimit(request, { maxRequests: 10 });
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  try {
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // If "eventType" present → relay an event to all targets
    if (body.eventType && body.payload) {
      const relayRateResult = checkRateLimit(request, { maxRequests: 30 });
      if (!relayRateResult.allowed) {
        return rateLimitResponse(relayRateResult.resetAt, relayRateResult.limit);
      }

      const eventType = sanitizeString(body.eventType as string, 50);
      const results = await relayEvent(eventType, body.payload);
      const successCount = results.filter((r) => r.success).length;

      return NextResponse.json({
        relayed: results.length,
        success: successCount,
        failed: results.length - successCount,
        results,
      });
    }

    // Otherwise → create relay target
    const name = sanitizeString(body.name as string, 100);
    const url = sanitizeUrl(body.url as string);
    const secret = typeof body.secret === "string" ? body.secret : undefined;
    const events = body.events as string[] | undefined;

    const result = createRelayTarget({
      name,
      url,
      secret: secret || undefined,
      events: (events ?? []) as Array<"message-received" | "message-read" | "new-follower" | "new-subscriber" | "tip-received">,
    });

    if ("error" in result) {
      return NextResponse.json({ detail: result.error }, { status: 400 });
    }

    return NextResponse.json({ target: result.target }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateResult = checkRateLimit(request, { maxRequests: 10 });
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  try {
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const id = sanitizeString(body.id as string, 100);
    if (!id) {
      return NextResponse.json({ detail: "Target ID is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = sanitizeString(body.name as string, 100);
    if (body.url !== undefined) updates.url = sanitizeUrl(body.url as string);
    if (body.secret !== undefined) updates.secret = typeof body.secret === "string" ? body.secret : undefined;
    if (body.events !== undefined) updates.events = body.events;
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);

    const result = updateRelayTarget(
      id,
      updates as Parameters<typeof updateRelayTarget>[1]
    );

    if ("error" in result) {
      return NextResponse.json({ detail: result.error }, { status: 400 });
    }

    return NextResponse.json({ target: result.target });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateResult = checkRateLimit(request, { maxRequests: 10 });
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ detail: "Target ID query parameter is required" }, { status: 400 });
    }

    const result = deleteRelayTarget(id);
    if ("error" in result) {
      return NextResponse.json({ detail: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
