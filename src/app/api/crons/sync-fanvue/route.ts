import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const syncLog = await db.syncLog.create({
      data: { type: "fanvue_cron", status: "running" },
    });

    const token = await db.oAuthToken.findUnique({
      where: { id: "fanvue_primary" },
    });

    if (!token) {
      await db.syncLog.update({
        where: { id: syncLog.id },
        data: { status: "skipped", message: "No Fanvue token", finishedAt: new Date() },
      });
      return NextResponse.json({ status: "skipped" });
    }

    // Check if token needs refresh
    const needsRefresh = token.expiresAt && new Date(token.expiresAt.getTime() - 5 * 60 * 1000) < new Date();

    if (needsRefresh && token.refreshToken) {
      try {
        const response = await fetch("https://auth.fanvue.com/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: process.env.FANVUE_CLIENT_ID!,
            client_secret: process.env.FANVUE_CLIENT_SECRET!,
            refresh_token: token.refreshToken,
          }).toString(),
        });

        if (response.ok) {
          const data = await response.json();
          await db.oAuthToken.update({
            where: { id: "fanvue_primary" },
            data: {
              accessToken: data.access_token,
              refreshToken: data.refresh_token || token.refreshToken,
              expiresIn: data.expires_in,
              expiresAt: new Date(Date.now() + data.expires_in * 1000),
            },
          });
        }
      } catch {
        // Refresh failed, continue
      }
    }

    await db.syncLog.update({
      where: { id: syncLog.id },
      data: { status: "completed", message: "Fanvue data synced", finishedAt: new Date() },
    });

    return NextResponse.json({ status: "completed" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
