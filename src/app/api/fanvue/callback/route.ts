import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, setTokenCookie } from "@/lib/fanvue";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/?error=no_code", request.url)
      );
    }

    // Verify state matches
    const storedState = request.cookies.get("fanvue_oauth_state")?.value;
    if (state !== storedState) {
      return NextResponse.redirect(
        new URL("/?error=state_mismatch", request.url)
      );
    }

    const codeVerifier = request.cookies.get("fanvue_code_verifier")?.value;
    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL("/?error=no_verifier", request.url)
      );
    }

    // Exchange code for tokens
    const tokenData = await exchangeCodeForTokens(code, codeVerifier);

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Store tokens in database
    await db.oAuthToken.upsert({
      where: { id: "fanvue_primary" },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        expiresAt,
        scope: tokenData.scope,
      },
      create: {
        id: "fanvue_primary",
        provider: "fanvue",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        expiresAt,
        scope: tokenData.scope,
      },
    });

    // Clear OAuth cookies and set token persistence cookie
    const response = NextResponse.redirect(new URL("/?connected=true", request.url));
    response.cookies.delete("fanvue_code_verifier");
    response.cookies.delete("fanvue_oauth_state");

    // ✅ FIX B2: Persist token in httpOnly cookie (survives cold starts)
    setTokenCookie(response, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      expiresAt,
      scope: tokenData.scope,
    });

    return response;
  } catch (error: unknown) {
    console.error("OAuth callback error:", error);
    const msg = error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(msg)}`, request.url)
    );
  }
}
