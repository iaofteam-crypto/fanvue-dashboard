/**
 * SEC-3: Zod Validation Schemas for API Inputs
 *
 * Centralized, strongly-typed validation for all API input surfaces.
 * All API routes should use these schemas instead of manual validation.
 */

import { z } from "zod";

// ─── Chat Message Schema ─────────────────────────────────────────────────────

/**
 * Validates a single chat message in the AELIANA conversation.
 * Mirrors the existing manual validation in /api/chat/route.ts.
 */
export const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"], {
    error: "Role must be 'user', 'assistant', or 'system'",
  }),
  content: z
    .string()
    .min(1, "Message content is required")
    .max(4000, "Message content must be 4000 characters or less"),
});

export type MessageInput = z.infer<typeof messageSchema>;

/**
 * Validates the full chat request body (array of messages + optional mode).
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1, "At least one message is required")
    .max(50, "Maximum 50 messages allowed"),
  mode: z.enum(["ops", "creative", "analytics"]).optional().default("ops"),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

// ─── Sync Data Key Schema ────────────────────────────────────────────────────

/**
 * Validates sync data keys used in /api/sync-data.
 * Keys must be alphanumeric with hyphens, max 50 characters.
 * Matches known keys: me, earnings, subscribers, followers, chats, posts, media, etc.
 */
export const syncKeySchema = z
  .string()
  .min(1, "Sync key is required")
  .max(50, "Sync key must be 50 characters or less")
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
    "Sync key must start with an alphanumeric character and contain only letters, numbers, underscores, and hyphens"
  );

export type SyncKeyInput = z.infer<typeof syncKeySchema>;

// ─── Webhook Event Schema ────────────────────────────────────────────────────

/** Known Fanvue webhook event types */
const webhookEventTypes = [
  "message-received",
  "message-read",
  "new-follower",
  "new-subscriber",
  "tip-received",
] as const;

export type WebhookEventType = (typeof webhookEventTypes)[number];

/** Base fields common to all webhook events */
const webhookBaseSchema = z.object({
  type: z.enum(webhookEventTypes, {
    error: "Unknown webhook event type",
  }),
});

/** message-received: requires messageUuid */
const messageReceivedSchema = webhookBaseSchema.extend({
  type: z.literal("message-received"),
  messageUuid: z.string().min(1, "messageUuid is required"),
});

/** message-read: requires messageUuid */
const messageReadSchema = webhookBaseSchema.extend({
  type: z.literal("message-read"),
  messageUuid: z.string().min(1, "messageUuid is required"),
});

/** new-follower: requires follower object */
const newFollowerSchema = webhookBaseSchema.extend({
  type: z.literal("new-follower"),
  follower: z.record(z.string(), z.unknown(), {
    error: "follower must be an object",
  }),
});

/** new-subscriber: requires subscriber object */
const newSubscriberSchema = webhookBaseSchema.extend({
  type: z.literal("new-subscriber"),
  subscriber: z.record(z.string(), z.unknown(), {
    error: "subscriber must be an object",
  }),
});

/** tip-received: requires tip object */
const tipReceivedSchema = webhookBaseSchema.extend({
  type: z.literal("tip-received"),
  tip: z.record(z.string(), z.unknown(), {
    error: "tip must be an object",
  }),
});

/**
 * Discriminated union of all webhook event payloads.
 * Validates type and type-specific required fields in a single pass.
 */
export const webhookEventSchema = z.discriminatedUnion("type", [
  messageReceivedSchema,
  messageReadSchema,
  newFollowerSchema,
  newSubscriberSchema,
  tipReceivedSchema,
]);

export type WebhookEventInput = z.infer<typeof webhookEventSchema>;

// ─── Chat Template Schema ────────────────────────────────────────────────────

/** Template variable format: {{variable_name}} */
const templateVariablePattern = /^\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}$/;

/**
 * Validates chat template creation/update payloads.
 * Matches the ChatTemplate interface used in chat-templates-section.tsx.
 */
export const chatTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Template name is required")
    .max(100, "Template name must be 100 characters or less"),
  content: z
    .string()
    .min(1, "Template content is required")
    .max(1000, "Template content must be 1000 characters or less"),
  category: z
    .enum(["greeting", "ppv_offer", "re_engagement", "thank_you", "custom"], {
      error: "Invalid template category",
    })
    .optional()
    .default("custom"),
  variables: z
    .array(
      z.string().regex(templateVariablePattern, "Variable must match {{variable_name}} format")
    )
    .optional()
    .default([]),
  mediaUuids: z.array(z.string().uuid()).optional().default([]),
  ppvPrice: z
    .number()
    .min(2, "PPV price must be at least $2.00")
    .max(999.99, "PPV price must be $999.99 or less")
    .optional(),
});

export type ChatTemplateInput = z.infer<typeof chatTemplateSchema>;

// ─── API Response Schemas (CODE-1) ────────────────────────────────────────────
//
// Validation schemas for API response bodies. These should be used on the
// client side to validate fetch responses before consuming the data, and can
// also be used server-side for response mocking / testing.

// ─── Auth Status Response ─────────────────────────────────────────────────────

/**
 * Validates the response from GET /api/auth/status.
 * Returns connection state with optional token metadata.
 */
export const authStatusResponseSchema = z.object({
  connected: z.boolean(),
  expiresAt: z.string().optional(),
  isExpired: z.boolean().optional(),
  scope: z.string().nullable().optional(),
});

export type AuthStatusResponse = z.infer<typeof authStatusResponseSchema>;

// ─── Sync Response ────────────────────────────────────────────────────────────

/**
 * Validates the response from POST /api/sync.
 * `fanvue` is either a result object with synced/failed arrays or the literal "skipped".
 * `repo` is a descriptive string (e.g. "synced (3 discoveries)" or "error: …").
 */
export const syncResponseSchema = z.object({
  success: z.boolean(),
  fanvue: z.union([
    z.object({
      synced: z.array(z.string()),
      failed: z.array(z.string()),
    }),
    z.literal("skipped"),
  ]),
  repo: z.string(),
});

export type SyncResponse = z.infer<typeof syncResponseSchema>;

// ─── Chat Response ────────────────────────────────────────────────────────────

/**
 * Validates the response from POST /api/chat.
 * Contains the LLM-generated assistant message.
 */
export const chatResponseSchema = z.object({
  message: z.string(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

// ─── Webhook Events Response ──────────────────────────────────────────────────

/** A single stored webhook event (mirrors the WebhookEvent interface in the route) */
const webhookStoredEventSchema = z.object({
  id: z.string(),
  type: z.enum(webhookEventTypes),
  receivedAt: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

/**
 * Validates the response from GET /api/webhooks/fanvue.
 * Returns a paginated list of stored webhook events.
 */
export const webhookEventsResponseSchema = z.object({
  events: z.array(webhookStoredEventSchema),
  total: z.number().int().min(0),
  returned: z.number().int().min(0),
});

export type WebhookEventsResponse = z.infer<typeof webhookEventsResponseSchema>;
