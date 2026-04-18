import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/lib/fanvue";

export async function GET(request: NextRequest) {
  try {
    const { url, verifier, state } = await buildAuthorizationUrl();

    // Store verifier and state in cookies for the callback
    const response = NextResponse.redirect(url);
    response.cookies.set("fanvue_code_verifier", verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });
    response.cookies.set("fanvue_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
