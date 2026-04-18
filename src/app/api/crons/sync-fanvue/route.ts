import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getValidAccessToken, FANVUE_API_BASE } from "@/lib/fanvue";

async function fanvueFetch(endpoint: string, accessToken: string): Promise<unknown> {
  const url = `${FANVUE_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status}`);
  }

  return response.json();
}

export async function GET() {
  const syncLog = await db.syncLog.create({
    type: "fanvue_cron",
    status: "running",
  });

  try {
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken();
    } catch (refreshError: unknown) {
      const msg = refreshError instanceof Error ? refreshError.message : "Unknown error";
      await db.syncLog.update({
        where: { id: syncLog.id },
        data: { status: "error", message: `Token refresh failed: ${msg}`, finishedAt: new Date().toISOString() },
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

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const endpointKey = endpoints[i].key;

      if (result.status === "fulfilled") {
        synced.push(endpointKey);
        // ✅ FIX B3: Actually persist the fetched data
        await db.syncedData.set(endpointKey, result.value.data);
      } else {
        const errorMsg = result.reason?.message || "unknown error";
        failed.push(`${endpointKey}(${errorMsg})`);
        await db.syncedData.setError(endpointKey, errorMsg);
      }
    }

    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "completed",
        message: `Synced ${synced.length}/${endpoints.length} endpoints: ${synced.join(", ")}`,
        finishedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      status: "completed",
      synced,
      failed: failed.length > 0 ? failed : undefined,
      total: endpoints.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    await db.syncLog.update({
      where: { id: syncLog.id },
      data: { status: "error", message: msg, finishedAt: new Date().toISOString() },
    });

    return NextResponse.json(
      { status: "error", error: msg },
      { status: 500 }
    );
  }
}
