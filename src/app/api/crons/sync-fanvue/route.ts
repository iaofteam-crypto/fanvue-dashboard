import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const FANVUE_API_BASE = "https://api.fanvue.com/v1";

async function getValidAccessToken(): Promise<string> {
  const token = await db.oAuthToken.findUnique({
    where: { id: "fanvue_primary" },
  });

  if (!token) {
    throw new Error("No Fanvue token");
  }

  // Refresh if within 5 minutes of expiry
  if (token.expiresAt && new Date(token.expiresAt.getTime() - 5 * 60 * 1000) < new Date()) {
    if (!token.refreshToken) {
      throw new Error("Token expired and no refresh token");
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
      throw new Error("Token expired and refresh failed");
    }
  }

  return token.accessToken;
}

async function fanvueFetch(endpoint: string, accessToken: string): Promise<any> {
  const url = `${FANVUE_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Fanvue API ${endpoint}: ${response.status}`);
  }

  return response.json();
}

export async function GET() {
  const syncLog = await db.syncLog.create({
    data: { type: "fanvue_cron", status: "running" },
  });

  try {
    const token = await db.oAuthToken.findUnique({
      where: { id: "fanvue_primary" },
    });

    if (!token) {
      await db.syncLog.update({
        where: { id: syncLog.id },
        data: { status: "skipped", message: "No Fanvue token stored", finishedAt: new Date() },
      });
      return NextResponse.json({ status: "skipped", reason: "no_token" });
    }

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken();
    } catch (refreshError: any) {
      await db.syncLog.update({
        where: { id: syncLog.id },
        data: { status: "error", message: `Token refresh failed: ${refreshError.message}`, finishedAt: new Date() },
      });
      return NextResponse.json({ status: "error", reason: "token_refresh_failed" });
    }

    // Pull data from multiple Fanvue endpoints concurrently
    const endpoints = [
      { key: "me", path: "/users/me" },
      { key: "chats", path: "/chats" },
      { key: "posts", path: "/posts" },
      { key: "subscribers", path: "/creators/subscribers" },
      { key: "followers", path: "/creators/followers" },
      { key: "earnings", path: "/insights/earnings" },
      { key: "earnings_summary", path: "/insights/earnings-summary" },
      { key: "media", path: "/media" },
      { key: "tracking_links", path: "/tracking-links" },
    ];

    const results = await Promise.allSettled(
      endpoints.map(async ({ key, path }) => {
        const data = await fanvueFetch(path, accessToken);
        return { key, data };
      })
    );

    const synced: string[] = [];
    const failed: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        synced.push(result.value.key);

        // Store successful results in SyncLog for the dashboard to read
        await db.syncLog.create({
          data: {
            type: `fanvue_data_${result.value.key}`,
            status: "completed",
            message: JSON.stringify(result.value.data).slice(0, 5000),
          },
        });
      } else {
        failed.push(`unknown`);
      }
    }

    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "completed",
        message: `Synced ${synced.length}/${endpoints.length} endpoints (${synced.join(", ")})${failed.length ? `. Failed: ${failed.join(", ")}` : ""}`,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({
      status: "completed",
      synced,
      failed,
      total: endpoints.length,
    });
  } catch (error: any) {
    await db.syncLog.update({
      where: { id: syncLog.id },
      data: { status: "error", message: error.message, finishedAt: new Date() },
    });

    return NextResponse.json(
      { status: "error", error: error.message },
      { status: 500 }
    );
  }
}
