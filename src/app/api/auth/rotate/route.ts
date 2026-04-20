// Token Rotation API
// POST /api/auth/rotate — Force token rotation with grace period
// GET /api/auth/rotate — Get rotation history and grace period status
//
// When rotating:
// 1. Forces a refresh of the current token via Fanvue's refresh endpoint
// 2. Stores the old token in a grace period buffer (5 minutes)
// 3. Updates the primary token to the new one
// 4. During grace period, both old and new tokens are accepted
// 5. Logs the rotation event to the audit log

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getValidAccessToken, refreshAccessToken, setTokenCookie } from "@/lib/fanvue";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin, sanitizeErrorMessage, rateLimitResponse, withRateLimitHeaders } from "@/lib/security";
import { logAudit, extractAuditActor } from "@/lib/audit-log";
import { safeResponse, authRotateGetSchema, authRotatePostSchema } from "@/lib/response-schemas";

// ─── Grace Period Store ──────────────────────────────────────────────────
// During rotation, the old token is kept valid for GRACE_PERIOD_MS milliseconds.
// Requests bearing the old token are accepted but get a warning header.

interface GracePeriodEntry {
  oldToken: string;
  rotatedAt: string;
  expiresAt: string;
  rotatedBy: string;
}

const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
const MAX_GRACE_ENTRIES = 10;
const graceStore: GracePeriodEntry[] = [];

/** Add old token to grace period store */
function addGracePeriod(entry: GracePeriodEntry): void {
  graceStore.unshift(entry);
  if (graceStore.length > MAX_GRACE_ENTRIES) {
    graceStore.length = MAX_GRACE_ENTRIES;
  }
}

/** Check if a token is in the grace period (still valid but deprecated) */
export function isInGracePeriod(token: string): { valid: boolean; expiresAt: string | null } {
  const now = Date.now();
  for (const entry of graceStore) {
    if (entry.oldToken === token) {
      const expiresAt = new Date(entry.expiresAt).getTime();
      if (now < expiresAt) {
        return { valid: true, expiresAt: entry.expiresAt };
      }
    }
  }
  return { valid: false, expiresAt: null };
}

/** Clean up expired grace period entries */
function cleanupGraceEntries(): void {
  const now = Date.now();
  for (let i = graceStore.length - 1; i >= 0; i--) {
    if (new Date(graceStore[i].expiresAt).getTime() < now) {
      graceStore.splice(i, 1);
    }
  }
}

// ─── Rotation History ────────────────────────────────────────────────────

interface RotationEvent {
  id: string;
  rotatedAt: string;
  rotatedBy: string;
  status: "success" | "failed";
  reason: string;
  gracePeriodEndsAt: string;
}

const MAX_ROTATION_HISTORY = 20;
const rotationHistory: RotationEvent[] = [];

