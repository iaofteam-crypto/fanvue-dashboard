/**
 * Shared test helpers for E2E API route tests.
 *
 * Provides utilities for creating NextRequest objects with full
 * cookie/header/body support, plus helpers for mock setup.
 */

import { NextRequest } from "next/server";
import crypto from "node:crypto";

const BASE_URL = "http://localhost:3000";

/**
 * Create a NextRequest with full URL, headers, cookies, and body support.
 * NextRequest extends Request and adds nextUrl (with searchParams) and cookies.
 */
export function createNextRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    body?: unknown;
    /** Query params appended to URL */
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = "GET", headers = {}, cookies = {}, body, searchParams } = options;

  // Build URL with optional search params
  let url = `${BASE_URL}${path}`;
  if (searchParams && Object.keys(searchParams).length > 0) {
    const params = new URLSearchParams(searchParams);
    url += `?${params.toString()}`;
  }

  const requestHeaders: Record<string, string> = { ...headers };

  // Set Content-Type for JSON bodies
  if (body !== undefined) {
    requestHeaders["content-type"] = "application/json";
  }

  // Set cookie header from cookies map
  if (Object.keys(cookies).length > 0) {
    const cookieStr = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    requestHeaders["cookie"] = cookieStr;
  }

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  // NextRequest's RequestInit doesn't accept null for signal (unlike global RequestInit)
  const { signal, ...restInit } = requestInit as RequestInit & { signal?: AbortSignal | null };
  const nextInit = signal === null ? { ...restInit, signal: undefined } : restInit;
  const request = new NextRequest(url, nextInit);
  return request;
}

/**
 * Parse a NextResponse JSON body.
 */
export async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Create a base64url-encoded fanvue_token cookie value.
 * Mirrors the encoding in src/lib/fanvue.ts setTokenCookie().
 */
export function encodeFanvueToken(data: {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  expiresAt: string;
  scope: string | null;
}): string {
  const json = JSON.stringify({
    at: data.accessToken,
    rt: data.refreshToken,
    ei: data.expiresIn,
    ea: data.expiresAt,
    sc: data.scope,
  });
  return Buffer.from(json).toString("base64url");
}

/**
 * Generate a valid HMAC-SHA256 webhook signature.
 * Mirrors the Fanvue webhook verification in the webhook route.
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp?: number
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  const hmac = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${ts},v0=${hmac}`;
}

/**
 * Unique IP per test to avoid rate limit cross-contamination.
 * Each call appends Math.random() to ensure uniqueness.
 */
export function uniqueIp(): string {
  return `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}
