/**
 * Client-side sanitization hook and helpers.
 *
 * Provides useSanitize hook for sanitizing user-generated text content
 * before rendering. Uses DOMPurify via isomorphic-dompurify.
 *
 * Import from "@/hooks/use-sanitize" in any component that renders
 * user-generated content (messages, comments, fan names, etc.).
 */

"use client";

import { useMemo, useCallback } from "react";
import DOMPurify from "isomorphic-dompurify";

// ─── Configuration ─────────────────────────────────────────────────────────

/** Tags allowed in user-generated content */
const USER_CONTENT_ALLOWED_TAGS = [
  "b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
  "span", "div", "img",
] as const;

// ─── DOMPurify Client Config ───────────────────────────────────────────────

DOMPurify.addHook("uponSanitizeElement", (node, data) => {
  if (data.tagName === "script" || data.tagName === "iframe" || data.tagName === "object" || data.tagName === "embed") {
    (node as Element).remove();
  }
});

DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  const attrName = data.attrName;
  const attrValue = data.attrValue;

  if ((attrName === "href" || attrName === "src" || attrName === "action") &&
      typeof attrValue === "string") {
    const trimmed = attrValue.trim().toLowerCase();
    if (
      trimmed.startsWith("javascript:") ||
      trimmed.startsWith("data:text/html") ||
      trimmed.startsWith("vbscript:")
    ) {
      data.keepAttr = false;
    }
  }

  if (attrName.startsWith("on")) {
    data.keepAttr = false;
  }
});

// ─── Core Sanitization Functions ───────────────────────────────────────────

/**
 * Sanitize HTML content for safe rendering.
 * Strips all dangerous tags and attributes.
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [...USER_CONTENT_ALLOWED_TAGS],
    ALLOWED_ATTR: ["href", "title", "target", "rel", "alt", "src", "class"],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

/**
 * Strip all HTML tags, returning plain text only.
 */
export function stripHtml(input: string): string {
  if (!input || typeof input !== "string") return "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize plain text: trim, normalize unicode, remove control chars, limit length.
 */
export function sanitizeText(input: string, maxLength: number = 10000): string {
  if (!input || typeof input !== "string") return "";
  let sanitized = input.normalize("NFC");
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  sanitized = sanitized.trim();
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  return sanitized;
}

// ─── React Hooks ───────────────────────────────────────────────────────────

/**
 * Hook for sanitizing user-generated content.
 * Returns memoized sanitized version of the input.
 *
 * @param input - Raw user content string
 * @param options - Configuration options
 * @returns Sanitized string safe for rendering
 */
export function useSanitize(
  input: string | null | undefined,
  options: {
    /** Strip all HTML (default: false) */
    stripHtml?: boolean;
    /** Max length (default: 10000) */
    maxLength?: number;
  } = {}
): string {
  const { stripHtml: shouldStrip = false, maxLength = 10000 } = options;

  return useMemo(() => {
    if (!input || typeof input !== "string") return "";

    if (shouldStrip) {
      return stripHtml(input);
    }

    // For plain text contexts (no HTML expected), just sanitize the text
    return sanitizeText(input, maxLength);
  }, [input, shouldStrip, maxLength]);
}

/**
 * Hook for sanitizing text that may contain HTML from external sources.
 * Returns sanitized HTML that is safe to render via dangerouslySetInnerHTML.
 */
export function useSanitizeHtml(input: string | null | undefined): string {
  return useMemo(() => {
    return sanitizeHtml(input ?? "");
  }, [input]);
}

/**
 * Callback-based sanitizer for dynamic content (e.g., message input).
 */
export function useSanitizer() {
  const sanitize = useCallback((input: string, maxLength: number = 10000): string => {
    return sanitizeText(input, maxLength);
  }, []);

  const sanitizeForDisplay = useCallback((input: string): string => {
    return stripHtml(input);
  }, []);

  return { sanitize, sanitizeForDisplay, sanitizeHtml };
}
