/**
 * Simple in-memory rate limiter for serverless environments.
 * Uses a sliding window per IP address.
 * 
 * NOTE: In-memory only — resets on cold starts. For production with multiple
 * instances, use Vercel KV or Redis. This is sufficient for Vercel Hobby (single instance).
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30; // per window

export interface RateLimitConfig {
  /** Time window in milliseconds (default: 60000 = 1 min) */
  windowMs?: number;
  /** Max requests per window (default: 30) */
  maxRequests?: number;
  /** Custom identifier (defaults to IP) */
  identifier?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate limited.
 * Call this at the top of your API route handler.
 *
 * @example
 * ```ts
 * const rateLimit = checkRateLimit(request, { maxRequests: 10 });
 * if (!rateLimit.allowed) {
 *   return NextResponse.json({ error: "Too many requests" }, {
 *     status: 429,
 *     headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
 *   });
 * }
 * ```
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig = {}
): RateLimitResult {
  const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = config.maxRequests ?? DEFAULT_MAX_REQUESTS;

  // Extract identifier: custom > forwarded IP > fallback
  const identifier = config.identifier ?? extractIP(request);

  const now = Date.now();
  let entry = store.get(identifier);

  if (!entry) {
    entry = { tokens: maxRequests - 1, lastRefill: now };
    store.set(identifier, entry);
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  // Refill tokens based on elapsed time
  const elapsed = now - entry.lastRefill;
  if (elapsed >= windowMs) {
    // Window expired — reset
    entry.tokens = maxRequests - 1;
    entry.lastRefill = now;
  } else {
    // Partial refill (proportional to time elapsed)
    const refillAmount = Math.floor((elapsed / windowMs) * maxRequests);
    entry.tokens = Math.min(maxRequests, entry.tokens + refillAmount);
    entry.lastRefill = now;
  }

  if (entry.tokens <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.lastRefill + windowMs,
    };
  }

  entry.tokens -= 1;
  return {
    allowed: true,
    remaining: entry.tokens,
    resetAt: entry.lastRefill + windowMs,
  };
}

/** Extract client IP from request headers */
function extractIP(request: Request): string {
  // Vercel / CF / standard proxy headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP.trim();

  return "unknown";
}

// Cleanup old entries every 5 minutes to prevent memory leaks
if (typeof globalThis !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.lastRefill > DEFAULT_WINDOW_MS * 2) {
        store.delete(key);
      }
    }
  }, 300_000);
}
