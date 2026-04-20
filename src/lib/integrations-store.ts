/**
 * @module integrations-store
 * @description In-memory store for integration configurations.
 * Manages n8n workflow templates, webhook relay targets, and custom integrations.
 * Data persists in memory only (survives hot reloads, resets on cold start).
 *
 * Namespaces:
 * - `templates`: Custom n8n workflow templates (user-created)
 * - `relayTargets`: External webhook relay targets (n8n, Zapier, Make, custom)
 * - `enabledEvents`: Per-target event type subscriptions
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Supported Fanvue webhook event types */
const SUPPORTED_EVENTS = [
  "message-received",
  "message-read",
  "new-follower",
  "new-subscriber",
  "tip-received",
] as const;

type WebhookEventType = (typeof SUPPORTED_EVENTS)[number];

/** A saved n8n workflow template */
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  /** JSON string of the n8n workflow */
  workflowJson: string;
  /** Which Fanvue events trigger this workflow */
  triggerEvents: WebhookEventType[];
  /** Template category for organization */
  category: "messaging" | "analytics" | "notification" | "automation" | "custom";
  createdAt: number;
  updatedAt: number;
  enabled: boolean;
}

/** A webhook relay target configuration */
interface RelayTarget {
  id: string;
  name: string;
  /** External webhook URL to forward events to */
  url: string;
  /** Optional secret for signing forwarded payloads */
  secret?: string;
  /** Which events to forward (empty = all) */
  events: WebhookEventType[];
  enabled: boolean;
  /** Stats */
  totalForwarded: number;
  lastForwardedAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

/** A forwarded event log entry */
interface RelayLogEntry {
  id: string;
  targetId: string;
  targetName: string;
  eventType: WebhookEventType;
  statusCode: number;
  success: boolean;
  durationMs: number;
  timestamp: number;
  error?: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MAX_CUSTOM_TEMPLATES = 50;
const MAX_RELAY_TARGETS = 20;
const MAX_RELAY_LOG = 500;

const customTemplates: Map<string, WorkflowTemplate> = new Map();
const relayTargets: Map<string, RelayTarget> = new Map();
const relayLog: RelayLogEntry[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a unique ID for store entries
 * @returns A unique string identifier
 */
function generateId(): string {
  return `int_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Validate that all event types are supported
 * @param events - Array of event type strings to validate
 * @returns True if all events are valid
 */
function isValidEvents(events: unknown[]): events is WebhookEventType[] {
  if (!Array.isArray(events)) return false;
  return events.every(
    (e) => typeof e === "string" && (SUPPORTED_EVENTS as readonly string[]).includes(e)
  );
}

// ─── Template CRUD ────────────────────────────────────────────────────────────

/**
 * List all custom workflow templates
 * @returns Array of workflow templates
 */
export function listTemplates(): WorkflowTemplate[] {
  return Array.from(customTemplates.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get a template by ID
 * @param id - The template ID
 * @returns The template or undefined
 */
export function getTemplate(id: string): WorkflowTemplate | undefined {
  return customTemplates.get(id);
}

/**
 * Create a new workflow template
 * @param input - Template creation data
 * @returns The created template or an error message
 */
export function createTemplate(input: {
  name: string;
  description?: string;
  workflowJson: string;
  triggerEvents: WebhookEventType[];
  category?: WorkflowTemplate["category"];
}): { template: WorkflowTemplate } | { error: string } {
  if (customTemplates.size >= MAX_CUSTOM_TEMPLATES) {
    return { error: `Maximum ${MAX_CUSTOM_TEMPLATES} custom templates reached` };
  }
  if (!input.name || input.name.trim().length === 0) {
    return { error: "Template name is required" };
  }
  if (!input.workflowJson || input.workflowJson.trim().length === 0) {
    return { error: "Workflow JSON is required" };
  }
  if (!isValidEvents(input.triggerEvents)) {
    return { error: `Invalid trigger events. Must be one of: ${SUPPORTED_EVENTS.join(", ")}` };
  }

  // Validate JSON is parseable
  try {
    JSON.parse(input.workflowJson);
  } catch {
    return { error: "Workflow JSON is not valid JSON" };
  }

  const template: WorkflowTemplate = {
    id: generateId(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    workflowJson: input.workflowJson,
    triggerEvents: input.triggerEvents,
    category: input.category ?? "custom",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    enabled: true,
  };

  customTemplates.set(template.id, template);
  return { template };
}

/**
 * Update an existing workflow template
 * @param id - The template ID
 * @param updates - Partial template data to update
 * @returns The updated template or an error
 */
export function updateTemplate(
  id: string,
  updates: Partial<Pick<WorkflowTemplate, "name" | "description" | "workflowJson" | "triggerEvents" | "category" | "enabled">>
): { template: WorkflowTemplate } | { error: string } {
  const existing = customTemplates.get(id);
  if (!existing) return { error: "Template not found" };

  if (updates.name !== undefined && updates.name.trim().length === 0) {
    return { error: "Template name cannot be empty" };
  }
  if (updates.workflowJson !== undefined) {
    try {
      JSON.parse(updates.workflowJson);
    } catch {
      return { error: "Workflow JSON is not valid JSON" };
    }
  }
  if (updates.triggerEvents !== undefined && !isValidEvents(updates.triggerEvents)) {
    return { error: `Invalid trigger events. Must be one of: ${SUPPORTED_EVENTS.join(", ")}` };
  }

  const updated: WorkflowTemplate = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
    ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
    ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
  };

  customTemplates.set(id, updated);
  return { template: updated };
}

/**
 * Delete a workflow template
 * @param id - The template ID
 * @returns Success or error
 */
export function deleteTemplate(id: string): { success: boolean } | { error: string } {
  if (!customTemplates.has(id)) return { error: "Template not found" };
  customTemplates.delete(id);
  return { success: true };
}

// ─── Relay Target CRUD ────────────────────────────────────────────────────────

/**
 * List all relay targets
 * @returns Array of relay targets
 */
export function listRelayTargets(): RelayTarget[] {
  return Array.from(relayTargets.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Create a new relay target
 * @param input - Relay target creation data
 * @returns The created target or an error
 */
export function createRelayTarget(input: {
  name: string;
  url: string;
  secret?: string;
  events?: WebhookEventType[];
}): { target: RelayTarget } | { error: string } {
  if (relayTargets.size >= MAX_RELAY_TARGETS) {
    return { error: `Maximum ${MAX_RELAY_TARGETS} relay targets reached` };
  }
  if (!input.name || input.name.trim().length === 0) {
    return { error: "Target name is required" };
  }
  if (!input.url || input.url.trim().length === 0) {
    return { error: "Target URL is required" };
  }
  // Basic URL validation
  try {
    new URL(input.url.trim());
  } catch {
    return { error: "Invalid URL format" };
  }
  if (input.events && !isValidEvents(input.events)) {
    return { error: `Invalid events. Must be one of: ${SUPPORTED_EVENTS.join(", ")}` };
  }

  const target: RelayTarget = {
    id: generateId(),
    name: input.name.trim(),
    url: input.url.trim(),
    secret: input.secret,
    events: input.events ?? [],
    enabled: true,
    totalForwarded: 0,
    lastForwardedAt: null,
    lastError: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  relayTargets.set(target.id, target);
  return { target };
}

/**
 * Update a relay target
 * @param id - Target ID
 * @param updates - Partial update data
 * @returns Updated target or error
 */
export function updateRelayTarget(
  id: string,
  updates: Partial<Pick<RelayTarget, "name" | "url" | "secret" | "events" | "enabled">>
): { target: RelayTarget } | { error: string } {
  const existing = relayTargets.get(id);
  if (!existing) return { error: "Relay target not found" };

  if (updates.url !== undefined) {
    try {
      new URL(updates.url.trim());
    } catch {
      return { error: "Invalid URL format" };
    }
  }
  if (updates.events !== undefined && !isValidEvents(updates.events)) {
    return { error: `Invalid events. Must be one of: ${SUPPORTED_EVENTS.join(", ")}` };
  }

  const updated: RelayTarget = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
    ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
    ...(updates.url !== undefined ? { url: updates.url.trim() } : {}),
  };

  relayTargets.set(id, updated);
  return { target: updated };
}

/**
 * Delete a relay target
 * @param id - Target ID
 * @returns Success or error
 */
export function deleteRelayTarget(id: string): { success: boolean } | { error: string } {
  if (!relayTargets.has(id)) return { error: "Relay target not found" };
  relayTargets.delete(id);
  return { success: true };
}

/**
 * Forward a webhook event to all enabled relay targets
 * @param eventType - The Fanvue event type
 * @param payload - The event payload
 * @returns Array of forwarding results
 */
export async function relayEvent(
  eventType: string,
  payload: unknown
): Promise<{ targetId: string; targetName: string; success: boolean; statusCode: number; durationMs: number; error?: string }[]> {
  const results: { targetId: string; targetName: string; success: boolean; statusCode: number; durationMs: number; error?: string }[] = [];
  const enabledTargets = Array.from(relayTargets.values()).filter((t) => t.enabled);

  for (const target of enabledTargets) {
    // Check if target subscribes to this event type
    if (target.events.length > 0 && !target.events.includes(eventType as WebhookEventType)) {
      continue;
    }

    const start = Date.now();
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Fanvue-Event": eventType,
        "X-Relayed-By": "fanvue-dashboard",
      };

      if (target.secret) {
        // Simple HMAC signature for relayed payloads
        const encoder = new TextEncoder();
        const keyData = encoder.encode(target.secret);
        const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const payloadStr = JSON.stringify(payload);
        const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payloadStr));
        const signature = Array.from(new Uint8Array(signatureBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        headers["X-Relay-Signature"] = `sha256=${signature}`;
      }

      const res = await fetch(target.url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          eventType,
          payload,
          relayedAt: new Date().toISOString(),
          source: "fanvue-dashboard",
        }),
      });

      const duration = Date.now() - start;
      const success = res.ok;

      // Update target stats
      target.totalForwarded++;
      target.lastForwardedAt = Date.now();
      target.lastError = success ? null : `HTTP ${res.status}`;
      target.updatedAt = Date.now();

      results.push({
        targetId: target.id,
        targetName: target.name,
        success,
        statusCode: res.status,
        durationMs: duration,
      });

      // Log entry
      const logEntry: RelayLogEntry = {
        id: generateId(),
        targetId: target.id,
        targetName: target.name,
        eventType: eventType as WebhookEventType,
        statusCode: res.status,
        success,
        durationMs: duration,
        timestamp: Date.now(),
        error: success ? undefined : `HTTP ${res.status}`,
      };
      relayLog.unshift(logEntry);
      if (relayLog.length > MAX_RELAY_LOG) relayLog.length = MAX_RELAY_LOG;
    } catch (err: unknown) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : "Unknown relay error";

      target.lastError = message;
      target.updatedAt = Date.now();

      results.push({
        targetId: target.id,
        targetName: target.name,
        success: false,
        statusCode: 0,
        durationMs: duration,
        error: message,
      });

      const logEntry: RelayLogEntry = {
        id: generateId(),
        targetId: target.id,
        targetName: target.name,
        eventType: eventType as WebhookEventType,
        statusCode: 0,
        success: false,
        durationMs: duration,
        timestamp: Date.now(),
        error: message,
      };
      relayLog.unshift(logEntry);
      if (relayLog.length > MAX_RELAY_LOG) relayLog.length = MAX_RELAY_LOG;
    }
  }

  return results;
}

/**
 * Get relay log entries
 * @param options - Optional filters
 * @returns Array of log entries
 */
export function getRelayLog(options?: { targetId?: string; eventType?: string; limit?: number; since?: number }): RelayLogEntry[] {
  let entries = [...relayLog];

  if (options?.targetId) {
    entries = entries.filter((e) => e.targetId === options.targetId);
  }
  if (options?.eventType) {
    entries = entries.filter((e) => e.eventType === options.eventType);
  }
  if (options?.since != null) {
    const since = options.since as number;
    entries = entries.filter((e) => e.timestamp >= since);
  }

  const limit = options?.limit ?? 50;
  return entries.slice(0, limit);
}

/**
 * Get store statistics
 * @returns Store size information
 */
export function getIntegrationsStoreStats(): {
  templates: number;
  relayTargets: number;
  relayLog: number;
  enabledTargets: number;
  totalForwarded: number;
} {
  const targets = Array.from(relayTargets.values());
  return {
    templates: customTemplates.size,
    relayTargets: relayTargets.size,
    relayLog: relayLog.length,
    enabledTargets: targets.filter((t) => t.enabled).length,
    totalForwarded: targets.reduce((sum, t) => sum + t.totalForwarded, 0),
  };
}
