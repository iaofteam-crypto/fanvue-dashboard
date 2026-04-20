/**
 * Zod validation schemas for all API endpoints.
 *
 * Every API route should validate its input against these schemas
 * before processing. This provides type-safe parsing with descriptive
 * error messages and prevents malformed data from reaching downstream services.
 *
 * Usage:
 *   import { uploadCreateSchema, chatMessageSchema } from "@/lib/validators";
 *   const result = uploadCreateSchema.safeParse(body);
 *   if (!result.success) return errorResponse(result.error);
 *   const { name, filename, mediaType } = result.data;
 */

import { z } from "zod";

// ─── Shared/Common Schemas ─────────────────────────────────────────────────

/** UUID v4 string */
export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID format"
  );

/** Non-empty string trimmed and normalized */
export const nonEmptyString = z
  .string()
  .min(1, "Required")
  .max(10000, "Too long")
  .transform((s) => s.normalize("NFC").trim());

/** Non-empty string (raw, no transform) for chaining */
export const rawNonEmptyString = z
  .string()
  .min(1, "Required")
  .max(10000, "Too long");

/** Safe string for display names, search queries, etc. */
export const safeNameString = z
  .string()
  .min(1, "Required")
  .max(255, "Too long")
  .transform((s) => s.normalize("NFC").trim());

/** Raw name string (no transform) for chaining */
export const rawNameString = z
  .string()
  .min(1, "Required")
  .max(255, "Too long");

/** Email string */
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .max(254, "Email too long")
  .transform((s) => s.toLowerCase().trim());

/** URL string */
export const urlSchema = z
  .string()
  .url("Invalid URL")
  .max(2048, "URL too long")
  .transform((s) => s.trim());

/** Non-negative integer */
export const nonNegativeInt = z.number().int().min(0);
export const positiveInt = z.number().int().min(1);

/** Pagination: page number (1-based) */
export const pageSchema = z.coerce.number().int().min(1).default(1);

/** Pagination: page size */
export const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

/** ISO date string */
export const isoDateSchema = z
  .string()
  .datetime({ message: "Invalid ISO date" })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"));

