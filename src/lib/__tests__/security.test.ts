import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeErrorMessage, verifyOrigin } from '@/lib/security';

// Minimal mock for NextRequest that satisfies the function signature.
// verifyOrigin only accesses request.headers.get(), so we just need that.
function createMockRequest(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name] ?? null;
      },
    },
  } as unknown as Parameters<typeof verifyOrigin>[0];
}

describe('sanitizeErrorMessage', () => {
  it('returns the message as-is for safe user-facing errors', () => {
    const err = new Error('Invalid password');
    expect(sanitizeErrorMessage(err)).toBe('Invalid password');
  });

  it('returns generic message for non-Error inputs', () => {
    expect(sanitizeErrorMessage('a string')).toBe('An unexpected error occurred');
    expect(sanitizeErrorMessage(42)).toBe('An unexpected error occurred');
    expect(sanitizeErrorMessage(null)).toBe('An unexpected error occurred');
    expect(sanitizeErrorMessage(undefined)).toBe('An unexpected error occurred');
  });

  it('replaces messages matching ECONNREFUSED pattern', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    expect(sanitizeErrorMessage(err)).toBe('An internal error occurred. Please try again.');
  });

  it('replaces messages matching ENOTFOUND pattern', () => {
    const err = new Error('getaddrinfo ENOTFOUND api.example.com');
    expect(sanitizeErrorMessage(err)).toBe('An internal error occurred. Please try again.');
  });

  it('replaces messages matching "fetch failed"', () => {
    const err = new Error('fetch failed');
    expect(sanitizeErrorMessage(err)).toBe('An internal error occurred. Please try again.');
  });

  it('replaces messages matching "Cannot find module"', () => {
    const err = new Error("Cannot find module './missing-file'");
    expect(sanitizeErrorMessage(err)).toBe('An internal error occurred. Please try again.');
  });

  it('replaces messages matching "webpack" or "node_modules"', () => {
    const errWebpack = new Error('Module not found in webpack resolve');
    expect(sanitizeErrorMessage(errWebpack)).toBe('An internal error occurred. Please try again.');

    const errNodeModules = new Error('Error in node_modules/some-pkg');
    expect(sanitizeErrorMessage(errNodeModules)).toBe('An internal error occurred. Please try again.');
  });

  it('replaces messages matching "Cannot read properties of"', () => {
    const err = new Error("Cannot read properties of undefined (reading 'name')");
    expect(sanitizeErrorMessage(err)).toBe('An internal error occurred. Please try again.');
  });

  it('replaces messages matching "is not a function"', () => {
    const err = new Error('callback is not a function');
    expect(sanitizeErrorMessage(err)).toBe('An internal error occurred. Please try again.');
  });

  it('truncates long safe messages to 200 characters', () => {
    const longMsg = 'A'.repeat(300);
    const err = new Error(longMsg);
    const result = sanitizeErrorMessage(err);
    expect(result).toHaveLength(203); // 200 chars + '...'
    expect(result).toMatch(/\.\.\.$/);
  });

  it('does not truncate messages at exactly 200 characters', () => {
    const msg = 'A'.repeat(200);
    const err = new Error(msg);
    expect(sanitizeErrorMessage(err)).toBe(msg);
    expect(sanitizeErrorMessage(err)).toHaveLength(200);
  });
});

describe('verifyOrigin', () => {
  it('returns true when there is no origin header (server-to-server)', () => {
    const req = createMockRequest({ host: 'myapp.com' });
    expect(verifyOrigin(req)).toBe(true);
  });

  it('returns true when origin matches host', () => {
    const req = createMockRequest({
      origin: 'https://myapp.com',
      host: 'myapp.com',
    });
    expect(verifyOrigin(req)).toBe(true);
  });

  it('returns true for localhost origins', () => {
    const req = createMockRequest({ origin: 'http://localhost:3000', host: 'localhost:3000' });
    expect(verifyOrigin(req)).toBe(true);
  });

  it('returns true for 127.0.0.1 origins', () => {
    const req = createMockRequest({ origin: 'http://127.0.0.1:3000', host: 'myapp.com' });
    expect(verifyOrigin(req)).toBe(true);
  });

  it('returns true for .vercel.app origins', () => {
    const req = createMockRequest({ origin: 'https://my-preview.vercel.app', host: 'my-preview.vercel.app' });
    expect(verifyOrigin(req)).toBe(true);
  });

  it('returns false for cross-origin requests', () => {
    const req = createMockRequest({
      origin: 'https://evil-site.com',
      host: 'myapp.com',
    });
    expect(verifyOrigin(req)).toBe(false);
  });

  it('returns true when origin contains the host as substring', () => {
    const req = createMockRequest({
      origin: 'https://myapp.com/some-path',
      host: 'myapp.com',
    });
    expect(verifyOrigin(req)).toBe(true);
  });
});
