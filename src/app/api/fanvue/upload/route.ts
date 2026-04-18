// Fanvue 3-Step Media Upload Endpoint
// Step 1: POST   → Create upload session (returns mediaUuid + uploadId)
// Step 2: GET    → Get presigned S3 URL for a specific part
// Step 3: PATCH  → Complete upload session with collected ETags

import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, FANVUE_API_BASE, FANVUE_API_VERSION } from "@/lib/fanvue";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyOrigin, sanitizeErrorMessage } from "@/lib/security";

// ─── Step 1: Create Upload Session ──────────────────────────────────────

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, { maxRequests: 10 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many upload requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const accessToken = await getValidAccessToken(request);

    // Validate required fields from client
    const body = await request.json();
    const { name, filename, mediaType } = body as {
      name?: string;
      filename?: string;
      mediaType?: string;
    };

    if (!name || !filename || !mediaType) {
      return NextResponse.json(
        { error: "Missing required fields: name, filename, mediaType" },
        { status: 400 }
      );
    }

    const validMediaTypes = ["image", "video", "audio", "document"];
    if (!validMediaTypes.includes(mediaType)) {
      return NextResponse.json(
        { error: `Invalid mediaType. Must be one of: ${validMediaTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const response = await fetch(`${FANVUE_API_BASE}/media/uploads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Fanvue-API-Version": FANVUE_API_VERSION,
      },
      body: JSON.stringify({ name, filename, mediaType }),
    });

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

// ─── Step 2: Get Presigned S3 URL for Part ───────────────────────────────

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, { maxRequests: 60 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many API requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const accessToken = await getValidAccessToken(request);

    // Required query params: uploadId, partNumber
    const uploadId = request.nextUrl.searchParams.get("uploadId");
    const partNumber = request.nextUrl.searchParams.get("partNumber");

    if (!uploadId || !partNumber) {
      return NextResponse.json(
        { error: "Missing required query params: uploadId, partNumber" },
        { status: 400 }
      );
    }

    const partNum = parseInt(partNumber, 10);
    if (isNaN(partNum) || partNum < 1 || partNum > 10000) {
      return NextResponse.json(
        { error: "Invalid partNumber. Must be an integer between 1 and 10000." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${FANVUE_API_BASE}/media/uploads/${uploadId}/parts/${partNum}/url`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Fanvue-API-Version": FANVUE_API_VERSION,
        },
      }
    );

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

// ─── Step 3: Complete Upload Session ────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const rateLimit = checkRateLimit(request, { maxRequests: 10 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many upload requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const accessToken = await getValidAccessToken(request);

    const body = await request.json();
    const { uploadId, parts } = body as {
      uploadId?: string;
      parts?: Array<{ PartNumber: number; ETag: string }>;
    };

    if (!uploadId) {
      return NextResponse.json(
        { error: "Missing required field: uploadId" },
        { status: 400 }
      );
    }

    if (!Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: parts (non-empty array of { PartNumber, ETag })" },
        { status: 400 }
      );
    }

    // Validate each part has required fields
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (typeof part.PartNumber !== "number" || typeof part.ETag !== "string") {
        return NextResponse.json(
          { error: `Invalid part at index ${i}: each part must have PartNumber (number) and ETag (string)` },
          { status: 400 }
        );
      }
    }

    const response = await fetch(`${FANVUE_API_BASE}/media/uploads/${uploadId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Fanvue-API-Version": FANVUE_API_VERSION,
      },
      body: JSON.stringify({ parts }),
    });

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
