import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const FANVUE_API_BASE = "https://api.fanvue.com/v1";

async function getValidAccessToken(): Promise<string> {
  const token = await db.oAuthToken.findUnique({
    where: { id: "fanvue_primary" },
  });

  if (!token) {
    throw new Error("Not connected to Fanvue");
  }

  // Check if token needs refresh (within 5 minutes of expiry)
  if (token.expiresAt && new Date(token.expiresAt.getTime() - 5 * 60 * 1000) < new Date()) {
    if (!token.refreshToken) {
      throw new Error("Token expired and no refresh token available");
    }

    try {
      const response = await fetch("https://auth.fanvue.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.FANVUE_CLIENT_ID!,
          client_secret: process.env.FANVUE_CLIENT_SECRET!,
          refresh_token: token.refreshToken,
        }).toString(),
      });

      if (!response.ok) throw new Error("Refresh failed");

      const data = await response.json();

      await db.oAuthToken.update({
        where: { id: "fanvue_primary" },
        data: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || token.refreshToken,
          expiresIn: data.expires_in,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
        },
      });

      return data.access_token;
    } catch {
      await db.oAuthToken.delete({ where: { id: "fanvue_primary" } });
      throw new Error("Token expired and refresh failed. Please reconnect.");
    }
  }

  return token.accessToken;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  try {
    const { endpoint } = await params;
    const accessToken = await getValidAccessToken();
    const path = endpoint.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${FANVUE_API_BASE}/${path}${searchParams ? `?${searchParams}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes("Not connected") ? 401 : 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  try {
    const { endpoint } = await params;
    const accessToken = await getValidAccessToken();
    const path = endpoint.join("/");
    const body = await request.json();
    const url = `${FANVUE_API_BASE}/${path}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message.includes("Not connected") ? 401 : 500 }
    );
  }
}
