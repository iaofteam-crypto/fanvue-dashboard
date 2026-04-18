// Fanvue API Client — OAuth2 PKCE + API wrappers

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

const FANVUE_AUTH_URL = "https://auth.fanvue.com/oauth2/auth";
const FANVUE_TOKEN_URL = "https://auth.fanvue.com/oauth2/token";
const FANVUE_API_BASE = "https://api.fanvue.com/v1";

const CLIENT_ID = process.env.FANVUE_CLIENT_ID!;
const CLIENT_SECRET = process.env.FANVUE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.FANVUE_REDIRECT_URI!;

const SCOPES = [
  "openid",
  "offline_access",
  "offline",
  "read:self",
  "read:creator",
  "read:insights",
  "read:fan",
  "read:chat",
  "read:media",
  "read:post",
  "read:tracking_links",
  "read:agency",
  "write:chat",
  "write:creator",
  "write:media",
  "write:post",
  "write:tracking_links",
  "write:agency",
];

const TOKEN_COOKIE_NAME = "fanvue_token";

// ─── PKCE Helpers ────────────────────────────────────────────────────

export function generateRandomString(length = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

export async function generateCodeChallenge(
  verifier: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(hash);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─── Cookie Helpers for Token Persistence ────────────────────────────

// Encode token record for cookie storage (base64url)
function encodeTokenCookie(data: Record<string, unknown>): string {
  const json = JSON.stringify(data);
  return Buffer.from(json).toString("base64url");
}

// Decode token from cookie
function decodeTokenCookie(encoded: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Set the token persistence cookie on a response.
 * Call this after successful token exchange or refresh.
 */
export function setTokenCookie(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
  record: { accessToken: string; refreshToken: string | null; expiresIn: number; expiresAt: string; scope: string | null }
): void {
  const cookieValue = encodeTokenCookie({
    at: record.accessToken,
    rt: record.refreshToken,
    ei: record.expiresIn,
    ea: record.expiresAt,
    sc: record.scope,
  });
  response.cookies.set(TOKEN_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days (refresh_token should survive)
    path: "/",
  });
}

/**
 * Clear the token persistence cookie.
 */
export function clearTokenCookie(
  response: { cookies: { delete: (name: string) => void } }
): void {
  response.cookies.delete(TOKEN_COOKIE_NAME);
}

/**
 * Read token from cookie on a request.
 */
export function getTokenFromRequest(request: NextRequest): {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  expiresAt: string;
  scope: string | null;
} | null {
  const cookieVal = request.cookies.get(TOKEN_COOKIE_NAME)?.value;
  if (!cookieVal) return null;

  const decoded = decodeTokenCookie(cookieVal);
  if (!decoded) return null;

  return {
    accessToken: decoded.at as string,
    refreshToken: (decoded.rt as string) || null,
    expiresIn: (decoded.ei as number) || 0,
    expiresAt: (decoded.ea as string) || new Date().toISOString(),
    scope: (decoded.sc as string) || null,
  };
}

// ─── OAuth URLs ──────────────────────────────────────────────────────

export async function buildAuthorizationUrl(): Promise<{
  url: string;
  verifier: string;
  state: string;
}> {
  const verifier = generateRandomString(64);
  const challenge = await generateCodeChallenge(verifier);
  const state = generateRandomString(32);
  const scope = SCOPES.join(" ");

  const url = `${FANVUE_AUTH_URL}?${new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString()}`;

  return { url, verifier, state };
}

// ─── Token Exchange ──────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const response = await fetch(FANVUE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const response = await fetch(FANVUE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  return response.json();
}

// ─── Shared Token Helper (used by API routes) ─────────────────────────

export { FANVUE_API_BASE };

/**
 * Get a valid access token. Handles:
 * 1. In-memory store → KV store → cookie rehydration (cold start recovery)
 * 2. Auto-refresh if token is near expiry
 *
 * Pass `request` to enable cookie-based rehydration on cold starts.
 */
export async function getValidAccessToken(request?: NextRequest): Promise<string> {
  // Try in-memory/KV store first
  let token = await db.oAuthToken.findUnique({
    where: { id: "fanvue_primary" },
  });

  // ✅ FIX B2: Rehydrate from cookie on cold start (in-memory empty, no KV)
  if (!token && request) {
    const cookieToken = getTokenFromRequest(request);
    if (cookieToken) {
      // Rehydrate into store
      const now = new Date().toISOString();
      const rehydrated = await db.oAuthToken.upsert({
        where: { id: "fanvue_primary" },
        update: {
          accessToken: cookieToken.accessToken,
          refreshToken: cookieToken.refreshToken,
          expiresIn: cookieToken.expiresIn,
          expiresAt: cookieToken.expiresAt,
          scope: cookieToken.scope,
        },
        create: {
          id: "fanvue_primary",
          provider: "fanvue",
          accessToken: cookieToken.accessToken,
          refreshToken: cookieToken.refreshToken,
          expiresIn: cookieToken.expiresIn,
          expiresAt: cookieToken.expiresAt,
          scope: cookieToken.scope,
        },
      });
      token = rehydrated;
    }
  }

  if (!token) {
    throw new Error("Not connected to Fanvue");
  }

  // Check if token needs refresh (within 5 minutes of expiry)
  if (token.expiresAt && new Date(token.expiresAt).getTime() - 5 * 60 * 1000 < Date.now()) {
    if (!token.refreshToken) {
      throw new Error("Token expired and no refresh token available");
    }

    try {
      const data = await refreshAccessToken(token.refreshToken);

      const updated = await db.oAuthToken.update({
        where: { id: "fanvue_primary" },
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || token.refreshToken,
          expiresIn: data.expires_in,
          expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        },
      });

      return updated.accessToken;
    } catch {
      await db.oAuthToken.delete({ where: { id: "fanvue_primary" } });
      throw new Error("Token expired and refresh failed. Please reconnect.");
    }
  }

  return token.accessToken;
}
