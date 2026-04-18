import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    await db.oAuthToken.delete({ where: { id: "fanvue_primary" } });
    return NextResponse.json({ disconnected: true });
  } catch {
    // Token may not exist, still success
    return NextResponse.json({ disconnected: true });
  }
}
