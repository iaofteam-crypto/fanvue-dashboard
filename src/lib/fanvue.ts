// Fanvue API Client — OAuth2 PKCE + API wrappers

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
  "write:chat",
  "write:creator",
  "write:media",
  "write:post",
  "write:tracking_links",
];

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

// ─── OAuth URLs ──────────────────────────────────────────────────────

export function getAuthorizationUrl(): string {
  const verifier = generateRandomString(64);
  const challenge = generateCodeChallenge(verifier); // async but we'll handle in route
  const state = generateRandomString(32);
  const scope = SCOPES.join(" ");

  // We need this to be async, so we return a promise
  return "";
}

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

// ─── API Client ──────────────────────────────────────────────────────

export class FanvueClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${FANVUE_API_BASE}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Fanvue API error: ${response.status} - ${error}`);
    }

    return response;
  }

  async get(endpoint: string): Promise<any> {
    const response = await this.request(endpoint);
    return response.json();
  }

  async post(endpoint: string, body: any): Promise<any> {
    const response = await this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return response.json();
  }

  // ─── User ─────────────────────────────────────────────────────────

  async getMe() {
    return this.get("/users/me");
  }

  // ─── Chats ────────────────────────────────────────────────────────

  async getChats() {
    return this.get("/chats");
  }

  async getChatMessages(chatId: string) {
    return this.get(`/chats/${chatId}/messages`);
  }

  async sendMessage(chatId: string, content: string) {
    return this.post(`/chats/${chatId}/messages`, { content });
  }

  // ─── Posts ────────────────────────────────────────────────────────

  async getPosts() {
    return this.get("/posts");
  }

  async createPost(data: { title: string; content?: string; mediaIds?: string[] }) {
    return this.post("/posts", data);
  }

  // ─── Followers & Subscribers ──────────────────────────────────────

  async getFollowers() {
    return this.get("/creators/followers");
  }

  async getSubscribers() {
    return this.get("/creators/subscribers");
  }

  // ─── Insights ─────────────────────────────────────────────────────

  async getEarnings() {
    return this.get("/insights/earnings");
  }

  async getEarningsSummary() {
    return this.get("/insights/earnings-summary");
  }

  async getTopSpenders() {
    return this.get("/insights/top-spenders");
  }

  async getSubscriberInsights() {
    return this.get("/insights/subscribers");
  }

  // ─── Media ────────────────────────────────────────────────────────

  async getMedia() {
    return this.get("/media");
  }

  // ─── Tracking Links ───────────────────────────────────────────────

  async getTrackingLinks() {
    return this.get("/tracking-links");
  }
}
