import { useQuery } from "@tanstack/react-query";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SyncDataResponse {
  keys: string[];
  data: Record<string, { status: string; data: unknown; syncedAt: string }>;
  syncedAt: string;
}

interface SubscriberInsights {
  total: number;
  active?: number;
  expired?: number;
  growthRate?: number;
  newThisMonth?: number;
  churnedThisMonth?: number;
  avgSubscriptionLength?: number;
  tiers?: Record<string, number>;
  topTier?: string;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const queryKeys = {
  syncData: ["sync-data"] as const,
  earnings: ["earnings"] as const,
  earningsSummary: ["earnings-summary"] as const,
  subscribers: ["subscribers"] as const,
  chats: ["chats"] as const,
  posts: ["posts"] as const,
  smartLists: ["lists", "smart"] as const,
  customLists: ["lists", "custom"] as const,
  smartListMembers: (id: string) => ["lists", "smart", id] as const,
  customListMembers: (uuid: string) => ["lists", "custom", uuid] as const,
  chatTemplates: ["chat-templates"] as const,
  chatMessages: (chatId: string) => ["chats", chatId, "messages"] as const,
  chatMedia: (chatId: string) => ["chats", chatId, "media"] as const,
  massMessages: ["mass-messages"] as const,
  trackingLinks: ["tracking-links"] as const,
  trackingLinkUsers: (id: string) => ["tracking-links", id, "users"] as const,
  vaultFolders: ["vault", "folders"] as const,
  vaultMedia: (folderId: string) => ["vault", "folders", folderId, "media"] as const,
  topSpenders: ["insights", "top-spenders"] as const,
  fanInsights: (fanId: string) => ["insights", "fan", fanId] as const,
  bulkFanInsights: ["insights", "fans", "bulk"] as const,
  webhookEvents: ["webhook-events"] as const,
  spending: ["spending"] as const,
} as const;

// ─── Fetcher ────────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Shared Hooks ───────────────────────────────────────────────────────────

/**
 * Fetches cached sync data from /api/sync-data.
 * Shared by DashboardOverview, AnalyticsSection, AdvancedAnalyticsSection, DiscoveriesSection.
 * staleTime 2 min (sync data changes infrequently).
 */
export function useSyncData(enabled = true) {
  return useQuery<SyncDataResponse>({
    queryKey: queryKeys.syncData,
    queryFn: () => fetchJSON<SyncDataResponse>("/api/sync-data"),
    staleTime: 2 * 60 * 1000, // 2 min — sync data is a snapshot
    enabled,
  });
}

/**
 * Fetches subscriber insights from /api/fanvue/insights/subscribers.
 * Shared by DashboardOverview (also fetched in fallback path).
 */
export function useSubscribers(enabled = true) {
  return useQuery<SubscriberInsights | null>({
    queryKey: queryKeys.subscribers,
    queryFn: async () => {
      const data = await fetchJSON<unknown>("/api/fanvue/insights/subscribers");
      const parsed = Array.isArray(data) ? (data[0] as Record<string, unknown>) : (data as Record<string, unknown>);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        total: Number(parsed.total || parsed.count || parsed.subscribers || 0),
        active: Number(parsed.active || 0),
        expired: Number(parsed.expired || 0),
        growthRate: Number(parsed.growthRate || parsed.growth || 0),
        newThisMonth: Number(parsed.newThisMonth || parsed.newThisPeriod || 0),
        churnedThisMonth: Number(parsed.churnedThisMonth || parsed.churned || 0),
        avgSubscriptionLength: Number(parsed.avgSubscriptionLength || 0),
        tiers: parsed.tiers ? (parsed.tiers as Record<string, number>) : undefined,
        topTier: parsed.topTier ? String(parsed.topTier) : undefined,
      };
    },
    staleTime: 60 * 1000, // 1 min
    enabled,
  });
}

/**
 * Fetches earnings data from /api/fanvue/insights/earnings.
 * Shared by AnalyticsSection, AdvancedAnalyticsSection.
 */
export function useEarnings(enabled = true) {
  return useQuery<unknown>({
    queryKey: queryKeys.earnings,
    queryFn: () => fetchJSON<unknown>("/api/fanvue/insights/earnings"),
    staleTime: 60 * 1000,
    enabled,
  });
}

/**
 * Fetches earnings summary from /api/fanvue/insights/earnings-summary.
 * Shared by DashboardOverview, AnalyticsSection, AdvancedAnalyticsSection.
 */
export function useEarningsSummary(enabled = true) {
  return useQuery<unknown>({
    queryKey: queryKeys.earningsSummary,
    queryFn: () => fetchJSON<unknown>("/api/fanvue/insights/earnings-summary"),
    staleTime: 60 * 1000,
    enabled,
  });
}

/**
 * Fetches spending/refunds from /api/fanvue/insights/spending.
 * Used by AnalyticsSection.
 */
export function useSpending(enabled = true) {
  return useQuery<unknown>({
    queryKey: queryKeys.spending,
    queryFn: () => fetchJSON<unknown>("/api/fanvue/insights/spending"),
    staleTime: 2 * 60 * 1000,
    enabled,
  });
}

/**
 * Fetches chats list from /api/fanvue/chats.
 * Shared by DashboardOverview, MessagesSection.
 */
export function useChats(enabled = true) {
  return useQuery<unknown>({
    queryKey: queryKeys.chats,
    queryFn: () => fetchJSON<unknown>("/api/fanvue/chats"),
    staleTime: 30 * 1000, // 30s — chats change frequently
    enabled,
  });
}

/**
 * Fetches posts list from /api/fanvue/posts.
 * Shared by DashboardOverview, ContentSection, AdvancedAnalyticsSection.
 */
export function usePosts(enabled = true) {
  return useQuery<unknown>({
    queryKey: queryKeys.posts,
    queryFn: () => fetchJSON<unknown>("/api/fanvue/posts"),
    staleTime: 30 * 1000,
    enabled,
  });
}

/**
 * Fetches smart lists from /api/fanvue/chats/lists/smart.
 * Shared by MassMessagingSection, ABTestingSection, SmartListsSection.
 */
export function useSmartLists(enabled = true) {
  return useQuery<unknown[]>({
    queryKey: queryKeys.smartLists,
    queryFn: () => fetchJSON<unknown[]>("/api/fanvue/chats/lists/smart"),
    staleTime: 60 * 1000,
    enabled,
  });
}

/**
 * Fetches custom lists from /api/fanvue/chats/lists/custom.
 * Shared by MassMessagingSection, ABTestingSection, CustomListsSection.
 */
export function useCustomLists(enabled = true) {
  return useQuery<unknown[]>({
    queryKey: queryKeys.customLists,
    queryFn: () => fetchJSON<unknown[]>("/api/fanvue/chats/lists/custom"),
    staleTime: 60 * 1000,
    enabled,
  });
}
