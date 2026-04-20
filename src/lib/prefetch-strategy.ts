/**
 * PERF-6 — Strategic Prefetching
 *
 * Centralised prefetch strategy that hooks into the section navigation system.
 * When the user navigates to a section, this module prefetches data for the
 * current section (high priority) and the adjacent sections in the sidebar
 * nav order (low priority / short staleTime).
 *
 * Sections that require an active Fanvue connection are skipped entirely when
 * the user is disconnected.
 */

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/hooks/use-fanvue-data";

// ─── Section type ──────────────────────────────────────────────────────────

export type Section =
  | "dashboard"
  | "analytics"
  | "messages"
  | "content"
  | "discoveries"
  | "tasks"
  | "aeliana"
  | "repo"
  | "connection"
  | "insights"
  | "mass-messaging"
  | "smart-lists"
  | "custom-lists"
  | "vault"
  | "tracking"
  | "bulk-insights"
  | "ab-testing"
  | "scheduled"
  | "templates"
  | "advanced-analytics";

// ─── Configuration types ───────────────────────────────────────────────────

/** A single query that belongs to a section's prefetch plan. */
export interface PrefetchEntry {
  /** React Query key (matches the queryKeys used in use-fanvue-data hooks). */
  queryKey: readonly string[];
  /** Fetcher – will only be called when the query is not already fresh. */
  queryFn: () => Promise<unknown>;
  /** Default staleTime in ms when the section is *current* (high priority). */
  staleTime: number;
}

/**
 * Describes what to prefetch for a given section and whether an active
 * connection is required.
 */
export interface SectionPrefetchConfig {
  /** Queries used by this section. */
  entries: PrefetchEntry[];
  /**
   * When `true`, every entry in this config is skipped while disconnected.
   * Set to `false` for sections that work offline (tasks, aeliana, repo).
   */
  requiresConnection: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/**
 * Navigation order – mirrors the sidebar NAV_ITEMS array in page.tsx and
 * command-palette.tsx.  Adjacent sections are determined by index adjacency
 * in this array.
 */
export const NAV_ORDER: readonly Section[] = [
  "dashboard",
  "analytics",
  "messages",
  "content",
  "insights",
  "mass-messaging",
  "smart-lists",
  "custom-lists",
  "vault",
  "tracking",
  "bulk-insights",
  "ab-testing",
  "advanced-analytics",
  "scheduled",
  "templates",
  "discoveries",
  "tasks",
  "aeliana",
  "repo",
  "connection",
] as const;

/** StaleTime used for *low-priority* (adjacent) section prefetches. */
const ADJACENT_STALE_TIME = 5_000; // 5 seconds – short window, avoids waste

/**
 * Central prefetch strategy mapping.
 *
 * Each Section maps to the queries its components consume (derived from
 * the use-fanvue-data hooks).  `requiresConnection` gates the whole block
 * when the Fanvue API is unavailable.
 */
export const PREFETCH_STRATEGY: Record<Section, SectionPrefetchConfig> = {
  dashboard: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.syncData,
        queryFn: () => fetch("/api/sync-data").then((r) => r.json()),
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: queryKeys.subscribers,
        queryFn: () =>
          fetch("/api/fanvue/insights/subscribers").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.earningsSummary,
        queryFn: () =>
          fetch("/api/fanvue/insights/earnings-summary").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.chats,
        queryFn: () => fetch("/api/fanvue/chats").then((r) => r.json()),
        staleTime: 30 * 1000,
      },
    ],
  },

  analytics: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.syncData,
        queryFn: () => fetch("/api/sync-data").then((r) => r.json()),
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: queryKeys.earnings,
        queryFn: () =>
          fetch("/api/fanvue/insights/earnings").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.earningsSummary,
        queryFn: () =>
          fetch("/api/fanvue/insights/earnings-summary").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.spending,
        queryFn: () =>
          fetch("/api/fanvue/insights/spending").then((r) => r.json()),
        staleTime: 2 * 60 * 1000,
      },
    ],
  },

  messages: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.chats,
        queryFn: () => fetch("/api/fanvue/chats").then((r) => r.json()),
        staleTime: 30 * 1000,
      },
      {
        queryKey: queryKeys.chatTemplates,
        queryFn: () =>
          fetch("/api/fanvue/chats/templates").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
    ],
  },

  content: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.posts,
        queryFn: () => fetch("/api/fanvue/posts").then((r) => r.json()),
        staleTime: 30 * 1000,
      },
    ],
  },

  insights: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.topSpenders,
        queryFn: () =>
          fetch("/api/fanvue/insights/top-spenders").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.bulkFanInsights,
        queryFn: () =>
          fetch("/api/fanvue/insights/fans/bulk").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
    ],
  },

  "mass-messaging": {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.smartLists,
        queryFn: () =>
          fetch("/api/fanvue/chats/lists/smart").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.customLists,
        queryFn: () =>
          fetch("/api/fanvue/chats/lists/custom").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.massMessages,
        queryFn: () =>
          fetch("/api/fanvue/mass-messages").then((r) => r.json()),
        staleTime: 30 * 1000,
      },
      {
        queryKey: queryKeys.chatTemplates,
        queryFn: () =>
          fetch("/api/fanvue/chats/templates").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
    ],
  },

  "smart-lists": {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.smartLists,
        queryFn: () =>
          fetch("/api/fanvue/chats/lists/smart").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
    ],
  },

  "custom-lists": {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.customLists,
        queryFn: () =>
          fetch("/api/fanvue/chats/lists/custom").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
    ],
  },

  vault: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.vaultFolders,
        queryFn: () =>
          fetch("/api/fanvue/vault/folders").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
    ],
  },

  tracking: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.trackingLinks,
        queryFn: () =>
          fetch("/api/fanvue/tracking-links").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
    ],
  },

  "bulk-insights": {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.bulkFanInsights,
        queryFn: () =>
          fetch("/api/fanvue/insights/fans/bulk").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
    ],
  },

  "ab-testing": {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.smartLists,
        queryFn: () =>
          fetch("/api/fanvue/chats/lists/smart").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.customLists,
        queryFn: () =>
          fetch("/api/fanvue/chats/lists/custom").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.massMessages,
        queryFn: () =>
          fetch("/api/fanvue/mass-messages").then((r) => r.json()),
        staleTime: 30 * 1000,
      },
    ],
  },

  "advanced-analytics": {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.syncData,
        queryFn: () => fetch("/api/sync-data").then((r) => r.json()),
        staleTime: 2 * 60 * 1000,
      },
      {
        queryKey: queryKeys.earnings,
        queryFn: () =>
          fetch("/api/fanvue/insights/earnings").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.earningsSummary,
        queryFn: () =>
          fetch("/api/fanvue/insights/earnings-summary").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
      {
        queryKey: queryKeys.posts,
        queryFn: () => fetch("/api/fanvue/posts").then((r) => r.json()),
        staleTime: 30 * 1000,
      },
    ],
  },

  scheduled: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.posts,
        queryFn: () => fetch("/api/fanvue/posts").then((r) => r.json()),
        staleTime: 30 * 1000,
      },
    ],
  },

  templates: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.chatTemplates,
        queryFn: () =>
          fetch("/api/fanvue/chats/templates").then((r) => r.json()),
        staleTime: 60 * 1000,
      },
    ],
  },

  discoveries: {
    requiresConnection: true,
    entries: [
      {
        queryKey: queryKeys.syncData,
        queryFn: () => fetch("/api/sync-data").then((r) => r.json()),
        staleTime: 2 * 60 * 1000,
      },
    ],
  },

  // ── Offline-capable sections (no queries to prefetch) ──────────────────

  tasks: {
    requiresConnection: false,
    entries: [],
  },

  aeliana: {
    requiresConnection: false,
    entries: [],
  },

  repo: {
    requiresConnection: false,
    entries: [],
  },

  connection: {
    requiresConnection: false,
    entries: [],
  },
};

