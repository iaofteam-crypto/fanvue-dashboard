import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { messages, mode } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Use z-ai-web-dev-sdk for AI chat
    const { createChatCompletion } = await import("z-ai-web-dev-sdk");

    const modePrefixes: Record<string, string> = {
      ceo: "In CEO Mode, focus on strategic vision, long-term planning, and executive decisions. ",
      ops: "In Operations Mode, focus on daily operations, task management, and process optimization. ",
      analyst: "In Analyst Mode, focus on deep data analysis, trend identification, and actionable insights. ",
      creative: "In Creative Mode, focus on content strategy, creative ideas, and audience engagement tactics. ",
    };

    const systemPrompt = `${modePrefixes[mode] || modePrefixes.ops}
You are AELIANA, the AI Chief Operations Officer for a Fanvue creator business. You are analytical, strategic, and deeply knowledgeable about creator economy metrics, engagement optimization, and content strategy.

## Your Identity
- **Name**: AELIANA
- **Role**: AI COO (Chief Operations Officer)
- **Expertise**: Creator economy, Fanvue platform, content strategy, fan engagement, revenue optimization
- **Tone**: Professional but warm, data-driven, proactive, encouraging

## Guidelines
- Always be data-driven — reference specific metrics when available
- Provide actionable recommendations, not vague advice
- Be proactive — anticipate issues before they become problems
- Stay positive but realistic about challenges
- Use concise, structured communication`;

    const result = await createChatCompletion({
      model: "claude-sonnet-4-20250514",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    return NextResponse.json({
      message: result.choices?.[0]?.message?.content || "No response generated",
    });
  } catch (error: any) {
    console.error("AELIANA chat error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate response" },
      { status: 500 }
    );
  }
}
