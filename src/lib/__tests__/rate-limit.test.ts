import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, checkAuthRateLimit, rateLimitHeaders, RATE_LIMITS } from '@/lib/rate-limit';

function createMockRequest(ip = '1.2.3.4', headers: Record<string, string> = {}) {
  return {
    headers: {
      get(name: string) {
        if (name.toLowerCase() === 'x-forwarded-for') return ip;
        return headers[name] ?? null;
      },
    },
  } as unknown as Request;
}

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const req = createMockRequest('10.0.0.1');
    const result = checkRateLimit(req, { maxRequests: 5, windowMs: 60_000 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it('tracks remaining tokens across multiple requests', () => {
    const req = createMockRequest('10.0.0.2');
    const config = { maxRequests: 3, windowMs: 60_000 };

    const r1 = checkRateLimit(req, config);
    expect(r1.remaining).toBe(2);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit(req, config);
    expect(r2.remaining).toBe(1);
    expect(r2.allowed).toBe(true);

    const r3 = checkRateLimit(req, config);
    expect(r3.remaining).toBe(0);
    expect(r3.allowed).toBe(true);
  });

  it('rejects requests once tokens are exhausted', () => {
    const req = createMockRequest('10.0.0.3');
    const config = { maxRequests: 2, windowMs: 60_000 };

    checkRateLimit(req, config);
    checkRateLimit(req, config);

    const r3 = checkRateLimit(req, config);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('isolates limits by IP (different IPs get independent buckets)', () => {
    const req1 = createMockRequest('10.0.0.10');
    const req2 = createMockRequest('10.0.0.11');
    const config = { maxRequests: 2, windowMs: 60_000 };

    // Exhaust for IP 10.0.0.10
    checkRateLimit(req1, config);
    checkRateLimit(req1, config);
    expect(checkRateLimit(req1, config).allowed).toBe(false);

    // IP 10.0.0.11 should still have tokens
    expect(checkRateLimit(req2, config).allowed).toBe(true);
  });

  it('uses a custom identifier when provided', () => {
    const req1 = createMockRequest('10.0.0.20');
    const req2 = createMockRequest('10.0.0.21');
    const config = { maxRequests: 1, windowMs: 60_000, identifier: 'shared-key' };

    // Both requests share the same identifier bucket
    checkRateLimit(req1, config);
    expect(checkRateLimit(req2, config).allowed).toBe(false);
  });

  it('uses x-real-ip header when x-forwarded-for is not present', () => {
    const req = {
      headers: {
        get(name: string) {
          if (name === 'x-forwarded-for') return null;
          if (name === 'x-real-ip') return '5.6.7.8';
          return null;
        },
      },
    } as unknown as Request;

    const result = checkRateLimit(req, { maxRequests: 1, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
  });

  it('returns correct resetAt timestamp', () => {
    const req = createMockRequest('10.0.0.30');
    const before = Date.now();
    const result = checkRateLimit(req, { maxRequests: 10, windowMs: 60_000 });

    // resetAt should be roughly now + windowMs
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60_000);
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 60_000 + 100);
  });
});

describe('checkAuthRateLimit', () => {
  it('uses tier presets correctly', () => {
    const req = createMockRequest('10.0.0.40');
    const result = checkAuthRateLimit(req, { tier: 'expensive', userId: 'user-1' });

    // Expensive tier: 5 requests per 60s
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(RATE_LIMITS.expensive.maxRequests);
    expect(result.remaining).toBe(RATE_LIMITS.expensive.maxRequests - 1);
  });

  it('uses per-user limiting with userId', () => {
    const req = createMockRequest('10.0.0.50');
    const config = { tier: 'expensive' as const, userId: 'user-a' };

    // Exhaust tokens for user-a
    for (let i = 0; i < RATE_LIMITS.expensive.maxRequests; i++) {
      checkAuthRateLimit(req, config);
    }
    expect(checkAuthRateLimit(req, config).allowed).toBe(false);

    // Same IP, different user should be allowed
    const result = checkAuthRateLimit(req, { tier: 'expensive', userId: 'user-b' });
    expect(result.allowed).toBe(true);
  });

  it('falls back to defaults when no tier is specified', () => {
    const req = createMockRequest('10.0.0.60');
    const result = checkAuthRateLimit(req, {});

    // Default: 30 requests per 60s
    expect(result.limit).toBe(30);
    expect(result.allowed).toBe(true);
  });
});

describe('rateLimitHeaders', () => {
  it('returns correct header object', () => {
    const result = {
      allowed: true,
      remaining: 15,
      resetAt: Date.now() + 30_000,
      limit: 30,
      resetAfterSeconds: 30,
    };
    const headers = rateLimitHeaders(result);

    expect(headers['X-RateLimit-Limit']).toBe('30');
    expect(headers['X-RateLimit-Remaining']).toBe('15');
    expect(headers['X-RateLimit-Reset']).toBe('30');
  });
});

describe('RATE_LIMITS presets', () => {
  it('has expected tier configurations', () => {
    expect(RATE_LIMITS.public.maxRequests).toBe(30);
    expect(RATE_LIMITS.authenticated.maxRequests).toBe(60);
    expect(RATE_LIMITS.expensive.maxRequests).toBe(5);
    expect(RATE_LIMITS.webhook.maxRequests).toBe(120);
  });
});
