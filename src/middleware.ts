import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCSPHeaders } from "@/lib/csp";

/**
 * SEC-1: Middleware that applies Content-Security-Policy and other
 * security-related headers to every page response.
 *
 * Static assets, API routes, favicons and Next.js image optimiser
 * endpoints are excluded via the matcher below for performance.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const headers = getCSPHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
