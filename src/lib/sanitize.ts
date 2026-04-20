/**
 * SEC-3: Input Sanitization Utilities
 *
 * Server-safe sanitization functions for all user-provided input.
 * Does NOT require jsdom/DOMPurify — uses pure string operations
 * suitable for Next.js server-side rendering and API routes.
 *
 * For rich HTML sanitization in the future, consider:
 *   - DOMPurify (requires jsdom on server)
 *   - sanitize-html npm package
 *   - Isomorphic DOMPurify for client+server
 */

// ─── Configuration ───────────────────────────────────────────────────────────

/** Default maximum length for sanitized strings */
const DEFAULT_MAX_LENGTH = 10000;

// ─── Core Sanitization ───────────────────────────────────────────────────────

/**
 * Sanitize a plain-text input string for safe storage and processing.
 *
 * Applies in order:
 * 1. Type coercion to string (handles null/undefined/number inputs)
 * 2. Unicode NFC normalization (canonical composition)
 * 3. Null byte removal (prevents null byte injection attacks)
 * 4. Leading/trailing whitespace trim
 * 5. Length truncation
 *
 * @param input  - Raw user input (any type, will be coerced to string)
 * @param maxLength - Maximum allowed length after sanitization (default: 10000)
 * @returns Sanitized string safe for storage, logging, and display
 */
export function sanitizeInput(input: unknown, maxLength = DEFAULT_MAX_LENGTH): string {
  // Coerce to string (handles null, undefined, numbers, objects)
  let str = input == null ? "" : String(input);

  // 1. Normalize unicode to NFC form (canonical composition)
  //    This prevents unicode spoofing where combining characters
  //    can visually match other characters (e.g., Cyrillic "а" vs Latin "a")
  str = str.normalize("NFC");

  // 2. Remove null bytes (U+0000)
  //    Null bytes can truncate strings in C-based systems and
  //    cause issues with PostgreSQL, JSON serialization, etc.
  str = str.replace(/\0/g, "");

  // 3. Trim leading/trailing whitespace
  str = str.trim();

  // 4. Enforce maximum length
  if (str.length > maxLength) {
    str = str.slice(0, maxLength);
  }

  return str;
}

// ─── HTML Sanitization (Server-Safe) ─────────────────────────────────────────

/**
 * Patterns for dangerous HTML that must be stripped.
 * Each entry is [regex, replacement].
 */
const DANGEROUS_HTML_PATTERNS: [RegExp, string][] = [
  // Script tags and their contents
  [/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""],
  // Script tags (opening, in case content removal missed them)
  [/<script\b[^>]*\/?>/gi, ""],
  // Event handler attributes (onclick, onload, onerror, onmouseover, etc.)
  [/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ""],
  // javascript: URLs in href/src/data attributes
  [/(href|src|action|formaction|data|poster|background)\s*=\s*["']?\s*javascript\s*:/gi, "$1="],
  // vbscript: URLs
  [/(href|src|action)\s*=\s*["']?\s*vbscript\s*:/gi, "$1="],
  // data: URLs that could embed executable content (except images)
  [/(href|src|action)\s*=\s*["']?\s*data\s*:(?!image\/)(?!$)/gi, "$1="],
  // HTML comments (can contain conditional code for older browsers)
  [/<!--[\s\S]*?-->/g, ""],
  // IE conditional comments
  [/<!\[[\s\S]*?\]>/g, ""],
  // XML processing instructions
  [/<\?[\s\S]*?\?>/g, ""],
  // embed, object, applet, iframe tags (can load external resources)
  [/<(embed|object|applet|iframe|frame|frameset|base|link|meta|import)\b[^>]*\/?>/gi, ""],
  // form tags (can auto-submit)
  [/<form\b[^>]*>/gi, '<div data-sanitized-form="removed">'],
  [/<\/form>/gi, "</div>"],
  // input tags with non-text types (can be used for CSRF)
  [/<input\b[^>]*type\s*=\s*["']?(?!text|hidden|checkbox|radio|submit|button|email|tel|url|number|range|date|month|week|time|datetime-local|color|search)[^"'>\s]+[^>]*\/?>/gi, ""],
];

/**
 * Server-safe HTML sanitization without DOMPurify/jsdom.
 *
 * Strips dangerous HTML constructs using regex-based patterns:
 * - <script> tags and event handlers (XSS prevention)
 * - javascript:/vbscript:/data: URLs (protocol injection)
 * - <embed>/<object>/<iframe> tags (resource loading)
 * - HTML/XML comments and processing instructions
 * - <form> tags replaced with safe divs
 *
 * WARNING: This is a best-effort sanitizer using regex. It does NOT
 * parse the DOM and may miss edge cases. For production HTML sanitization,
 * use DOMPurify with jsdom or the `sanitize-html` npm package.
 *
 * @param html - Raw HTML string to sanitize
 * @returns HTML string with dangerous constructs removed
 */
export function sanitizeHtml(html: unknown): string {
  // Sanitize the input first (handles null, trims, removes null bytes)
  let result = sanitizeInput(html, DEFAULT_MAX_LENGTH * 2); // allow longer HTML

  // Apply each dangerous pattern removal
  for (const [pattern, replacement] of DANGEROUS_HTML_PATTERNS) {
    result = result.replace(pattern, replacement);
  }

  // Final safety: if any <script survived, nuke it one more time
  result = result.replace(/<script/gi, "&lt;script");

  return result.trim();
}

// ─── Convenience Helpers ─────────────────────────────────────────────────────

/**
 * Sanitize an identifier/key for use in maps, KV stores, or URL paths.
 * Strips everything except alphanumeric, hyphens, underscores, and dots.
 *
 * @param key - The raw key value (any type, coerced to string).
 * @returns A sanitized key string (max 200 chars, alphanumeric + `_-.` only).
 */
export function sanitizeKey(key: unknown): string {
  let str = sanitizeInput(key, 200);
  return str.replace(/[^a-zA-Z0-9_.\-]/g, "");
}

/**
 * Sanitize input meant for use in RegExp.
 * Escapes special regex characters to prevent ReDoS via user input.
 *
 * @param str - The raw string to escape (any type, coerced to string).
 * @returns A regex-safe string (max 500 chars) with special chars escaped.
 */
export function sanitizeRegex(str: unknown): string {
  let s = sanitizeInput(str, 500);
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sanitize a URL string for safe storage (not for redirecting — use allowlists for that).
 * Removes control characters and normalizes.
 *
 * @param url - The raw URL value (any type, coerced to string).
 * @returns A sanitized URL string (max 2048 chars, control chars removed).
 */
export function sanitizeUrl(url: unknown): string {
  let str = sanitizeInput(url, 2048);
  // Remove control characters (except common whitespace)
  str = str.replace(/[\x00-\x1F\x7F]/g, "");
  return str;
}
