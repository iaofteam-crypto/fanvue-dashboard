/**
 * Enhanced in-memory rate limiter for serverless environments.
 * Supports IP-based and per-user (userId / token hash) rate limiting
 * with tiered presets for different endpoint categories.
 *
 * NOTE: In-memory only — resets on cold starts. For production with multiple
 * instances, use Vercel KV or Redis. This is sufficient for Vercel Hobby (single instance).
 */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  windowMs: number;
  maxRequests: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30; // per window

/**
 * Tiered rate limit presets for different endpoint categories.
 */
export const RATE_LIMITS = {
  /** Unauthenticated public endpoints */
  public: { maxRequests: 30, windowMs: 60_000 },
  /** Authenticated user endpoints */
  authenticated: { maxRequests: 60, windowMs: 60_000 },
  /** Expensive operations: chat, sync, upload */
  expensive: { maxRequests: 5, windowMs: 60_000 },
  /** Webhook ingestion endpoints */
  webhook: { maxRequests: 120, windowMs: 60_000 },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMITS;

export interface RateLimitConfig {
  /** Time window in milliseconds (default: 60000 = 1 min) */
  windowMs?: number;
  /** Max requests per window (default: 30) */
  maxRequests?: number;
  /** Custom identifier (defaults to IP) */
  identifier?: string;
}

export interface RateLimitAuthConfig {
  /** Tiered preset name */
  tier?: RateLimitTier;
  /** Time window in milliseconds (overrides tier preset) */
  windowMs?: number;
  /** Max requests per window (overrides tier preset) */
  maxRequests?: number;
  /** User ID or token hash for per-user limiting */
  userId?: string;
  /** Whether to also apply IP-based limiting in addition to user-based (default: false) */
  includeIP?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  /** The limit that applies to this request (for X-RateLimit-Limit header) */
  limit: number;
  /** Seconds until the window resets (for X-RateLimit-Reset header) */
  resetAfterSeconds: number;
}

/**
 * Build standard Rate-Limit response headers from a RateLimitResult.
 *
 * @param result - The rate-limit check result.
 * @returns An object with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
 *   `X-RateLimit-Reset` headers.
 *
 * @example
 * ```ts
 * const result = checkRateLimit(request, { maxRequests: 10 });
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: "Too many requests" },
 *     { status: 429, headers: rateLimitHeaders(result) },
 *   );
 * }
 * return NextResponse.json(data, { headers: rateLimitHeaders(result) });
 * ```
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAfterSeconds),
  };
}

/**
 * Check if a request should be rate limited (IP-based).
 * Call this at the top of your API route handler.
 *
 * @param request - The incoming request (IP is extracted from headers).
 * @param config - Optional configuration (window size, max requests, custom identifier).
 * @returns A {@link RateLimitResult} with `allowed`, `remaining`, and header metadata.
 *
 * @example
 * ```ts
 * const rateLimit = checkRateLimit(request, { maxRequests: 10 });
 * if (!rateLimit.allowed) {
 *   return NextResponse.json({ error: "Too many requests" }, {
 *     status: 429,
 *     headers: rateLimitHeaders(rateLimit),
 *   });
 * }
 * return NextResponse.json(data, { headers: rateLimitHeaders(rateLimit) });
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

  return consumeToken(identifier, maxRequests, windowMs);
}

/**
 * Check if a request should be rate limited with per-user granularity.
 * Combines userId (or token hash) and optionally IP into the rate limit key.
 *
 * @param request - The incoming request (IP extracted from headers when `includeIP` is set).
 * @param config - Auth-aware config with tier presets, userId, and optional IP limiting.
 * @returns A {@link RateLimitResult} with `allowed`, `remaining`, and header metadata.
 *
 * @example
 * ```ts
 * const result = checkAuthRateLimit(request, {
 *   tier: "authenticated",
 *   userId: session.user.id,
 * });
 * if (!result.allowed) {
 *   return NextResponse.json({ error: "Too many requests" }, {
 *     status: 429,
 *     headers: rateLimitHeaders(result),
 *   });
 * }
 * return NextResponse.json(data, { headers: rateLimitHeaders(result) });
 * ```
 */
export function checkAuthRateLimit(
  request: Request,
  config: RateLimitAuthConfig = {}
): RateLimitResult {
  // Resolve settings from tier preset or explicit overrides
  const preset = config.tier ? RATE_LIMITS[config.tier] : null;
  const windowMs = config.windowMs ?? preset?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = config.maxRequests ?? preset?.maxRequests ?? DEFAULT_MAX_REQUESTS;

  // Build composite identifier: user:<userId> or user:<userId>:ip:<ip>
  const parts: string[] = ["user", config.userId ?? "anonymous"];
  if (config.includeIP) {
    parts.push("ip", extractIP(request));
  }
  const identifier = parts.join(":");

  return consumeToken(identifier, maxRequests, windowMs);
}

/**
 * Core token-bucket consumption logic shared by both checkRateLimit and checkAuthRateLimit.
 */
function consumeToken(
  identifier: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let entry = store.get(identifier);

  if (!entry) {
    entry = { tokens: maxRequests - 1, lastRefill: now, windowMs, maxRequests };
    store.set(identifier, entry);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
      limit: maxRequests,
      resetAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  // Use the entry's own windowMs for consistent refill calculations
  const entryWindow = entry.windowMs;
  const entryMax = entry.maxRequests;

  // Refill tokens based on elapsed time
  const elapsed = now - entry.lastRefill;
  if (elapsed >= entryWindow) {
    // Window expired — reset
    entry.tokens = entryMax - 1;
    entry.lastRefill = now;
  } else {
    // Partial refill (proportional to time elapsed)
    const refillAmount = Math.floor((elapsed / entryWindow) * entryMax);
    entry.tokens = Math.min(entryMax, entry.tokens + refillAmount);
    entry.lastRefill = now;
  }

  const resetAfterSeconds = Math.ceil((entry.lastRefill + entryWindow - now) / 1000);

  if (entry.tokens <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.lastRefill + entryWindow,
      limit: entryMax,
      resetAfterSeconds,
    };
  }

  entry.tokens -= 1;
  return {
    allowed: true,
    remaining: entry.tokens,
    resetAt: entry.lastRefill + entryWindow,
    limit: entryMax,
    resetAfterSeconds,
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

// Cleanup old entries every 5 minutes to prevent memory leaks.
// Uses each entry's own windowMs so tiered limits clean up correctly.
if (typeof globalThis !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.lastRefill > entry.windowMs * 2) {
        store.delete(key);
      }
    }
  }, 300_000);
}
