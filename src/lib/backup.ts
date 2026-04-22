/**
 * Database Backup Strategy
 *
 * Provides utilities for:
 * - Exporting all in-memory data as JSON (for backup / migration)
 * - Importing data from JSON (for restore)
 * - Reporting the current persistence status
 * - Creating full backup snapshots
 * - Validating backup structure
 * - Restoring from snapshots
 * - Formatting byte sizes
 *
 * IMPORTANT:
 * ──────────
 * - In-memory data is LOST on every Vercel cold start (serverless).
 * - Vercel KV data survives cold starts but has a 24h TTL on most keys.
 */

import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────

export interface BackupData {
  exportedAt: string;
  version: string;
  environment: string;
  stores: {
    tokens: Array<Record<string, unknown>>;
    syncLogs: Array<Record<string, unknown>>;
    discoveries: Array<Record<string, unknown>>;
    syncedData: Array<Record<string, unknown>>;
  };
  meta: {
    tokenCount: number;
    syncLogCount: number;
    discoveryCount: number;
    syncedDataCount: number;
  };
}

export interface BackupStatus {
  /** Whether Vercel KV is configured */
  kvConfigured: boolean;
  /** Total number of in-memory records across all stores */
  inMemoryRecordCount: number;
  /** Breakdown by store */
  stores: Array<{
    name: string;
    inMemoryCount: number;
    kvPersisted: boolean;
    kvTTL: string | null;
  }>;
  /** Last sync timestamp (if available from syncedData) */
  lastSyncAt: string | null;
  /** Recommended action */
  recommendation: string;
}

/** Summary of per-store record counts in a backup snapshot */
export interface BackupStoreSummary {
  tokens: number;
  syncLogs: number;
  discoveries: number;
  syncedData: number;
  auditLogs: number;
  integrationTemplates: number;
  relayTargets: number;
  payments: number;
  totalRecords: number;
  totalSizeBytes: number;
}

/** A full backup snapshot with all store data and metadata */
export interface BackupSnapshot {
  version: string;
  exportedAt: string;
  environment: string;
  options: {
    includeEphemeral: boolean;
    includePayments: boolean;
    includeAuditLogs: boolean;
  };
  summary: BackupStoreSummary;
  stores: {
    tokens: Array<Record<string, unknown>>;
    syncLogs: Array<Record<string, unknown>>;
    discoveries: Array<Record<string, unknown>>;
    syncedData: Array<Record<string, unknown>>;
    auditLogs: Array<Record<string, unknown>>;
    integrationTemplates: Array<Record<string, unknown>>;
    relayTargets: Array<Record<string, unknown>>;
    payments: Array<Record<string, unknown>>;
  };
}

/** Options for creating a backup */
export interface BackupCreateOptions {
  includeEphemeral?: boolean;
  includePayments?: boolean;
  includeAuditLogs?: boolean;
}

/** Options for restoring from a backup */
export interface RestoreOptions {
  dryRun?: boolean;
  restoreSyncedData?: boolean;
  restoreAuditLogs?: boolean;
  restoreIntegrations?: boolean;
  restorePayments?: boolean;
  restoreMonitoring?: boolean;
  restoreTokens?: boolean;
}

/** Result of a backup validation */
export interface BackupValidation {
  valid: boolean;
  errors: string[];
}

/** Counts of restored items per store */
export interface RestoreCounts {
  syncedData: number;
  discoveries: number;
  auditLogs: number;
  integrationTemplates: number;
  relayTargets: number;
  tokens: number;
  payments: number;
}

/** Result of a restore operation */
export interface RestoreResult {
  success: boolean;
  restored: RestoreCounts;
  skipped: string[];
  errors: string[];
}

