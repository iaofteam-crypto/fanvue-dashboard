/**
 * /api/monitoring/alerts — Alert management endpoint
 *
 * GET: Query alerts (active, resolved, or all)
 * GET: Also returns configured alert rules (?view=rules)
 * DELETE: Clear all alerts (admin/debug)
 *
 * Rate limited: GET 60/min, DELETE 2/min
 */

import { NextRequest } from "next/server";
import { getAlerts, getAlertRules, clearAlerts } from "@/lib/monitoring";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin } from "@/lib/security";

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
  const view = searchParams.get("view");

  // Return alert rules configuration
  if (view === "rules") {
    return new Response(
      JSON.stringify({ rules: getAlertRules() }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  // Return alerts with optional filtering
  const activeOnly = searchParams.get("active") === "true";
  const limit = searchParams.has("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

  const result = getAlerts({ activeOnly, limit });

  return new Response(
    JSON.stringify(result),
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

  const cleared = clearAlerts();

  return new Response(
    JSON.stringify({ cleared, message: `Cleared ${cleared} alert entries` }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