// ─── POST: Force Token Rotation ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Rate limit: user-based (2/min — expensive operation)
  const rateLimit = checkRateLimit(request, { tier: "user", maxRequests: 2 });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, rateLimit.limit);
  }

  // CSRF check
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  cleanupGraceEntries();

  const actor = extractAuditActor(request);

  try {
    // Get current token
    const currentToken = await db.oAuthToken.findUnique({
      where: { id: "fanvue_primary" },
    });

    if (!currentToken) {
      logAudit({
        category: "auth",
        severity: "warn",
        method: "POST",
        route: "/api/auth/rotate",
        action: "Token rotation attempted but no active session",
        status: "no_session",
        actor,
      });
      return NextResponse.json(
        { error: "No active session. Connect to Fanvue first." },
        { status: 400 }
      );
    }

    if (!currentToken.refreshToken) {
      logAudit({
        category: "auth",
        severity: "error",
        method: "POST",
        route: "/api/auth/rotate",
        action: "Token rotation failed: no refresh token",
        status: "no_refresh_token",
        actor,
      });
      return NextResponse.json(
        { error: "Cannot rotate: no refresh token available. Please reconnect." },
        { status: 400 }
      );
    }

    // Store old token for grace period BEFORE rotating
    const oldToken = currentToken.accessToken;
    const graceEndsAt = new Date(Date.now() + GRACE_PERIOD_MS).toISOString();

    addGracePeriod({
      oldToken,
      rotatedAt: new Date().toISOString(),
      expiresAt: graceEndsAt,
      rotatedBy: actor,
    });

    // Force refresh to get a new access token
    const newTokenData = await refreshAccessToken(currentToken.refreshToken);

    const newExpiresAt = new Date(Date.now() + newTokenData.expires_in * 1000).toISOString();

    // Update stored token
    const updated = await db.oAuthToken.update({
      where: { id: "fanvue_primary" },
      data: {
        accessToken: newTokenData.access_token,
        refreshToken: newTokenData.refresh_token || currentToken.refreshToken,
        expiresIn: newTokenData.expires_in,
        expiresAt: newExpiresAt,
      },
    });

    // Record rotation event
    const rotationEvent: RotationEvent = {
      id: crypto.randomUUID(),
      rotatedAt: new Date().toISOString(),
      rotatedBy: actor,
      status: "success",
      reason: "manual_rotation",
      gracePeriodEndsAt: graceEndsAt,
    };
    rotationHistory.unshift(rotationEvent);
    if (rotationHistory.length > MAX_ROTATION_HISTORY) {
      rotationHistory.length = MAX_ROTATION_HISTORY;
    }

    // Audit log
    logAudit({
      category: "auth",
      severity: "info",
      method: "POST",
      route: "/api/auth/rotate",
      action: "Token rotation completed successfully",
      status: "success",
      actor,
      metadata: {
        gracePeriodMinutes: GRACE_PERIOD_MS / 60_000,
        newExpiresIn: newTokenData.expires_in,
        oldTokenPrefix: oldToken.slice(0, 8),
      },
    });

    // Build response with new cookie
    const gracePeriodEnds = graceEndsAt;

    const response = safeResponse(authRotatePostSchema, {
      success: true as const,
      rotated: true as const,
      newExpiresAt,
      gracePeriodEndsAt: gracePeriodEnds,
      gracePeriodMinutes: GRACE_PERIOD_MS / 60_000,
      message: "Token rotated successfully. Old token remains valid for 5 minutes during grace period.",
    });

    // Update cookie with new token
    setTokenCookie(response, {
      accessToken: updated.accessToken,
      refreshToken: updated.refreshToken,
      expiresIn: updated.expiresIn,
      expiresAt: updated.expiresAt,
      scope: updated.scope,
    });

    // Set grace period header so client knows old token is still valid
    response.headers.set("X-Token-Grace-Period", graceEndsAt);
    response.headers.set("X-Token-Rotated", "true");

    return withRateLimitHeaders(response, rateLimit);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    // Record failed rotation
    const failEvent: RotationEvent = {
      id: crypto.randomUUID(),
      rotatedAt: new Date().toISOString(),
      rotatedBy: actor,
      status: "failed",
      reason: msg.slice(0, 200),
      gracePeriodEndsAt: new Date().toISOString(),
    };
    rotationHistory.unshift(failEvent);

    logAudit({
      category: "auth",
      severity: "error",
      method: "POST",
      route: "/api/auth/rotate",
      action: "Token rotation failed",
      status: msg.slice(0, 100),
      actor,
    });

    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

// ─── GET: Rotation History ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Rate limit: user-based (30/min)
  const rateLimit = checkRateLimit(request, { tier: "user", maxRequests: 30 });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, rateLimit.limit);
  }

  cleanupGraceEntries();

  try {
    // Check current session info
    const token = await db.oAuthToken.findUnique({
      where: { id: "fanvue_primary" },
    });

    const activeGraceEntries = graceStore.filter(
      (e) => new Date(e.expiresAt).getTime() > Date.now()
    );

    return withRateLimitHeaders(safeResponse(authRotateGetSchema, {
      connected: !!token,
      tokenInfo: token ? {
        expiresAt: token.expiresAt,
        updatedAt: token.updatedAt,
        scope: token.scope,
        isExpired: token.expiresAt ? new Date(token.expiresAt) < new Date() : false,
      } : null,
      gracePeriodActive: activeGraceEntries.length > 0,
      activeGraceCount: activeGraceEntries.length,
      rotationHistory: rotationHistory.map((e) => ({
        id: e.id,
        rotatedAt: e.rotatedAt,
        rotatedBy: e.rotatedBy,
        status: e.status,
        reason: e.reason,
        gracePeriodEndsAt: e.gracePeriodEndsAt,
      })),
    }), rateLimit);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}
