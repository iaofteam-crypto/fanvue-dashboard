import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getValidAccessToken, FANVUE_API_BASE } from "@/lib/fanvue";
import { isGitHubConfigured, getFileContent } from "@/lib/github";

// Shared Fanvue sync logic — used by both manual and cron sync
async function performFanvueSync(): Promise<{ synced: string[]; failed: string[] }> {
  const accessToken = await getValidAccessToken();

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
      const url = `${FANVUE_API_BASE}${path}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const data = await response.json();
      await db.syncedData.set(key, data);
      return { key };
    })
  );

  const synced: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const endpointKey = endpoints[i].key;
    if (result.status === "fulfilled") {
      synced.push(endpointKey);
    } else {
      const errorMsg = result.reason?.message || "unknown error";
      failed.push(`${endpointKey}(${errorMsg})`);
      await db.syncedData.setError(endpointKey, errorMsg);
    }
  }

  return { synced, failed };
}

// Shared GitHub sync logic
async function performRepoSync(): Promise<string> {
  if (!isGitHubConfigured()) return "skipped (GitHub not configured)";

  try {
    const handoffContent = await getFileContent("handoff.md");
    const discoveryRegex = /D(\d+)\s*[–\-]\s*(.+?)(?:\n|$)/g;
    let match;
    let count = 0;

    while ((match = discoveryRegex.exec(handoffContent)) !== null && count < 200) {
      const refId = `D${match[1]}`;
      const title = match[2].trim();
      if (title) {
        await db.discovery.upsert({
          where: { id: `discovery_${refId}` },
          update: { title, updatedAt: new Date().toISOString() },
          create: { id: `discovery_${refId}`, refId, title, category: "general" },
        });
        count++;
      }
    }
    return `synced (${count} discoveries)`;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return `error: ${msg}`;
  }
}

export async function POST() {
  try {
    const fanvueSync = await db.syncLog.create({
      type: "fanvue_manual",
      status: "running",
    });
    const repoSync = await db.syncLog.create({
      type: "repo_manual",
      status: "running",
    });

    // ✅ FIX B4: Actually sync Fanvue data
    let fanvueResult = { synced: [] as string[], failed: [] as string[] };
    const token = await db.oAuthToken.findUnique({ where: { id: "fanvue_primary" } });

    if (token) {
      try {
        fanvueResult = await performFanvueSync();
        await db.syncLog.update({
          where: { id: fanvueSync.id },
          data: {
            status: "completed",
            message: `Synced ${fanvueResult.synced.length}/${fanvueResult.synced.length + fanvueResult.failed.length} endpoints: ${fanvueResult.synced.join(", ")}`,
            finishedAt: new Date().toISOString(),
          },
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        await db.syncLog.update({
          where: { id: fanvueSync.id },
          data: { status: "error", message: msg, finishedAt: new Date().toISOString() },
        });
      }
    } else {
      await db.syncLog.update({
        where: { id: fanvueSync.id },
        data: { status: "skipped", message: "Not connected to Fanvue", finishedAt: new Date().toISOString() },
      });
    }

    // ✅ Actually sync repo data
    const repoResult = await performRepoSync();
    await db.syncLog.update({
      where: { id: repoSync.id },
      data: { status: "completed", message: `Repo ${repoResult}`, finishedAt: new Date().toISOString() },
    });

    return NextResponse.json({
      success: true,
      fanvue: token ? { synced: fanvueResult.synced, failed: fanvueResult.failed } : "skipped",
      repo: repoResult,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const logs = await db.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    return NextResponse.json(logs);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
