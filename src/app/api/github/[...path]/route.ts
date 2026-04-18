import { NextRequest, NextResponse } from "next/server";
import {
  getFileContent,
  listDirectory,
  getRepoTree,
} from "@/lib/github";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
