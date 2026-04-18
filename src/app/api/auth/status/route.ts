import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const token = await db.oAuthToken.findUnique({
      where: { id: "fanvue_primary" },
    });

    if (!token) {
      return NextResponse.json({ connected: false });
    }

    const isExpired = token.expiresAt ? new Date(token.expiresAt) < new Date() : false;

    return NextResponse.json({
      connected: true,
      expiresAt: token.expiresAt,
      isExpired,
      scope: token.scope,
      lastUpdated: token.updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, error: error.message },
      { status: 500 }
    );
  }
}
