/**
 * /api/monitoring/metrics — Metrics collection and query endpoint
 *
 * GET: Query collected metrics with filtering and aggregation
 * POST: Record a custom metric
 * DELETE: Clear all metrics (admin/debug)
 *
 * Rate limited: GET 60/min, POST 30/min, DELETE 2/min
 * CSRF protection on write operations
 */

import { NextRequest } from "next/server";
import { queryMetrics, recordCustomMetric, clearMetrics, getMetricsStoreSize } from "@/lib/monitoring";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/security";
import { sanitizeString } from "@/lib/sanitize";

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = checkRateLimit(request, { maxRequests: 60 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
      },
    });
  }

  const { searchParams } = new URL(request.url);

  // Build query
  const query = {
    type: searchParams.get("type") as "api_request" | "dependency_check" | "custom" | null,
    route: searchParams.get("route") ?? undefined,
    statusCode: searchParams.has("statusCode")
      ? parseInt(searchParams.get("statusCode")!, 10)
      : undefined,
    dependency: searchParams.get("dependency") ?? undefined,
    name: searchParams.get("name") ?? undefined,
    since: searchParams.get("since") ?? undefined,
    until: searchParams.get("until") ?? undefined,
    limit: searchParams.has("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined,
    offset: searchParams.has("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined,
    aggregate: searchParams.get("aggregate") as
      | "none"
      | "by_route"
      | "by_status"
      | "by_minute"
      | null,
  };

  // Validate aggregate parameter
  if (
    query.aggregate &&
    !["none", "by_route", "by_status", "by_minute"].includes(query.aggregate)
  ) {
    return new Response(
      JSON.stringify({
        error: "Invalid aggregate parameter. Must be: none, by_route, by_status, by_minute",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate type parameter
  if (query.type && !["api_request", "dependency_check", "custom"].includes(query.type)) {
    return new Response(
      JSON.stringify({
        error: "Invalid type parameter. Must be: api_request, dependency_check, custom",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = queryMetrics({
    type: query.type ?? undefined,
    route: query.route,
    statusCode: query.statusCode,
    dependency: query.dependency,
    name: query.name,
    since: query.since,
    until: query.until,
    limit: query.limit,
    offset: query.offset,
    aggregate: query.aggregate ?? undefined,
  });

  return new Response(
    JSON.stringify({
      ...result,
      storeSize: getMetricsStoreSize(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    }
  );
}

export async function POST(request: NextRequest) {
  // CSRF protection
  if (!verifyOrigin(request)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limiting
  const rateLimit = checkRateLimit(request, { maxRequests: 30 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
      },
    });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = sanitizeString(body.name as string, 100);
    const value = typeof body.value === "number" ? body.value : 0;
    const unit = body.unit ? sanitizeString(body.unit as string, 20) : undefined;

    // Validate required fields
    if (!name) {
      return new Response(JSON.stringify({ error: "Missing required field: name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (typeof value !== "number" || isNaN(value)) {
      return new Response(JSON.stringify({ error: "Field 'value' must be a valid number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate tags if provided
    let tags: Record<string, string> | undefined;
    if (body.tags && typeof body.tags === "object") {
      tags = {};
      for (const [key, val] of Object.entries(body.tags)) {
        if (typeof val === "string" && key.length <= 50 && val.length <= 100) {
          tags[key] = sanitizeString(val, 100);
        }
      }
      if (Object.keys(tags).length === 0) tags = undefined;
    }

    recordCustomMetric({ name, value, unit, tags });

    return new Response(
      JSON.stringify({ recorded: true, name, value, unit, tags }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid JSON body";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE(request: NextRequest) {
  // CSRF protection
  if (!verifyOrigin(request)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limiting (very restrictive)
  const rateLimit = checkRateLimit(request, { maxRequests: 2 });
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
      },
    });
  }

  const cleared = clearMetrics();

  return new Response(
    JSON.stringify({ cleared, message: `Cleared ${cleared} metric entries` }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
