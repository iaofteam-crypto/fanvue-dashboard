import { NextResponse } from "next/server";
import { healthCheck } from "@/lib/monitoring";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await healthCheck();

    const statusCode =
      result.status === "healthy"
        ? 200
        : result.status === "degraded"
          ? 200
          : 503;

    return NextResponse.json(result, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        checks: [],
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 503 },
    );
  }
}
