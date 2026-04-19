import { NextResponse } from "next/server";
import { refreshAccessToken } from "@/lib/fanvue";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const token = await db.oAuthToken.findUnique({
      where: { id: "fanvue_primary" },
    });

    if (!token || !token.refreshToken) {
      return NextResponse.json(
        { error: "No refresh token available" },
        { status: 401 }
      );
    }

    const tokenData = await refreshAccessToken(token.refreshToken);

    // Update stored tokens
    await db.oAuthToken.update({
      where: { id: "fanvue_primary" },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || token.refreshToken,
        expiresIn: tokenData.expires_in,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
      },
    });

    return NextResponse.json({ success: true, expiresIn: tokenData.expires_in });
  } catch (error: unknown) {
    console.error("Token refresh error:", error);
    const msg = error instanceof Error ? error.message : "Token refresh failed";
    return NextResponse.json(
      { error: msg },
      { status: 401 }
    );
  }
}
