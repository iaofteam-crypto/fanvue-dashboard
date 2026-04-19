import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest } from "@/lib/fanvue";

export async function GET(request: NextRequest) {
  try {
    // Try in-memory/KV store first
    let token = await db.oAuthToken.findUnique({
      where: { id: "fanvue_primary" },
    });

    // ✅ FIX B2: Check cookie as fallback (cold start recovery)
    if (!token) {
      const cookieToken = getTokenFromRequest(request);
      if (cookieToken) {
        // Verify token isn't expired
        const isExpired = cookieToken.expiresAt
          ? new Date(cookieToken.expiresAt) < new Date()
          : false;
        if (!isExpired) {
          return NextResponse.json({
            connected: true,
            expiresAt: cookieToken.expiresAt,
            isExpired: false,
            scope: cookieToken.scope,
            source: "cookie",
          });
        }
      }
    }

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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Status check failed";
    return NextResponse.json(
      { connected: false, error: msg },
      { status: 500 }
    );
  }
}
