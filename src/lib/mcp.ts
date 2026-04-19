/**
 * INT-1: Fanvue MCP (Model Context Protocol) Integration Stub
 *
 * This module defines the interface for the Model Context Protocol integration
 * with Fanvue. MCP enables AI assistants to discover and invoke tools that
 * interact with the Fanvue platform (read messages, post content, manage fans, etc.).
 *
 * FUTURE INTEGRATION NOTES:
 * ─────────────────────────
 * 1. When real MCP support is added, replace `isConfigured` with an actual
 *    check for the MCP server endpoint (env var MCP_SERVER_URL).
 * 2. The `MCPCapability` type describes tools the MCP server exposes.
 *    Each tool maps to a Fanvue API operation.
 * 3. To connect a real MCP server, implement the JSON-RPC transport layer
 *    and wire each capability to its corresponding API route in `/api/fanvue/[...endpoint]`.
 * 4. Authentication: the MCP server should reuse the stored OAuth token via
 *    `getValidAccessToken()` from `@/lib/fanvue`.
 *
 * @see https://modelcontextprotocol.io/
 */

// ─── Types ────────────────────────────────────────────────────────────────

/** Supported MCP tool categories */
export type MCPCategory =
  | "messaging"
  | "content"
  | "insights"
  | "fan-management"
  | "earnings"
  | "media";

/** Describes a single MCP tool / capability */
export interface MCPCapability {
  /** Unique tool name (e.g. "send_message") */
  name: string;
  /** Human-readable label */
  description: string;
  /** Category the tool belongs to */
  category: MCPCategory;
  /** Whether the tool requires write access (OAuth scope with write: prefix) */
  requiresWrite: boolean;
  /** Example input parameters (JSON Schema-like) */
  inputSchema: Record<string, unknown>;
}

/** Status of the MCP integration */
export type MCPStatus = "configured" | "not_configured" | "error";

export interface MCPStatusResult {
  status: MCPStatus;
  message: string;
  serverUrl?: string;
}

// ─── Stub Capabilities ────────────────────────────────────────────────────

/**
 * Pre-defined list of Fanvue MCP tools.
 * In a real implementation these would be fetched from the MCP server
 * via `tools/list` JSON-RPC call.
 */
const CAPABILITIES: MCPCapability[] = [
  {
    name: "list_messages",
    description: "List chat messages from a specific conversation",
    category: "messaging",
    requiresWrite: false,
    inputSchema: {
      type: "object",
      properties: {
        chatId: { type: "string", description: "The chat/conversation ID" },
        limit: { type: "number", description: "Max messages to return" },
      },
      required: ["chatId"],
    },
  },
  {
    name: "send_message",
    description: "Send a text message to a fan",
    category: "messaging",
    requiresWrite: true,
    inputSchema: {
      type: "object",
      properties: {
        chatId: { type: "string", description: "The chat/conversation ID" },
        text: { type: "string", description: "Message content" },
      },
      required: ["chatId", "text"],
    },
  },
  {
    name: "list_posts",
    description: "List published posts with optional filters",
    category: "content",
    requiresWrite: false,
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max posts to return" },
        offset: { type: "number", description: "Pagination offset" },
      },
    },
  },
  {
    name: "create_post",
    description: "Create and publish a new post",
    category: "content",
    requiresWrite: true,
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Post body text" },
        mediaIds: { type: "array", items: { type: "string" }, description: "Attached media IDs" },
        isScheduled: { type: "boolean", description: "Whether to schedule for later" },
        scheduledAt: { type: "string", description: "ISO date for scheduled posts" },
      },
      required: ["text"],
    },
  },
  {
    name: "get_insights",
    description: "Retrieve creator analytics and engagement metrics",
    category: "insights",
    requiresWrite: false,
    inputSchema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["7d", "30d", "90d"], description: "Time period" },
      },
    },
  },
  {
    name: "list_fans",
    description: "List fans/subscribers with tier information",
    category: "fan-management",
    requiresWrite: false,
    inputSchema: {
      type: "object",
      properties: {
        tier: { type: "string", description: "Filter by subscription tier" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_earnings",
    description: "Retrieve earnings summary and transaction history",
    category: "earnings",
    requiresWrite: false,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date (ISO)" },
        to: { type: "string", description: "End date (ISO)" },
      },
    },
  },
  {
    name: "upload_media",
    description: "Upload an image or video for use in posts",
    category: "media",
    requiresWrite: true,
    inputSchema: {
      type: "object",
      properties: {
        fileUrl: { type: "string", description: "Public URL of the file to upload" },
        fileType: { type: "string", enum: ["image", "video"], description: "File type" },
      },
      required: ["fileUrl", "fileType"],
    },
  },
];

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Check whether the MCP integration is configured.
 *
 * Currently always returns "not_configured" since this is a stub.
 * In production, check for `process.env.MCP_SERVER_URL` or a similar
 * environment variable that points to the MCP server endpoint.
 */
export function getMCPStatus(): MCPStatusResult {
  const serverUrl = process.env.MCP_SERVER_URL;

  if (!serverUrl) {
    return {
      status: "not_configured",
      message:
        "MCP server not configured. Set MCP_SERVER_URL environment variable to enable.",
    };
  }

  return {
    status: "configured",
    message: "MCP server is configured and ready.",
    serverUrl,
  };
}

/**
 * List all available MCP capabilities (tools) the server exposes.
 *
 * Returns the static capability list. When a real MCP server is connected,
 * this should send a `tools/list` JSON-RPC request and return the result.
 */
export function listMCPCapabilities(options?: {
  category?: MCPCategory;
  includeWrite?: boolean;
}): MCPCapability[] {
  let results = CAPABILITIES;

  if (options?.category) {
    results = results.filter((c) => c.category === options.category);
  }

  if (!options?.includeWrite) {
    results = results.filter((c) => !c.requiresWrite);
  }

  return results;
}
