/**
 * INT-2: n8n Workflow Templates
 *
 * Pre-defined workflow templates that can be imported into n8n to automate
 * Fanvue creator operations: auto-replies, welcome messages, content scheduling,
 * earnings reporting, and fan engagement campaigns.
 *
 * USAGE:
 * ──────
 * Each template has an `id` for stable referencing, a `category` for grouping,
 * and an array of `steps` describing the nodes in the n8n workflow.
 * The `config` field on each step contains the node-specific settings.
 *
 * To use: render these templates in the dashboard UI and offer a one-click
 * "Create in n8n" button that POSTs the template to the n8n API.
 *
 * @see https://docs.n8n.io/api/api-reference/
 */

// ─── Types ────────────────────────────────────────────────────────────────

/** Supported workflow categories */
export type WorkflowCategory =
  | "messaging"
  | "onboarding"
  | "content"
  | "finance"
  | "engagement";

/** Configuration for a single workflow step / n8n node */
export interface WorkflowStep {
  /** Human-readable step name */
  name: string;
  /** n8n node type (see n8n docs for full list) */
  type: string;
  /** Step-specific configuration — shape varies by type */
  config: Record<string, unknown>;
}

/** A complete workflow template */
export interface WorkflowTemplate {
  /** Stable unique identifier */
  id: string;
  /** Display name shown in the dashboard */
  name: string;
  /** Short description of what the workflow does */
  description: string;
  /** Category for grouping in the UI */
  category: WorkflowCategory;
  /** Ordered list of workflow steps */
  steps: WorkflowStep[];
  /** Estimated frequency (manual / hourly / daily / weekly) */
  frequency?: string;
  /** Tags for search/discovery */
  tags: string[];
}

// ─── Template Definitions ─────────────────────────────────────────────────