/** Store size summary for the dashboard */
export interface StoreSummary {
  totalSizeBytes: number;
  tokens: number;
  syncLogs: number;
  discoveries: number;
  syncedData: number;
  auditLogs: number;
  integrationTemplates: number;
  relayTargets: number;
  payments: number;
  monitoring: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Format a byte count to a human-readable string.
 *
 * @param bytes - The byte count.
 * @param decimals - Number of decimal places (default 2).
 * @returns A formatted string like "1.5 MB" or "256 B".
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  if (bytes < 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  if (i < 0 || i >= sizes.length) return `${bytes} B`;

  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/** Estimate the byte size of a JSON-serializable value */
function estimateByteSize(data: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(data)).length;
  } catch {
    return 0;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Export all in-memory store data as a JSON-serializable object.
 */
export async function exportAllData(): Promise<BackupData> {
  const [tokens, syncLogs, discoveries, syncedDataMap] = await Promise.all([
    db.oAuthToken.findUnique({ where: { id: "fanvue_primary" } }),
    db.syncLog.findMany({ take: 500 }),
    db.discovery.findMany({ take: 500 }),
    db.syncedData.getAll(),
  ]);

  const tokenList = tokens ? [tokens] : [];
  const syncedDataList = Object.values(syncedDataMap);

  const backup: BackupData = {
    exportedAt: new Date().toISOString(),
    version: process.env.npm_package_version || "0.0.0",
    environment: process.env.NODE_ENV || "development",
    stores: {
      tokens: tokenList.map((t) => ({ ...t })),
      syncLogs: syncLogs.map((l) => ({ ...l })),
      discoveries: discoveries.map((d) => ({ ...d })),
      syncedData: syncedDataList.map((s) => ({ ...s })),
    },
    meta: {
      tokenCount: tokenList.length,
      syncLogCount: syncLogs.length,
      discoveryCount: discoveries.length,
      syncedDataCount: syncedDataList.length,
    },
  };

  console.log(
    `[backup] Exported ${backup.meta.tokenCount} tokens, ` +
      `${backup.meta.syncLogCount} sync logs, ` +
      `${backup.meta.discoveryCount} discoveries, ` +
      `${backup.meta.syncedDataCount} synced data entries`,
  );

  return backup;
}

/**
 * Import data from a JSON backup (restore).
 *
 * @param json - The backup JSON string or parsed BackupData object.
 * @returns Summary of what was restored.
 */
export async function importData(
  json: string | BackupData,
): Promise<{
  success: boolean;
  message: string;
  restoredCounts?: BackupData["meta"];
}> {
  let data: BackupData;

  try {
    data = typeof json === "string" ? JSON.parse(json) as BackupData : json;
  } catch {
    return {
      success: false,
      message: "Invalid backup JSON: could not parse",
    };
  }

  if (!data.stores || !data.meta || !data.exportedAt) {
    return {
      success: false,
      message: "Invalid backup format: missing required fields (stores, meta, exportedAt)",
    };
  }

  console.log(
    `[backup] Restore requested (STUB — no data mutated): ` +
      `${data.meta.tokenCount} tokens, ` +
      `${data.meta.syncLogCount} sync logs, ` +
      `${data.meta.discoveryCount} discoveries, ` +
      `${data.meta.syncedDataCount} synced data entries ` +
      `(from ${data.exportedAt}, env: ${data.environment || "unknown"})`,
  );

  return {
    success: true,
    message: "Restore logged (STUB mode — no data was actually mutated). Implement real restore for production use.",
    restoredCounts: data.meta,
  };
}

/**
 * Get the current backup / persistence status.
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  const kvConfigured = !!process.env.KV_REST_API_URL;

  const [tokens, syncLogs, discoveries, syncedDataMap] = await Promise.all([
    db.oAuthToken.findUnique({ where: { id: "fanvue_primary" } }),
    db.syncLog.findMany({ take: 500 }),
    db.discovery.findMany({ take: 500 }),
    db.syncedData.getAll(),
  ]);

  const tokenCount = tokens ? 1 : 0;
  const syncedDataList = Object.values(syncedDataMap);

  let lastSyncAt: string | null = null;
  for (const record of syncedDataList) {
    if (!lastSyncAt || record.syncedAt > lastSyncAt) {
      lastSyncAt = record.syncedAt;
    }
  }

  const totalRecords = tokenCount + syncLogs.length + discoveries.length + syncedDataList.length;

  const stores: BackupStatus["stores"] = [
    {
      name: "tokens",
      inMemoryCount: tokenCount,
      kvPersisted: kvConfigured,
      kvTTL: kvConfigured ? "24h" : null,
    },
    {
      name: "syncLogs",
      inMemoryCount: syncLogs.length,
      kvPersisted: false,
      kvTTL: null,
    },
    {
      name: "discoveries",
      inMemoryCount: discoveries.length,
      kvPersisted: false,
      kvTTL: null,
    },
    {
      name: "syncedData",
      inMemoryCount: syncedDataList.length,
      kvPersisted: kvConfigured,
      kvTTL: kvConfigured ? "24h" : null,
    },
  ];

  let recommendation: string;
  if (!kvConfigured) {
    if (totalRecords === 0) {
      recommendation = "No data to persist. Configure Vercel KV for production.";
    } else {
      recommendation =
        "⚠️ Data is in-memory only and will be lost on cold starts. Configure Vercel KV (KV_REST_API_URL + KV_REST_API_TOKEN) for persistence.";
    }
  } else if (totalRecords > 100) {
    recommendation =
      "KV is configured but some stores (syncLogs, discoveries) are memory-only. Consider enabling KV persistence for all stores or scheduling regular exports.";
  } else {
    recommendation = "Persistence looks good. Consider scheduling daily backups via exportAllData().";
  }

  return {
    kvConfigured,
    inMemoryRecordCount: totalRecords,
    stores,
    lastSyncAt,
    recommendation,
  };
}

// ─── New API (structured snapshot) ───────────────────────────────────────

/**
 * Create a full backup snapshot with all store data.
 *
 * @param options - Backup creation options.
 * @returns A complete {@link BackupSnapshot} with all stores and metadata.
 */
export async function createBackup(
  options: BackupCreateOptions = {},
): Promise<BackupSnapshot> {
  const includeEphemeral = options.includeEphemeral ?? false;
  const includePayments = options.includePayments ?? true;
  const includeAuditLogs = options.includeAuditLogs ?? true;

  const [tokens, syncLogs, discoveries, syncedDataMap] = await Promise.all([
    db.oAuthToken.findUnique({ where: { id: "fanvue_primary" } }),
    db.syncLog.findMany({ take: 500 }),
    db.discovery.findMany({ take: 500 }),
    db.syncedData.getAll(),
  ]);

  const tokenList = tokens ? [tokens] : [];
  const syncedDataList = Object.values(syncedDataMap);

  // Import audit logs if requested
  let auditLogs: Array<Record<string, unknown>> = [];
  if (includeAuditLogs) {
    try {
      const { getAuditLogs } = await import("@/lib/audit-log");
      const logs = getAuditLogs({ limit: 500 });
      auditLogs = logs.map((entry) => ({ ...entry }));
    } catch {
      // Audit log import may fail — continue without it
    }
  }

  // Import integration templates
  let integrationTemplates: Array<Record<string, unknown>> = [];
  if (includeEphemeral) {
    try {
      const { listTemplates } = await import("@/lib/integrations-store");
      integrationTemplates = listTemplates().map((t) => ({ ...t }));
    } catch {
      // Integration store may not be available
    }
  }

  // Import relay targets
  let relayTargets: Array<Record<string, unknown>> = [];
  if (includeEphemeral) {
    try {
      const { listRelayTargets } = await import("@/lib/integrations-store");
      relayTargets = listRelayTargets().map((t) => ({ ...t }));
    } catch {
      // Integration store may not be available
    }
  }

  // Import payments data if requested
  let payments: Array<Record<string, unknown>> = [];
  if (includePayments) {
    try {
      const { listPayments } = await import("@/lib/payments-store");
      payments = listPayments({ limit: 500 }).map((p: Record<string, unknown>) => ({ ...p }));
    } catch {
      // Payments store may not be available
    }
  }

  const summary: BackupStoreSummary = {
    tokens: tokenList.length,
    syncLogs: syncLogs.length,
    discoveries: discoveries.length,
    syncedData: syncedDataList.length,
    auditLogs: auditLogs.length,
    integrationTemplates: integrationTemplates.length,
    relayTargets: relayTargets.length,
    payments: payments.length,
    totalRecords:
      tokenList.length +
      syncLogs.length +
      discoveries.length +
      syncedDataList.length +
      auditLogs.length +
      integrationTemplates.length +
      relayTargets.length +
      payments.length,
    totalSizeBytes: estimateByteSize({
      tokens: tokenList,
      syncLogs: syncLogs.map((l) => ({ ...l })),
      discoveries: discoveries.map((d) => ({ ...d })),
      syncedData: syncedDataList,
      auditLogs,
      integrationTemplates,
      relayTargets,
      payments,
    }),
  };

  const snapshot: BackupSnapshot = {
    version: process.env.npm_package_version || "0.0.0",
    exportedAt: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    options: {
      includeEphemeral,
      includePayments,
      includeAuditLogs,
    },
    summary,
    stores: {
      tokens: tokenList.map((t) => ({ ...t })),
      syncLogs: syncLogs.map((l) => ({ ...l })),
      discoveries: discoveries.map((d) => ({ ...d })),
      syncedData: syncedDataList.map((s) => ({ ...s })),
      auditLogs,
      integrationTemplates,
      relayTargets,
      payments,
    },
  };

  console.log(
    `[backup] Created snapshot: ${summary.totalRecords} records, ${formatBytes(summary.totalSizeBytes)}`,
  );

  return snapshot;
}

/**
 * Validate a backup JSON structure.
 *
 * Checks for required top-level fields and basic structural integrity.
 *
 * @param data - Parsed JSON data to validate.
 * @returns A {@link BackupValidation} with `valid` flag and any error messages.
 */
export function validateBackup(data: unknown): BackupValidation {
  const errors: string[] = [];

  if (data === null || data === undefined || typeof data !== "object") {
    return { valid: false, errors: ["Backup must be a non-null object"] };
  }

  const obj = data as Record<string, unknown>;

  // Check required top-level string fields
  for (const field of ["version", "exportedAt", "environment"]) {
    if (typeof obj[field] !== "string" || (obj[field] as string).length === 0) {
      errors.push(`Missing or invalid required field: ${field}`);
    }
  }

  // Check stores object
  if (!obj.stores || typeof obj.stores !== "object" || Array.isArray(obj.stores)) {
    errors.push("Missing or invalid 'stores' object");
  } else {
    const stores = obj.stores as Record<string, unknown>;
    for (const storeName of ["tokens", "syncLogs", "discoveries", "syncedData"]) {
      if (!Array.isArray(stores[storeName])) {
        errors.push(`Missing or invalid store array: stores.${storeName}`);
      }
    }
  }

  // Check summary object
  if (!obj.summary || typeof obj.summary !== "object" || Array.isArray(obj.summary)) {
    errors.push("Missing or invalid 'summary' object");
  } else {
    const summary = obj.summary as Record<string, unknown>;
    if (typeof summary.totalRecords !== "number") {
      errors.push("Missing or invalid summary.totalRecords");
    }
    if (typeof summary.totalSizeBytes !== "number") {
      errors.push("Missing or invalid summary.totalSizeBytes");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Restore data from a validated backup snapshot.
 *
 * In memory-only mode, this performs a dry simulation. In production with
 * a real database, it would restore each store.
 *
 * @param snapshot - A validated backup snapshot.
 * @param options - Restore options (dryRun, which stores to restore, etc.).
 * @returns A {@link RestoreResult} with counts of restored items and any errors.
 */
export async function restoreBackup(
  snapshot: BackupSnapshot,
  options: RestoreOptions = {},
): Promise<RestoreResult> {
  const dryRun = options.dryRun ?? false;
  const errors: string[] = [];
  const skipped: string[] = [];

  const restored: RestoreCounts = {
    syncedData: 0,
    discoveries: 0,
    auditLogs: 0,
    integrationTemplates: 0,
    relayTargets: 0,
    tokens: 0,
    payments: 0,
  };

  try {
    // Restore synced data
    if (options.restoreSyncedData !== false && Array.isArray(snapshot.stores.syncedData)) {
      if (!dryRun) {
        // STUB: In production, iterate and upsert each synced data entry
        console.log(`[backup] Would restore ${snapshot.stores.syncedData.length} synced data entries`);
      }
      restored.syncedData = snapshot.stores.syncedData.length;
    } else if (Array.isArray(snapshot.stores.syncedData)) {
      skipped.push(`syncedData (${snapshot.stores.syncedData.length} entries)`);
    }

    // Restore discoveries
    if (Array.isArray(snapshot.stores.discoveries)) {
      if (!dryRun) {
        console.log(`[backup] Would restore ${snapshot.stores.discoveries.length} discoveries`);
      }
      restored.discoveries = snapshot.stores.discoveries.length;
    }

    // Restore audit logs
    if (options.restoreAuditLogs !== false && Array.isArray(snapshot.stores.auditLogs)) {
      if (!dryRun) {
        console.log(`[backup] Would restore ${snapshot.stores.auditLogs.length} audit log entries`);
      }
      restored.auditLogs = snapshot.stores.auditLogs.length;
    } else if (Array.isArray(snapshot.stores.auditLogs)) {
      skipped.push(`auditLogs (${snapshot.stores.auditLogs.length} entries)`);
    }

    // Restore integration templates
    if (options.restoreIntegrations !== false && Array.isArray(snapshot.stores.integrationTemplates)) {
      if (!dryRun) {
        console.log(`[backup] Would restore ${snapshot.stores.integrationTemplates.length} integration templates`);
      }
      restored.integrationTemplates = snapshot.stores.integrationTemplates.length;
    } else if (Array.isArray(snapshot.stores.integrationTemplates) && snapshot.stores.integrationTemplates.length > 0) {
      skipped.push(`integrationTemplates (${snapshot.stores.integrationTemplates.length} entries)`);
    }

    // Restore relay targets
    if (options.restoreIntegrations !== false && Array.isArray(snapshot.stores.relayTargets)) {
      if (!dryRun) {
        console.log(`[backup] Would restore ${snapshot.stores.relayTargets.length} relay targets`);
      }
      restored.relayTargets = snapshot.stores.relayTargets.length;
    } else if (Array.isArray(snapshot.stores.relayTargets) && snapshot.stores.relayTargets.length > 0) {
      skipped.push(`relayTargets (${snapshot.stores.relayTargets.length} entries)`);
    }

    // Restore tokens
    if (options.restoreTokens && Array.isArray(snapshot.stores.tokens)) {
      if (!dryRun) {
        console.log(`[backup] Would restore ${snapshot.stores.tokens.length} tokens`);
      }
      restored.tokens = snapshot.stores.tokens.length;
    } else if (Array.isArray(snapshot.stores.tokens) && snapshot.stores.tokens.length > 0) {
      skipped.push(`tokens (${snapshot.stores.tokens.length} entries — restoreTokens not enabled)`);
    }

    // Restore payments
    if (options.restorePayments !== false && Array.isArray(snapshot.stores.payments)) {
      if (!dryRun) {
        console.log(`[backup] Would restore ${snapshot.stores.payments.length} payments`);
      }
      restored.payments = snapshot.stores.payments.length;
    } else if (Array.isArray(snapshot.stores.payments) && snapshot.stores.payments.length > 0) {
      skipped.push(`payments (${snapshot.stores.payments.length} entries)`);
    }

    console.log(
      `[backup] Restore ${dryRun ? "(dry-run) " : ""}completed: ` +
        `restored=${restored.syncedData + restored.discoveries + restored.auditLogs + restored.integrationTemplates + restored.relayTargets + restored.payments}, ` +
        `skipped=${skipped.length}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during restore";
    errors.push(message);
  }

  return {
    success: errors.length === 0,
    restored,
    skipped,
    errors,
  };
}

/**
 * Get a summary of current store sizes and record counts.
 *
 * @returns A {@link StoreSummary} with counts per store and estimated total size.
 */
export async function getStoreSummary(): Promise<StoreSummary> {
  try {
    const [tokens, syncLogs, discoveries, syncedDataMap] = await Promise.all([
      db.oAuthToken.findUnique({ where: { id: "fanvue_primary" } }),
      db.syncLog.findMany({ take: 500 }),
      db.discovery.findMany({ take: 500 }),
      db.syncedData.getAll(),
    ]);

    const tokenCount = tokens ? 1 : 0;
    const syncedDataList = Object.values(syncedDataMap);

    // Try to get audit logs count
    let auditLogs = 0;
    try {
      const { getAuditLogs } = await import("@/lib/audit-log");
      auditLogs = getAuditLogs({ limit: 1000 }).length;
    } catch {
      // Audit log not available
    }

    // Try to get integration store counts
    let integrationTemplates = 0;
    let relayTargets = 0;
    try {
      const { listTemplates, listRelayTargets } = await import("@/lib/integrations-store");
      integrationTemplates = listTemplates().length;
      relayTargets = listRelayTargets().length;
    } catch {
      // Integration store not available
    }

    // Try to get payments count
    let payments = 0;
    try {
      const { listPayments } = await import("@/lib/payments-store");
      payments = listPayments({ limit: 500 }).length;
    } catch {
      // Payments store not available
    }

    const allData = {
      tokens: tokenList(tokens),
      syncLogs: syncLogs.map((l) => ({ ...l })),
      discoveries: discoveries.map((d) => ({ ...d })),
      syncedData: syncedDataList,
    };

    return {
      totalSizeBytes: estimateByteSize(allData),
      tokens: tokenCount,
      syncLogs: syncLogs.length,
      discoveries: discoveries.length,
      syncedData: syncedDataList.length,
      auditLogs,
      integrationTemplates,
      relayTargets,
      payments,
      monitoring: 0,
    };
  } catch (err) {
    console.error("[backup] getStoreSummary failed:", err);
    return {
      totalSizeBytes: 0,
      tokens: 0,
      syncLogs: 0,
      discoveries: 0,
      syncedData: 0,
      auditLogs: 0,
      integrationTemplates: 0,
      relayTargets: 0,
      payments: 0,
      monitoring: 0,
    };
  }
}

/** Helper to wrap a single token or null into an array */
function tokenList(token: unknown): Array<Record<string, unknown>> {
  if (!token || typeof token !== "object") return [];
  return [token as Record<string, unknown>];
}
