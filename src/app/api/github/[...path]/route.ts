import { NextRequest, NextResponse } from "next/server";
import {
  getFileContent,
  listDirectory,
  getRepoTree,
  isGitHubConfigured,
} from "@/lib/github";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!isGitHubConfigured()) {
    return NextResponse.json(
      { error: "GitHub is not configured. Set GITHUB_TOKEN and GITHUB_REPO env vars." },
      { status: 503 }
    );
  }

  try {
    const { path: pathSegments } = await params;
    const path = pathSegments.join("/");

    if (!path || path === "") {
      const tree = await getRepoTree();
      return NextResponse.json(tree);
    }

    // Try listing directory first, fall back to file content
    try {
      const listing = await listDirectory(path);
      return NextResponse.json(listing);
    } catch {
      const content = await getFileContent(path);
      return NextResponse.json({ content, path });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