/** JSON-safe object (no functions, symbols, etc.) */
export const jsonObjectSchema = z.record(z.string(), z.unknown()).refine(
  (obj) => {
    try {
      JSON.stringify(obj);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Object is not JSON-serializable" }
);

// ─── Media Upload Schemas ──────────────────────────────────────────────────

/** Upload session creation (Step 1 POST /api/fanvue/upload) */
export const uploadCreateSchema = z.object({
  name: rawNonEmptyString.max(500, "Name too long").transform((s) => s.normalize("NFC").trim()),
  filename: rawNonEmptyString.max(500, "Filename too long").transform((s) => s.normalize("NFC").trim()),
  mediaType: z.enum(["image", "video", "audio", "document"], {
    message: "mediaType must be image, video, audio, or document",
  }),
});

/** Upload part query params (Step 2 GET /api/fanvue/upload) */
export const uploadPartQuerySchema = z.object({
  uploadId: uuidSchema,
  partNumber: z.coerce.number().int().min(1).max(10000, "partNumber must be 1-10000"),
});

/** Upload completion (Step 3 PATCH /api/fanvue/upload) */
export const uploadPartSchema = z.object({
  PartNumber: z.number().int().min(1, "PartNumber must be >= 1"),
  ETag: z.string().min(1, "ETag is required").max(200, "ETag too long"),
});

export const uploadCompleteSchema = z.object({
  uploadId: uuidSchema,
  parts: z
    .array(uploadPartSchema)
    .min(1, "At least one part is required")
    .max(10000, "Too many parts"),
});

// ─── Chat / LLM Schemas ───────────────────────────────────────────────────

/** Single chat message */
const chatMessageItemSchema = z.object({
  role: z.enum(["user", "assistant", "system"], {
    message: "role must be user, assistant, or system",
  }),
  content: z.string().max(4000, "Message too long (max 4000 chars)"),
});

/** Chat API request body */
export const chatMessageSchema = z.object({
  messages: z
    .array(chatMessageItemSchema)
    .min(1, "At least one message is required")
    .max(50, "Too many messages (max 50)"),
  mode: z.enum(["ops", "analyst", "creative"]).default("ops").optional(),
});

// ─── Webhook Schemas ───────────────────────────────────────────────────────

/** Webhook event type */
export const webhookEventTypeSchema = z.enum([
  "message-received",
  "message-read",
  "new-follower",
  "new-subscriber",
  "tip-received",
]);

/** Webhook POST body (basic — signature verification happens before this) */
export const webhookPayloadSchema = z.object({
  type: webhookEventTypeSchema,
  messageUuid: uuidSchema.optional(),
  follower: jsonObjectSchema.optional(),
  subscriber: jsonObjectSchema.optional(),
  tip: jsonObjectSchema.optional(),
});

// ─── Fanvue Proxy Schemas ─────────────────────────────────────────────────

/** Generic JSON body for the Fanvue catch-all proxy */
export const fanvueProxyBodySchema = z
  .any()
  .refine(
    (val: unknown) => {
      if (val === null || val === undefined) return true;
      try {
        JSON.stringify(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Body must be JSON-serializable" }
  )
  .optional()
  .default(undefined);

/** Proxy path validation — block sensitive internal paths */
export const proxyPathSchema = z
  .string()
  .refine(
    (path) => {
      const blockedPatterns = [
        /^\.\./,        // directory traversal
        /\/\.\.\//,     // directory traversal in path
        /\/etc\//,      // system paths
        /\/proc\//,     // system paths
        /\/var\//,      // system paths
        /^\//,          // absolute paths
      ];
      return !blockedPatterns.some((p) => p.test(path));
    },
    { message: "Invalid proxy path" }
  );

// ─── Tracking Link Schemas ─────────────────────────────────────────────────

/** Create tracking link */
export const trackingLinkCreateSchema = z.object({
  name: rawNonEmptyString.max(255, "Name too long").transform((s) => s.normalize("NFC").trim()),
  destination: urlSchema,
  source: z
    .string()
    .max(50, "Source too long")
    .transform((s) => s.trim().toLowerCase())
    .optional()
    .default("direct"),
});

// ─── Mass Message Schemas ──────────────────────────────────────────────────

/** Mass message send */
export const massMessageSchema = z.object({
  text: z.string().min(1, "Message text is required").max(5000, "Message too long (max 5000)"),
  mediaUuids: z.array(uuidSchema).max(10, "Maximum 10 media attachments").optional().default([]),
  price: z.number().min(0).optional().default(0),
  includedLists: z.array(z.string()).max(50).optional().default([]),
  excludedLists: z.array(z.string()).max(50).optional().default([]),
});

// ─── Chat Template Schemas ─────────────────────────────────────────────────

/** Chat template category */
export const templateCategorySchema = z.enum([
  "greeting",
  "ppv_offer",
  "re_engagement",
  "thank_you",
  "custom",
]);

/** Create/update chat template */
export const chatTemplateSchema = z.object({
  name: rawNonEmptyString.max(255, "Name too long").transform((s) => s.normalize("NFC").trim()),
  category: templateCategorySchema.default("custom"),
  content: z.string().min(1, "Template content is required").max(1000, "Content too long (max 1000)"),
  mediaUuids: z.array(uuidSchema).max(10).optional().default([]),
  ppvPrice: z.number().min(2, "Minimum PPV price is $2").optional().default(0),
});

// ─── Scheduled Post Schemas ────────────────────────────────────────────────

/** Scheduled post create */
export const scheduledPostSchema = z.object({
  title: rawNonEmptyString.max(500, "Title too long").transform((s) => s.normalize("NFC").trim()),
  content: z.string().max(10000, "Content too long").default(""),
  type: z.enum(["text", "photo", "video", "audio"]).default("text"),
  accessLevel: z.enum(["all", "subscribers", "ppv"]).default("all"),
  ppvPrice: z.number().min(2, "Minimum PPV price is $2").optional().default(0),
  mediaUuids: z.array(uuidSchema).max(10).optional().default([]),
  scheduledAt: z.string().min(1, "Scheduled date/time is required"),
});

// ─── Vault Folder Schemas ──────────────────────────────────────────────────

/** Create vault folder */
export const vaultFolderCreateSchema = z.object({
  name: rawNonEmptyString.max(255, "Folder name too long").transform((s) => s.normalize("NFC").trim()),
});

/** Rename vault folder */
export const vaultFolderRenameSchema = z.object({
  name: rawNonEmptyString.max(255, "Folder name too long").transform((s) => s.normalize("NFC").trim()),
});

// ─── Custom List Schemas ───────────────────────────────────────────────────

/** Create custom list */
export const customListCreateSchema = z.object({
  name: rawNonEmptyString.max(255, "List name too long").transform((s) => s.normalize("NFC").trim()),
  description: z.string().max(1000, "Description too long").trim().optional().default(""),
});

/** Rename custom list */
export const customListRenameSchema = z.object({
  name: rawNonEmptyString.max(255, "List name too long").transform((s) => s.normalize("NFC").trim()),
});

/** Add member to custom list */
export const customListMemberSchema = z.object({
  userId: uuidSchema.or(z.string().min(1, "userId is required").max(100)),
});

// ─── Post Interaction Schemas ──────────────────────────────────────────────

/** Post comment */
export const postCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000, "Comment too long"),
});

// ─── Sync Data Query Schemas ───────────────────────────────────────────────

/** Sync data query params */
export const syncDataQuerySchema = z.object({
  key: z
    .string()
    .max(100, "Key too long")
    .regex(/^[a-z0-9_]+$/, "Invalid key format")
    .optional(),
});

// ─── Webhook Query Schemas ─────────────────────────────────────────────────

/** Webhook polling query params */
export const webhookQuerySchema = z.object({
  since: z.string().datetime({ message: "Invalid since timestamp" }).optional(),
  type: webhookEventTypeSchema.optional(),
});

// ─── Helper: Format Zod Errors ─────────────────────────────────────────────

/**
 * Format a ZodError into a human-readable string.
 * Returns the first error message for simplicity.
 */
export function formatZodError(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) return "Validation failed";

  const path = firstIssue.path.join(".");
  const message = firstIssue.message;

  return path ? `${path}: ${message}` : message;
}

/**
 * Format all Zod errors into an array of strings.
 * Useful for detailed error responses.
 */
export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
