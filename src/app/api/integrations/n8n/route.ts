/**
 * @module /api/integrations/n8n
 * @description CRUD API for custom n8n workflow templates.
 * GET: List all templates
 * POST: Create a new template
 * PATCH: Update a template
 * DELETE: Delete a template
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyOrigin, rateLimitResponse } from "@/lib/security";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeString } from "@/lib/sanitize";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/integrations-store";

export async function GET(request: NextRequest) {
  const rateResult = checkRateLimit(request, { maxRequests: 60 });
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  const templates = listTemplates();
  return NextResponse.json({ templates, count: templates.length });
}

export async function POST(request: NextRequest) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateResult = checkRateLimit(request, { maxRequests: 10 });
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  try {
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = sanitizeString(body.name as string, 100);
    const description = sanitizeString(body.description as string, 500);
    const workflowJson = typeof body.workflowJson === "string"
      ? body.workflowJson
      : JSON.stringify(body.workflowJson);
    const triggerEvents = body.triggerEvents as string[] | undefined;
    const category = body.category as string | undefined;

    const validCategories = ["messaging", "analytics", "notification", "automation", "custom"];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    const result = createTemplate({
      name,
      description: description || undefined,
      workflowJson,
      triggerEvents: (triggerEvents ?? []) as Array<"message-received" | "message-read" | "new-follower" | "new-subscriber" | "tip-received">,
      category: category as "messaging" | "analytics" | "notification" | "automation" | "custom" | undefined,
    });

    if ("error" in result) {
      return NextResponse.json({ detail: result.error }, { status: 400 });
    }

    return NextResponse.json({ template: result.template }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateResult = checkRateLimit(request, { maxRequests: 10 });
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  try {
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const id = sanitizeString(body.id as string, 100);
    if (!id) {
      return NextResponse.json({ detail: "Template ID is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = sanitizeString(body.name as string, 100);
    if (body.description !== undefined) updates.description = sanitizeString(body.description as string, 500);
    if (body.workflowJson !== undefined) {
      updates.workflowJson = typeof body.workflowJson === "string"
        ? body.workflowJson
        : JSON.stringify(body.workflowJson);
    }
    if (body.triggerEvents !== undefined) updates.triggerEvents = body.triggerEvents;
    if (body.category !== undefined) updates.category = body.category;
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);

    const result = updateTemplate(
      id,
      updates as Parameters<typeof updateTemplate>[1]
    );

    if ("error" in result) {
      return NextResponse.json({ detail: result.error }, { status: 400 });
    }

    return NextResponse.json({ template: result.template });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifyOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateResult = checkRateLimit(request, { maxRequests: 10 });
  if (!rateResult.allowed) {
    return rateLimitResponse(rateResult.resetAt, rateResult.limit);
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ detail: "Template ID query parameter is required" }, { status: 400 });
    }

    const result = deleteTemplate(id);
    if ("error" in result) {
      return NextResponse.json({ detail: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
