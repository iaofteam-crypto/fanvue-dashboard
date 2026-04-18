import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, FANVUE_API_BASE } from "@/lib/fanvue";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  try {
    const { endpoint } = await params;
    const accessToken = await getValidAccessToken(request);
    const path = endpoint.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${FANVUE_API_BASE}/${path}${searchParams ? `?${searchParams}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Not connected") ? 401 : 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  try {
    const { endpoint } = await params;
    const accessToken = await getValidAccessToken(request);
    const path = endpoint.join("/");
    const body = await request.json();
    const url = `${FANVUE_API_BASE}/${path}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Not connected") ? 401 : 500 }
    );
  }
}
