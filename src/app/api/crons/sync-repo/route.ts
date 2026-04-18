import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFileContent } from "@/lib/github";

export async function GET() {
  try {
    const syncLog = await db.syncLog.create({
      type: "repo_cron",
      status: "running",
    });

    try {
      // Try to fetch handoff.md and parse discoveries
      const handoffContent = await getFileContent("handoff.md");

      // Simple discovery parser
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
            create: {
              id: `discovery_${refId}`,
              refId,
              title,
              category: "general",
            },
          });
          count++;
        }
      }

      await db.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "completed",
          message: `Synced repo, found ${count} discoveries`,
          finishedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      await db.syncLog.update({
        where: { id: syncLog.id },
        data: { status: "error", message: error.message, finishedAt: new Date().toISOString() },
      });
    }

    return NextResponse.json({ status: "completed" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
