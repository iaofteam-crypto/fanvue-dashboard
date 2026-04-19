import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanitizeErrorMessage } from "@/lib/security";

// GET /api/sync-data — returns all synced Fanvue data
// GET /api/sync-data?key=me — returns specific endpoint data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      const record = await db.syncedData.get(key);
      if (!record) {
        return NextResponse.json({ key, status: "not_found", data: null });
      }
      return NextResponse.json(record);
    }

    // Return all synced data
    const keys = await db.syncedData.getKeys();
    const result: Record<string, unknown> = {};

    for (const k of keys) {
      const record = await db.syncedData.get(k);
      if (record) {
        result[k] = record;
      }
    }

    return NextResponse.json({
      keys,
      data: result,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}
