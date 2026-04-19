import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearTokenCookie } from "@/lib/fanvue";
import { verifyOrigin } from "@/lib/security";

export async function POST(request: NextRequest) {
  // S2: CSRF check
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db.oAuthToken.delete({ where: { id: "fanvue_primary" } });

    // ✅ FIX B2: Clear token cookie on disconnect
    const response = NextResponse.json({ disconnected: true });
    clearTokenCookie(response);

    return response;
  } catch {
    // Token may not exist, still success — but clear cookie
    const response = NextResponse.json({ disconnected: true });
    clearTokenCookie(response);
    return response;
  }
}
