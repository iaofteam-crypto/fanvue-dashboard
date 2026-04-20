// Audit Logs API — GET to query, DELETE to clear (admin only)
//
// GET /api/audit-logs — query audit log with filters
//   ?category=delete&severity=error&method=DELETE&routePrefix=/api/fanvue
//   &since=2026-04-19T00:00:00Z&until=2026-04-19T23:59:59Z&limit=50&offset=0
//
// GET /api/audit-logs/stats — summary statistics
//
// DELETE /api/audit-logs — clear all audit logs (protected)

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin, sanitizeErrorMessage, rateLimitResponse, withRateLimitHeaders } from "@/lib/security";
import { sanitizeString } from "@/lib/sanitize";
import {
  queryAuditLogs,
  getAuditStats,
  clearAuditLogs,
  type AuditCategory,
  type AuditSeverity,
} from "@/lib/audit-log";
import { safeResponse, auditLogsGetSchema, auditLogStatsSchema, auditLogsDeleteSchema } from "@/lib/response-schemas";

const VALID_CATEGORIES: AuditCategory[] = [
  "auth", "delete", "update", "upload", "webhook", "sync", "security", "ai", "read",
];

const VALID_SEVERITIES: AuditSeverity[] = ["info", "warn", "error", "critical"];

export async function GET(request: NextRequest) {
  // Rate limit: user-based (30/min base, 60/min for authed)
  const rateLimit = checkRateLimit(request, { tier: "user", maxRequests: 30 });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, rateLimit.limit);
  }

  try {
    // Check if requesting stats
    const pathname = request.nextUrl.pathname;
    if (pathname.endsWith("/stats")) {
      const stats = getAuditStats();
      return withRateLimitHeaders(safeResponse(auditLogStatsSchema, stats), rateLimit);
    }

    // Parse query params with sanitization
    const rawCategory = sanitizeString(request.nextUrl.searchParams.get("category") ?? "", 20);
    const rawSeverity = sanitizeString(request.nextUrl.searchParams.get("severity") ?? "", 20);
    const rawMethod = sanitizeString(request.nextUrl.searchParams.get("method") ?? "", 10);
    const rawRoutePrefix = sanitizeString(request.nextUrl.searchParams.get("routePrefix") ?? "", 200);
    const rawActor = sanitizeString(request.nextUrl.searchParams.get("actor") ?? "", 100);
    const rawSince = sanitizeString(request.nextUrl.searchParams.get("since") ?? "", 30);
    const rawUntil = sanitizeString(request.nextUrl.searchParams.get("until") ?? "", 30);
    const rawLimit = request.nextUrl.searchParams.get("limit");
    const rawOffset = request.nextUrl.searchParams.get("offset");

    // Build query with validation
    const query: Parameters<typeof queryAuditLogs>[0] = {};

    if (rawCategory && (VALID_CATEGORIES as readonly string[]).includes(rawCategory)) {
      query.category = rawCategory as AuditCategory;
    }

    if (rawSeverity && (VALID_SEVERITIES as readonly string[]).includes(rawSeverity)) {
      query.severity = rawSeverity as AuditSeverity;
    }

    if (rawMethod && ["GET", "POST", "PATCH", "DELETE", "PUT"].includes(rawMethod.toUpperCase())) {
      query.method = rawMethod;
    }

    if (rawRoutePrefix) {
      query.routePrefix = rawRoutePrefix;
    }

    if (rawActor) {
      query.actor = rawActor;
    }

    if (rawSince) {
      query.since = rawSince;
    }

    if (rawUntil) {
      query.until = rawUntil;
    }

    if (rawLimit) {
      const limitNum = parseInt(rawLimit, 10);
      if (!isNaN(limitNum) && limitNum >= 1 && limitNum <= 200) {
        query.limit = limitNum;
      }
    }

    if (rawOffset) {
      const offsetNum = parseInt(rawOffset, 10);
      if (!isNaN(offsetNum) && offsetNum >= 0) {
        query.offset = offsetNum;
      }
    }

    const result = queryAuditLogs(query);
    return withRateLimitHeaders(safeResponse(auditLogsGetSchema, result), rateLimit);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // Rate limit: user-based (2/min — destructive operation)
  const rateLimit = checkRateLimit(request, { tier: "user", maxRequests: 2 });
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, rateLimit.limit);
  }

  // CSRF check on DELETE
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const cleared = clearAuditLogs();
    return withRateLimitHeaders(safeResponse(auditLogsDeleteSchema, {
      success: true as const,
      cleared,
      message: `Cleared ${cleared} audit log entries`,
    }), rateLimit);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}
