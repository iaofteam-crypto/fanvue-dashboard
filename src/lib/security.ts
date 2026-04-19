import { NextRequest, NextResponse } from "next/server";

/**
 * Verify the request origin matches the expected host.
 * Prevents CSRF attacks on state-changing endpoints.
 *
 * In Vercel Hobby (no custom domain), the host is always the Vercel URL.
 * For local dev, we allow localhost.
 *
 * @param request - The incoming Next.js request object.
 * @returns `true` if the origin is allowed, `false` if it should be rejected.
 *
 * @example
 * ```ts
 * if (!verifyOrigin(request)) {
 *   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 * }
 * ```
 */
export function verifyOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // No origin header (non-browser requests like curl, server-to-server)
  if (!origin) return true;

  // Allow same-origin requests
  if (host && origin.includes(host)) return true;

  // Allow localhost for development
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) return true;

  // Allow Vercel preview and production domains
  if (origin.includes(".vercel.app")) return true;

  // Reject cross-origin requests
  return false;
}

/**
 * Sanitize error messages before sending to client.
 * Prevents leaking internal paths, stack traces, or sensitive info.
 *
 * @param error - The caught error value (any type).
 * @returns A safe, user-facing error string (truncated to 200 chars max).
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;

    // Common internal patterns that should NOT be exposed
    const internalPatterns = [
      /ECONNREFUSED/i,
      /ENOTFOUND/i,
      /fetch failed/i,
      /Cannot find module/i,
      /Unexpected token/i,
      /is not a function/i,
      /is not defined/i,
      /private field/i,
      /Cannot read propert(y|ies) of/i,
      /webpack/i,
      /node_modules/i,
    ];

    for (const pattern of internalPatterns) {
      if (pattern.test(msg)) {
        return "An internal error occurred. Please try again.";
      }
    }

    // If the message looks safe, return it (but truncate long messages)
    if (msg.length > 200) {
      return msg.slice(0, 200) + "...";
    }

    return msg;
  }

  return "An unexpected error occurred";
}

/**
 * Create a 429 rate-limit response with Retry-After and X-RateLimit-Reset headers.
 *
 * @param resetAt - Unix timestamp (ms) when the rate-limit window resets.
 * @returns A `NextResponse` with status 429 and rate-limit headers.
 */
export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(resetAt),
      },
    }
  );
}