// ─── Prefetch helpers ──────────────────────────────────────────────────────

/**
 * Fire a single prefetch entry on the given QueryClient.
 *
 * `prefetchQuery` is a no-op when the data is already fresh, so duplicate
 * entries across sections are harmless — the cache deduplicates automatically.
 */
function firePrefetch(
  queryClient: QueryClient,
  entry: PrefetchEntry,
  staleTime: number,
): void {
  queryClient.prefetchQuery({
    queryKey: entry.queryKey,
    queryFn: entry.queryFn,
    staleTime,
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Prefetch data for the given section plus its immediate neighbours in the
 * sidebar navigation.
 *
 * - **Current section** – entries are prefetched at their configured
 *   `staleTime` (high priority).
 * - **Adjacent sections** (prev / next in `NAV_ORDER`) – entries are
 *   prefetched with a very short `ADJACENT_STALE_TIME` (low priority).
 * - Sections whose config has `requiresConnection: true` are entirely
 *   skipped when `connected` is `false`.
 *
 * This function is safe to call on every navigation change; React Query
 * de-dupes in-flight requests and ignores already-fresh cache entries.
 *
 * @param section - The section identifier (must exist in {@link NAV_ORDER}).
 * @param queryClient - The TanStack React Query `QueryClient` instance.
 * @param connected - Whether the user has an active Fanvue connection.
 */
export function prefetchSection(
  section: string,
  queryClient: QueryClient,
  connected: boolean,
): void {
  const idx = NAV_ORDER.indexOf(section as Section);
  if (idx === -1) return;

  // Determine which sections to prefetch: current + prev + next
  const adjacentIndices: number[] = [];
  if (idx > 0) adjacentIndices.push(idx - 1);
  if (idx < NAV_ORDER.length - 1) adjacentIndices.push(idx + 1);

  // High-priority: current section
  const currentConfig = PREFETCH_STRATEGY[section as Section];
  if (currentConfig) {
    const shouldSkip =
      currentConfig.requiresConnection && !connected;
    if (!shouldSkip) {
      for (const entry of currentConfig.entries) {
        firePrefetch(queryClient, entry, entry.staleTime);
      }
    }
  }

  // Low-priority: adjacent sections
  for (const adjIdx of adjacentIndices) {
    const adjSection = NAV_ORDER[adjIdx];
    const config = PREFETCH_STRATEGY[adjSection];
    if (!config || config.entries.length === 0) continue;

    const shouldSkip = config.requiresConnection && !connected;
    if (shouldSkip) continue;

    for (const entry of config.entries) {
      firePrefetch(queryClient, entry, ADJACENT_STALE_TIME);
    }
  }
}
