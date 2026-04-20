/**
 * SEC-1: Content Security Policy (CSP) headers for the Fanvue Ops Dashboard.
 *
 * These headers restrict which resources the browser is allowed to load,
 * mitigating XSS, clickjacking, and other injection attacks.
 */

/**
 * Returns CSP and related security headers to apply to every response.
 * Includes Content-Security-Policy, X-Content-Type-Options, X-Frame-Options,
 * and Referrer-Policy.
 *
 * @returns A `Record<string, string>` of header name → value pairs.
 */
export function getCSPHeaders(): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.fanvue.com https://cdn.fanvue.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.fanvue.com https://auth.fanvue.com https://*.vercel.app https://o449391.ingest.us.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}
