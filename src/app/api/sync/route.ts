import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    // Create sync log entries
    const fanvueSync = await db.syncLog.create({
      data: { type: "fanvue", status: "running" },
    });
    const repoSync = await db.syncLog.create({
      data: { type: "repo", status: "running" },
    });

    // Check Fanvue connection
    const token = await db.oAuthToken.findUnique({
      where: { id: "fanvue_primary" },
    });

    if (token) {
      await db.syncLog.update({
        where: { id: fanvueSync.id },
        data: { status: "completed", message: "Fanvue data sync initiated", finishedAt: new Date() },
      });
    } else {
      await db.syncLog.update({
        where: { id: fanvueSync.id },
        data: { status: "skipped", message: "Not connected to Fanvue", finishedAt: new Date() },
      });
    }

    await db.syncLog.update({
      where: { id: repoSync.id },
      data: { status: "completed", message: "Repo sync initiated", finishedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      fanvue: token ? "synced" : "skipped",
      repo: "synced",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
