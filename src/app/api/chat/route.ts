import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { buildAelianaPrompt } from "@/lib/aeliana";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeErrorMessage } from "@/lib/security";

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 4000;

export async function POST(request: NextRequest) {
  // S1: Rate limit chat requests (10/min — LLM calls are expensive)
  const rateLimit = checkRateLimit(request, { maxRequests: 10 });
  if (!rateLimit.allowed) {
    const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many chat requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const { messages, mode } = await request.json();

    // S4: Validate messages input
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_MESSAGES} messages allowed` },
        { status: 400 }
      );
    }

    // Validate each message has required fields
    const isValid = messages.every(
      (m: unknown) =>
        typeof m === "object" &&
        m !== null &&
        "role" in m &&
        "content" in m &&
        typeof (m as { role: unknown }).role === "string" &&
        typeof (m as { content: unknown }).content === "string" &&
        ((m as { role: string }).role === "user" || (m as { role: string }).role === "assistant" || (m as { role: string }).role === "system") &&
        (m as { content: string }).content.length <= MAX_MESSAGE_LENGTH
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid message format. Each message must have role (user/assistant/system) and content (max 4000 chars)." },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    // ✅ FIX A2: Use aeliana.ts prompt builder
    const basePrompt = buildAelianaPrompt(mode || "ops");

    // ✅ FIX B8: Fetch real synced data to inject as context
    let dataContext = "";
    try {
      const keys = await db.syncedData.getKeys();
      if (keys.length > 0) {
        const contextParts: string[] = [];
        for (const k of keys) {
          const record = await db.syncedData.get(k);
          if (record && record.status === "success" && record.data) {
            // Summarize data for context — avoid sending huge payloads to LLM
            const summary = summarizeSyncedData(k, record.data);
            if (summary) contextParts.push(summary);
          }
        }
        if (contextParts.length > 0) {
          dataContext = `\n\n## Current Creator Data (synced ${new Date().toISOString().split("T")[0]})\n${contextParts.join("\n")}`;
        }
      }
    } catch {
      // If data fetch fails, AELIANA still works without context
    }

    const systemPrompt = `${basePrompt}${dataContext}`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    const messageContent = completion.choices?.[0]?.message?.content;

    if (!messageContent) {
      return NextResponse.json(
        { error: "No response generated" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: messageContent });
  } catch (error: unknown) {
    console.error("AELIANA chat error:", error);
    return NextResponse.json(
      { error: sanitizeErrorMessage(error) },
      { status: 500 }
    );
  }
}

// Summarize raw API data into compact context for the LLM
function summarizeSyncedData(key: string, data: unknown): string {
  try {
    const d = data as Record<string, unknown>;

    switch (key) {
      case "me": {
        const name = (d as Record<string, string>).displayName || (d as Record<string, string>).username || "Unknown";
        const id = (d as Record<string, string>).id;
        return `### Profile\n- Name: ${name}\n- ID: ${id}`;
      }
      case "earnings": {
        // Summarize earnings array
        if (Array.isArray(d)) {
          const total = d.length;
          const latest = d.slice(0, 3).map((e: Record<string, unknown>) =>
            `  - ${(e as Record<string, string>)?.date || "N/A"}: $${(e as Record<string, number>)?.amount || 0}`
          ).join("\n");
          return `### Earnings (${total} records, showing latest 3)\n${latest}`;
        }
        return `### Earnings\n${JSON.stringify(d).slice(0, 300)}`;
      }
      case "earnings_summary": {
        return `### Earnings Summary\n${JSON.stringify(d).slice(0, 500)}`;
      }
      case "subscribers": {
        const count = Array.isArray(d) ? d.length : (d as Record<string, unknown>)?.total || "unknown";
        return `### Subscribers: ${count}`;
      }
      case "followers": {
        const count = Array.isArray(d) ? d.length : (d as Record<string, unknown>)?.total || "unknown";
        return `### Followers: ${count}`;
      }
      case "chats": {
        const count = Array.isArray(d) ? d.length : 0;
        return `### Chats: ${count} conversations`;
      }
      case "posts": {
        const count = Array.isArray(d) ? d.length : 0;
        const recent = Array.isArray(d)
          ? d.slice(0, 3).map((p: Record<string, unknown>) =>
              `  - ${(p as Record<string, string>)?.title || (p as Record<string, string>)?.type || "Untitled"}`
            ).join("\n")
          : "";
        return `### Posts: ${count} total\n${recent}`;
      }
      case "media": {
        const count = Array.isArray(d) ? d.length : 0;
        return `### Media: ${count} files`;
      }
      case "tracking_links": {
        const count = Array.isArray(d) ? d.length : 0;
        return `### Tracking Links: ${count}`;
      }
      default:
        return `### ${key}\n${JSON.stringify(d).slice(0, 300)}`;
    }
  } catch {
    return `### ${key}\nData available but could not be summarized.`;
  }
}
