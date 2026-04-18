import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, FANVUE_API_BASE } from "@/lib/fanvue";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin, sanitizeErrorMessage } from "@/lib/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  // S1: Rate limit Fanvue API proxy (60/min)
  const rateLimit = checkRateLimit(request, { maxRequests: 60 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many API requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

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
    // Keep "Not connected" for auth errors but sanitize everything else
    const msg = error instanceof Error ? error.message : "";
    const status = msg.includes("Not connected") ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? msg : sanitizeErrorMessage(error) },
      { status }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  // S1: Rate limit Fanvue API proxy (30/min for writes)
  const rateLimit = checkRateLimit(request, { maxRequests: 30 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many API requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // S2: CSRF check on POST
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { endpoint } = await params;
    const accessToken = await getValidAccessToken(request);
    const path = endpoint.join("/");
    const url = `${FANVUE_API_BASE}/${path}`;

    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    // For multipart, forward the raw body and let fetch set Content-Type with boundary
    // For JSON, parse and re-stringify (ensures clean body)
    const body = isMultipart
      ? request.body
      : JSON.stringify(await request.json());

    if (!isMultipart) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    // Try to parse as JSON, fall back to text
    const responseText = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    const status = msg.includes("Not connected") ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? msg : sanitizeErrorMessage(error) },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  // Rate limit DELETEs (30/min)
  const rateLimit = checkRateLimit(request, { maxRequests: 30 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many API requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  // CSRF check on DELETE
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { endpoint } = await params;
    const accessToken = await getValidAccessToken(request);
    const path = endpoint.join("/");
    const url = `${FANVUE_API_BASE}/${path}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    const status = msg.includes("Not connected") ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? msg : sanitizeErrorMessage(error) },
      { status }
    );
  }
}
