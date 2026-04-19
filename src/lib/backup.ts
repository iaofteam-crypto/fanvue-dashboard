/**
 * DEV-3: Database Backup Strategy
 *
 * Since this project uses an in-memory store with optional Vercel KV persistence,
 * this module provides utilities for:
 * - Exporting all in-memory data as JSON (for backup / migration)
 * - Importing data from JSON (for restore)
 * - Reporting the current persistence status (KV vs memory-only)
 *
 * IMPORTANT:
 * ──────────
 * - In-memory data is LOST on every Vercel cold start (serverless).
 * - Vercel KV data survives cold starts but has a 24h TTL on most keys.
 * - For production-grade persistence, consider:
 *   1. Upgrading TTL on critical keys (tokens should be short-lived anyway)
 *   2. Adding a scheduled cron that exports data daily
 *   3. Storing exports in an external service (S3, Cloudflare R2)
 *   4. Using Vercel Postgres for structured, persistent storage
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

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Export all in-memory store data as a JSON-serializable object.
 *
 * Useful for:
 * - Manual backup before deployments
 * - Migration to a persistent database
 * - Debugging data state
 *
 * @returns A BackupData object with all store contents
 *
 * @example
 * ```ts
 * const backup = await exportAllData();
 * console.log(JSON.stringify(backup, null, 2));
 * // Save to external storage:
 * // await fetch('https://storage.example.com/backup', { method: 'POST', body: JSON.stringify(backup) });
 * ```
 */
export async function exportAllData(): Promise<BackupData> {
  // We access the internal store maps by reading from the db API.
  // Since db uses internal Maps, we export via findMany/getAll methods.
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
 * STUB: Currently logs the restore intent but does not mutate the store.
 * In production, implement safe restore logic:
 * 1. Validate the backup data schema
 * 2. Clear existing store data (with confirmation)
 * 3. Re-populate from the backup
 * 4. Persist to KV if configured
 *
 * @param json - The backup JSON string or parsed BackupData object
 * @returns Summary of what was restored
 *
 * @example
 * ```ts
 * const backupJson = fs.readFileSync('backup-2024-01-01.json', 'utf-8');
 * const result = await importData(backupJson);
 * ```
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

  // Validate basic structure
  if (!data.stores || !data.meta || !data.exportedAt) {
    return {
      success: false,
      message: "Invalid backup format: missing required fields (stores, meta, exportedAt)",
    };
  }

  // STUB: Log restore intent but don't actually restore
  console.log(
    `[backup] Restore requested (STUB — no data mutated): ` +
      `${data.meta.tokenCount} tokens, ` +
      `${data.meta.syncLogCount} sync logs, ` +
      `${data.meta.discoveryCount} discoveries, ` +
      `${data.meta.syncedDataCount} synced data entries ` +
      `(from ${data.exportedAt}, env: ${data.environment || "unknown"})`,
  );

  // In production, implement actual restore:
  //
  // // Restore tokens
  // for (const token of data.stores.tokens) {
  //   await db.oAuthToken.upsert({
  //     where: { id: (token as any).id },
  //     update: token,
  //     create: token as any,
  //   });
  // }
  //
  // // Restore sync logs
  // for (const log of data.stores.syncLogs) {
  //   await db.syncLog.create(log as any);
  // }
  //
  // // etc.

  return {
    success: true,
    message: "Restore logged (STUB mode — no data was actually mutated). Implement real restore for production use.",
    restoredCounts: data.meta,
  };
}

/**
 * Get the current backup / persistence status.
 *
 * Reports which stores have data, whether Vercel KV is available,
 * and provides recommendations for data persistence.
 *
 * @returns A BackupStatus object with current state information
 *
 * @example
 * ```ts
 * const status = await getBackupStatus();
 * console.log(`KV configured: ${status.kvConfigured}`);
 * console.log(`In-memory records: ${status.inMemoryRecordCount}`);
 * console.log(`Recommendation: ${status.recommendation}`);
 * ```
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  const kvConfigured = !!process.env.KV_REST_API_URL;

  // Count in-memory records via db API
  const [tokens, syncLogs, discoveries, syncedDataMap] = await Promise.all([
    db.oAuthToken.findUnique({ where: { id: "fanvue_primary" } }),
    db.syncLog.findMany({ take: 500 }),
    db.discovery.findMany({ take: 500 }),
    db.syncedData.getAll(),
  ]);

  const tokenCount = tokens ? 1 : 0;
  const syncedDataList = Object.values(syncedDataMap);

  // Find last sync timestamp
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

  // Generate recommendation
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