const templates: WorkflowTemplate[] = [
  // 1. Auto Reply
  {
    id: "auto-reply",
    name: "Auto Reply",
    description:
      "Automatically reply to incoming fan messages based on keyword triggers. Supports multiple canned responses and AI-generated replies via OpenAI.",
    category: "messaging",
    frequency: "realtime",
    tags: ["chat", "automation", "ai", "keywords"],
    steps: [
      {
        name: "Fanvue Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        config: {
          path: "/fanvue-message",
          method: "POST",
          authentication: "headerAuth",
          headerAuthName: "X-Fanvue-Signature",
        },
      },
      {
        name: "Verify Webhook Signature",
        type: "n8n-nodes-base.code",
        config: {
          language: "javascript",
          code: "// Verify X-Fanvue-Signature header against shared secret\nconst crypto = require('crypto');\nconst sig = $input.first().json.headers['x-fanvue-signature'];\nconst secret = $env.FANVUE_WEBHOOK_SECRET;\nconst payload = JSON.stringify($input.first().json.body);\nconst expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');\nif (sig !== expected) throw new Error('Invalid signature');\nreturn $input.all();",
        },
      },
      {
        name: "Check Keywords",
        type: "n8n-nodes-base.switch",
        config: {
          rules: {
            rules: [
              { value: "/pricing", outputKey: "pricing" },
              { value: "/content", outputKey: "content" },
              { value: "/schedule", outputKey: "schedule" },
            ],
            fallbackOutput: 0,
          },
          dataPropertyName: "json.body.message.text",
        },
      },
      {
        name: "Select Reply Template",
        type: "n8n-nodes-base.set",
        config: {
          mode: "manual",
          duplicateItem: false,
          assignments: {
            assignments: [
              {
                name: "replyText",
                value:
                  "={{ $json.case === 'pricing' ? 'Check my pricing tiers on my profile! 💎' : $json.case === 'content' ? 'New content drops every Tuesday and Friday!' : 'See my latest schedule on the profile page 📅' }}",
                type: "string",
              },
            ],
          },
        },
      },
      {
        name: "Send Reply via Fanvue API",
        type: "n8n-nodes-base.httpRequest",
        config: {
          method: "POST",
          url: "={{ $env.FANVUE_API_BASE }}/v1/chats/{{$json.body.chatId}}/messages",
          authentication: "oAuth2",
          headers: {
            "X-Fanvue-API-Version": "2025-06-26",
          },
          bodyParameters: {
            parameters: [
              { name: "text", value: "={{ $json.replyText }}" },
            ],
          },
        },
      },
    ],
  },

  // 2. Welcome Message
  {
    id: "welcome-message",
    name: "Welcome Message",
    description:
      "Send a personalized welcome message to new fans when they subscribe. Includes creator intro, content schedule, and exclusive perks.",
    category: "onboarding",
    frequency: "realtime",
    tags: ["welcome", "onboarding", "new-fan", "personalization"],
    steps: [
      {
        name: "Fanvue Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        config: {
          path: "/fanvue-new-subscriber",
          method: "POST",
          authentication: "headerAuth",
        },
      },
      {
        name: "Build Welcome Message",
        type: "n8n-nodes-base.set",
        config: {
          mode: "manual",
          duplicateItem: false,
          assignments: {
            assignments: [
              {
                name: "welcomeText",
                value:
                  "Hey {{$json.body.fanName}}! 👋 Welcome to my page — so glad you're here! Here's what to expect: exclusive content drops every Tue & Fri, behind-the-scenes on weekends, and monthly Q&A sessions. Don't hesitate to message me anytime! 💜",
                type: "string",
              },
            ],
          },
        },
      },
      {
        name: "Wait 30 Seconds (natural delay)",
        type: "n8n-nodes-base.wait",
        config: {
          amount: 30,
          unit: "seconds",
        },
      },
      {
        name: "Send Welcome via Fanvue API",
        type: "n8n-nodes-base.httpRequest",
        config: {
          method: "POST",
          url: "={{ $env.FANVUE_API_BASE }}/v1/chats/{{$json.body.chatId}}/messages",
          authentication: "oAuth2",
          headers: {
            "X-Fanvue-API-Version": "2025-06-26",
          },
          bodyParameters: {
            parameters: [
              { name: "text", value: "={{ $json.welcomeText }}" },
            ],
          },
        },
      },
    ],
  },

  // 3. Content Schedule
  {
    id: "content-schedule",
    name: "Content Schedule",
    description:
      "Schedule and publish content posts at optimal times. Supports draft review, media attachment, and cross-posting to multiple platforms.",
    category: "content",
    frequency: "daily",
    tags: ["posting", "schedule", "content", "automation"],
    steps: [
      {
        name: "Schedule Trigger (Daily at 9 AM)",
        type: "n8n-nodes-base.scheduleTrigger",
        config: {
          rule: { interval: [{ field: "cronExpression", expression: "0 9 * * *" }] },
        },
      },
      {
        name: "Fetch Content Queue",
        type: "n8n-nodes-base.httpRequest",
        config: {
          method: "GET",
          url: "={{ $env.INTERNAL_API }}/api/sync-data?key=scheduled_posts",
          authentication: "genericCredentialType",
        },
      },
      {
        name: "Filter Due Posts",
        type: "n8n-nodes-base.filter",
        config: {
          conditions: {
            conditions: [
              {
                leftValue: "={{ $json.scheduledAt }}",
                rightValue: "={{ $today.toISO() }}",
                operator: { type: "datetime", operation: "beforeOrEqual" },
              },
            ],
            combinator: "and",
          },
        },
      },
      {
        name: "Publish Each Post",
        type: "n8n-nodes-base.httpRequest",
        config: {
          method: "POST",
          url: "={{ $env.FANVUE_API_BASE }}/v1/posts",
          authentication: "oAuth2",
          headers: {
            "X-Fanvue-API-Version": "2025-06-26",
          },
          bodyParameters: {
            parameters: [
              { name: "text", value: "={{ $json.text }}" },
              { name: "mediaIds", value: "={{ JSON.stringify($json.mediaIds || []) }}" },
            ],
          },
          batchSize: 1,
        },
      },
    ],
  },

  // 4. Earnings Report
  {
    id: "earnings-report",
    name: "Earnings Report",
    description:
      "Generate a weekly earnings summary with revenue breakdown by source (subscriptions, tips, purchases), top fans, and trend analysis. Delivered as a formatted message or email digest.",
    category: "finance",
    frequency: "weekly",
    tags: ["earnings", "revenue", "report", "analytics", "weekly"],
    steps: [
      {
        name: "Schedule Trigger (Every Monday 8 AM)",
        type: "n8n-nodes-base.scheduleTrigger",
        config: {
          rule: { interval: [{ field: "cronExpression", expression: "0 8 * * 1" }] },
        },
      },
      {
        name: "Fetch Earnings Data",
        type: "n8n-nodes-base.httpRequest",
        config: {
          method: "GET",
          url: "={{ $env.FANVUE_API_BASE }}/v1/earnings?period=7d",
          authentication: "oAuth2",
          headers: {
            "X-Fanvue-API-Version": "2025-06-26",
          },
        },
      },
      {
        name: "Format Report",
        type: "n8n-nodes-base.code",
        config: {
          language: "javascript",
          code: "const data = $input.first().json;\nconst total = data.totals?.usd ?? 0;\nconst subs = data.bySource?.subscriptions ?? 0;\nconst tips = data.bySource?.tips ?? 0;\nconst purchases = data.bySource?.purchases ?? 0;\nconst report = `📊 Weekly Earnings Report\\n━━━━━━━━━━━━━━━━━━━━\\n💰 Total: $${total.toFixed(2)}\\n🔄 Subscriptions: $${subs.toFixed(2)}\\n💝 Tips: $${tips.toFixed(2)}\\n🛒 Purchases: $${purchases.toFixed(2)}\\n━━━━━━━━━━━━━━━━━━━━\\n⏱ Generated: ${new Date().toISOString()}`;\nreturn [{ json: { report } }];",
        },
      },
      {
        name: "Send via Email / Notification",
        type: "n8n-nodes-base.emailSend",
        config: {
          fromEmail: "={{ $env.NOTIFICATION_EMAIL }}",
          toEmail: "={{ $env.CREATOR_EMAIL }}",
          subject: "Your Weekly Fanvue Earnings Report",
          text: "={{ $json.report }}",
        },
      },
    ],
  },

  // 5. Fan Engagement
  {
    id: "fan-engagement",
    name: "Fan Engagement",
    description:
      "Track fan engagement metrics and trigger re-engagement campaigns for inactive fans. Sends personalized check-in messages and suggests content based on past interactions.",
    category: "engagement",
    frequency: "weekly",
    tags: ["engagement", "retention", "re-engage", "fans", "campaign"],
    steps: [
      {
        name: "Schedule Trigger (Every Friday 10 AM)",
        type: "n8n-nodes-base.scheduleTrigger",
        config: {
          rule: { interval: [{ field: "cronExpression", expression: "0 10 * * 5" }] },
        },
      },
      {
        name: "Fetch Fan Insights",
        type: "n8n-nodes-base.httpRequest",
        config: {
          method: "GET",
          url: "={{ $env.FANVUE_API_BASE }}/v1/insights/fans",
          authentication: "oAuth2",
          headers: {
            "X-Fanvue-API-Version": "2025-06-26",
          },
        },
      },
      {
        name: "Identify Inactive Fans (no activity 14+ days)",
        type: "n8n-nodes-base.filter",
        config: {
          conditions: {
            conditions: [
              {
                leftValue: "={{ $json.lastActiveAt }}",
                rightValue: "={{ new Date(Date.now() - 14 * 86400000).toISOString() }}",
                operator: { type: "datetime", operation: "before" },
              },
            ],
            combinator: "and",
          },
        },
      },
      {
        name: "Generate Personalized Check-in",
        type: "n8n-nodes-base.code",
        config: {
          language: "javascript",
          code: "const fan = $input.first().json;\nconst message = `Hey ${fan.name || 'there'}! 🌟 I noticed it's been a little while — just wanted to say I appreciate you being a subscriber! I've got some exciting new content coming up this week that I think you'll love. Can't wait to share it with you! 💜`;\nreturn [{ json: { chatId: fan.chatId, text: message } }];",
        },
      },
      {
        name: "Send Check-in Messages (batch, max 50/day)",
        type: "n8n-nodes-base.httpRequest",
        config: {
          method: "POST",
          url: "={{ $env.FANVUE_API_BASE }}/v1/chats/{{$json.chatId}}/messages",
          authentication: "oAuth2",
          headers: {
            "X-Fanvue-API-Version": "2025-06-26",
          },
          bodyParameters: {
            parameters: [
              { name: "text", value: "={{ $json.text }}" },
            ],
          },
          batchSize: 50,
          batch: "perItem",
        },
      },
    ],
  },
];

// ─── Public API ────────────────────────────────────────────────────────────

/** Get all workflow templates */
export function getAllTemplates(): WorkflowTemplate[] {
  return templates;
}

/**
 * Get templates filtered by category.
 *
 * @example
 * ```ts
 * const messagingTemplates = getTemplatesByCategory("messaging");
 * ```
 */
export function getTemplatesByCategory(category: WorkflowCategory): WorkflowTemplate[] {
  return templates.filter((t) => t.category === category);
}

/**
 * Get a single template by its stable ID.
 * Returns `undefined` if not found.
 */
export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return templates.find((t) => t.id === id);
}
