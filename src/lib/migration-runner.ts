/**
 * @module migration-runner
 * @description Data migration framework for Fanvue Dashboard.
 *
 * Provides a versioned migration system for evolving store schemas.
 * Each migration has a version number, description, up() and optional down() function.
 * Migrations run sequentially and are tracked to prevent re-execution.
 *
 * Usage:
 *   import { runMigrations, getMigrationStatus } from "@/lib/migration-runner";
 *   await runMigrations(); // Runs pending migrations
 *   const status = getMigrationStatus(); // Returns all migration status
 */

// ─── Types ─────────────────────────────────────────────────────────────────

/** A single migration step */
export interface Migration {
  /** Unique version number (incrementing integer) */
  version: number;
  /** Human-readable description */
  description: string;
  /** When this migration was added (ISO date) */
  createdAt: string;
  /** Apply the migration (mutate stores) */
  up: () => Promise<MigrationResult>;
  /** Optional: revert the migration */
  down?: () => Promise<MigrationResult>;
}

/** Result of running a single migration */
export interface MigrationResult {
  success: boolean;
  message: string;
  changes?: number;
  durationMs: number;
  error?: string;
}

/** Status of all migrations */
export interface MigrationStatus {
  currentVersion: number;
  pending: Array<{ version: number; description: string }>;
  completed: Array<{ version: number; description: string; ranAt: string }>;
  lastRunAt: string | null;
}

// ─── Migration Registry ────────────────────────────────────────────────────

/** Internal tracking of completed migrations (in-memory, survives hot reload) */
const completedMigrations = new Map<number, { version: number; description: string; ranAt: string }>();

/** All registered migrations */
const migrations: Migration[] = [];

/**
 * Register a new migration. Call this during module initialization.
 *
 * @example
 * ```ts
 * registerMigration({
 *   version: 1,
 *   description: "Add category field to discoveries",
 *   createdAt: "2026-04-20",
 *   up: async () => {
 *     const db = (await import("@/lib/db")).db;
 *     const discoveries = await db.discovery.findMany();
 *     let changes = 0;
 *     for (const d of discoveries) {
 *       if (!d.category) {
 *         await db.discovery.upsert({
 *           where: { id: d.id },
 *           update: { category: "general" },
 *           create: { id: d.id, refId: d.refId, title: d.title, category: "general" },
 *         });
 *         changes++;
 *       }
 *     }
 *     return { success: true, message: `Updated ${changes} discoveries`, changes, durationMs: 0 };
 *   },
 * });
 * ```
 */
export function registerMigration(migration: Migration): void {
  // Prevent duplicate versions
  const existing = migrations.find((m) => m.version === migration.version);
  if (existing) {
    console.warn(`[migration] Duplicate migration version ${migration.version}: "${existing.description}" vs "${migration.description}"`);
    return;
  }
  migrations.push(migration);
  migrations.sort((a, b) => a.version - b.version);
}

/**
 * Run all pending migrations in version order.
 * Skips already-completed migrations.
 *
 * @returns Array of migration results
 */
export async function runMigrations(): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const migration of migrations) {
    if (completedMigrations.has(migration.version)) {
      continue; // Already ran
    }

    const start = Date.now();
    try {
      const result = await migration.up();
      const durationMs = Date.now() - start;

      if (result.success) {
        completedMigrations.set(migration.version, {
          version: migration.version,
          description: migration.description,
          ranAt: new Date().toISOString(),
        });
        console.info(
          `[migration] v${migration.version} "${migration.description}" completed in ${durationMs}ms — ${result.message}`
        );
      } else {
        console.error(
          `[migration] v${migration.version} "${migration.description}" failed: ${result.error || result.message}`
        );
      }

      results.push({ ...result, durationMs });
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[migration] v${migration.version} "${migration.description}" error: ${message}`);
      results.push({
        success: false,
        message: `Migration failed: ${message}`,
        durationMs,
        error: message,
      });
      // Stop on first failure to prevent cascading issues
      break;
    }
  }

  return results;
}

/**
 * Get the current migration status.
 */
export function getMigrationStatus(): MigrationStatus {
  const completed = Array.from(completedMigrations.values()).sort((a, b) => a.version - b.version);
  const pending = migrations
    .filter((m) => !completedMigrations.has(m.version))
    .map((m) => ({ version: m.version, description: m.description }));

  const currentVersion = completed.length > 0 ? Math.max(...completed.map((c) => c.version)) : 0;
  const lastRunAt = completed.length > 0 ? completed[completed.length - 1].ranAt : null;

  return {
    currentVersion,
    pending,
    completed,
    lastRunAt,
  };
}

/**
 * Reset migration tracking (for testing).
 * Does NOT revert migrations — just marks them as not-run.
 */
export function resetMigrationTracking(): void {
  completedMigrations.clear();
}

// ─── Built-in Migrations ──────────────────────────────────────────────────

// Migration v1: Normalize discovery categories (ensure all have a category)
registerMigration({
  version: 1,
  description: "Normalize discovery categories — set 'general' for empty categories",
  createdAt: "2026-04-20",
  up: async () => {
    const db = (await import("@/lib/db")).db;
    const discoveries = await db.discovery.findMany();
    let changes = 0;

    for (const d of discoveries) {
      if (!d.category || d.category.trim().length === 0) {
        await db.discovery.upsert({
          where: { id: d.id },
          update: { category: "general" },
          create: {
            id: d.id,
            refId: d.refId,
            title: d.title,
            category: "general",
          },
        });
        changes++;
      }
    }

    return {
      success: true,
      message: changes > 0 ? `Normalized ${changes} discovery categories` : "No discoveries needed normalization",
      changes,
      durationMs: 0,
    };
  },
});

// Migration v2: Ensure synced data keys are consistent (lowercase, no spaces)
registerMigration({
  version: 2,
  description: "Normalize synced data keys to lowercase with underscores",
  createdAt: "2026-04-20",
  up: async () => {
    const db = (await import("@/lib/db")).db;
    const allData = await db.syncedData.getAll();
    let changes = 0;

    for (const [key, record] of Object.entries(allData)) {
      const normalizedKey = key
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");

      if (normalizedKey !== key) {
        // Re-save with normalized key
        await db.syncedData.set(normalizedKey, record.data);
        changes++;
      }
    }

    return {
      success: true,
      message: changes > 0 ? `Normalized ${changes} synced data keys` : "All keys already normalized",
      changes,
      durationMs: 0,
    };
  },
});
