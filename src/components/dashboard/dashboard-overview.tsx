"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  DollarSign,
  MessageSquare,
  FileText,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/dashboard/section-skeletons";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations";
import { useSyncData, useSubscribers } from "@/hooks/use-fanvue-data";

interface DashboardStats {
  subscribers: number;
  earnings: number;
  messages: number;
  posts: number;
  subscriberChange: number;
  earningsChange: number;
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

interface RecentActivityItem {
  icon: typeof Users;
  text: string;
  time: string;
  color: string;
}

interface SyncDataResponse {
  keys: string[];
  data: Record<string, { status: string; data: unknown; syncedAt: string }>;
  syncedAt: string;
}

// Build recent activity from synced data
function buildActivityFromSync(syncData: SyncDataResponse): RecentActivityItem[] {
  const activities: RecentActivityItem[] = [];

  const posts = syncData.data?.posts?.data;
  if (Array.isArray(posts) && posts.length > 0) {
    const latest = posts[0] as Record<string, unknown>;
    activities.push({
      icon: FileText,
      text: `Latest post: ${(latest.title as string) || (latest.type as string) || "Untitled"}`,
      time: "Latest",
      color: "text-violet-400",
    });
    activities.push({
      icon: FileText,
      text: `${posts.length} total posts synced`,
      time: "Sync data",
      color: "text-amber-400",
    });
  }

  const chats = syncData.data?.chats?.data;
  if (Array.isArray(chats) && chats.length > 0) {
    activities.push({
      icon: MessageSquare,
      text: `${chats.length} conversations synced`,
      time: "Sync data",
      color: "text-sky-400",
    });
  }

  const subscribers = syncData.data?.subscribers?.data;
  const subCount = Array.isArray(subscribers)
    ? subscribers.length
    : typeof subscribers === "object"
      ? Number((subscribers as Record<string, unknown>).total || (subscribers as Record<string, unknown>).count || 0)
      : 0;
  if (subCount > 0) {
    activities.push({
      icon: Users,
      text: `${subCount.toLocaleString()} subscribers tracked`,
      time: "Sync data",
      color: "text-emerald-400",
    });
  }

  const earnings = syncData.data?.earnings?.data || syncData.data?.earnings_summary?.data;
  if (earnings) {
    const total = Array.isArray(earnings)
      ? earnings.reduce((sum: number, e: Record<string, unknown>) => sum + Number(e.total || e.amount || 0), 0)
      : Number((earnings as Record<string, unknown>).total || (earnings as Record<string, unknown>).totalEarnings || 0);
    if (total > 0) {
      activities.push({
        icon: DollarSign,
        text: `Earnings data synced: $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        time: "Sync data",
        color: "text-amber-400",
      });
    }
  }

  // Add sync timestamp
  if (syncData.syncedAt) {
    activities.push({
      icon: RefreshCw,
      text: `Last data sync: ${new Date(syncData.syncedAt).toLocaleString()}`,
      time: "System",
      color: "text-muted-foreground",
    });
  }

  return activities;
}

export function DashboardOverview({ connected }: { connected: boolean }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string>("Never");
  const [activities, setActivities] = useState<RecentActivityItem[]>([]);
  const [hasSyncedData, setHasSyncedData] = useState(false);

  // Shared React Query hooks — deduplicated across components
  const { data: syncData } = useSyncData(connected);
  const { data: subInsightsRaw } = useSubscribers(connected);

  // Derive subscriber insights from shared query
  const subInsights = subInsightsRaw ?? null;

  const fetchStats = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      // Use shared React Query cache for sync-data, but allow manual refresh
      let syncResponse: SyncDataResponse;
      if (syncData && syncData.keys && syncData.keys.length > 0) {
        syncResponse = syncData;
      } else {
        // If React Query hasn't fetched yet (cold start), fetch directly
        const syncRes = await fetch("/api/sync-data");
        syncResponse = await syncRes.json();
      }

      const earnings = syncResponse.data?.earnings?.data || syncResponse.data?.earnings_summary?.data;
      const subscribers = syncResponse.data?.subscribers?.data;
      const chats = syncResponse.data?.chats?.data;
      const posts = syncResponse.data?.posts?.data;

      const hasData = !!(earnings || subscribers || chats || posts);

      if (hasData) {
        setHasSyncedData(true);
        setLastSync(syncResponse.syncedAt ? new Date(syncResponse.syncedAt).toLocaleTimeString() : new Date().toLocaleTimeString());

        setStats({
          subscribers: Array.isArray(subscribers)
            ? subscribers.length
            : Number((subscribers as Record<string, unknown>)?.total || (subscribers as Record<string, unknown>)?.count || 0),
          earnings: Array.isArray(earnings)
            ? earnings.reduce((sum: number, e: Record<string, unknown>) => sum + Number(e.total || e.amount || 0), 0)
            : Number((earnings as Record<string, unknown>)?.total || (earnings as Record<string, unknown>)?.totalEarnings || 0),
          messages: Array.isArray(chats) ? chats.length : 0,
          posts: Array.isArray(posts) ? posts.length : 0,
          subscriberChange: 0, // Can't compute without historical data
          earningsChange: 0,
        });

        setActivities(buildActivityFromSync(syncResponse));
      } else {
        // No synced data — show zero state with guidance
        setStats({ subscribers: 0, earnings: 0, messages: 0, posts: 0, subscriberChange: 0, earningsChange: 0 });
        setLastSync("No data");
        setActivities([
          { icon: AlertCircle, text: "No synced data yet. Go to Connection and click Sync Now.", time: "Action needed", color: "text-amber-400" },
        ]);
      }
    } catch {
      toast.error("Failed to load sync data");
      // Fallback: try direct API calls
      try {
        const [earningsRes, subscribersRes, chatsRes, postsRes] = await Promise.allSettled([
          fetch("/api/fanvue/insights/earnings-summary"),
          fetch("/api/fanvue/insights/subscribers"),
          fetch("/api/fanvue/chats"),
          fetch("/api/fanvue/posts"),
        ]);

        const earnings = earningsRes.status === "fulfilled" && earningsRes.value.ok ? await earningsRes.value.json() : null;
        const subscribers = subscribersRes.status === "fulfilled" && subscribersRes.value.ok ? await subscribersRes.value.json() : null;
        const chats = chatsRes.status === "fulfilled" && chatsRes.value.ok ? await chatsRes.value.json() : null;
        const posts = postsRes.status === "fulfilled" && postsRes.value.ok ? await postsRes.value.json() : null;

        setStats({
          subscribers: subscribers?.total || subscribers?.count || 0,
          earnings: earnings?.total || earnings?.totalEarnings || 0,
          messages: chats?.total || chats?.data?.length || chats?.length || 0,
          posts: posts?.total || posts?.data?.length || posts?.length || 0,
          subscriberChange: subscribers?.growth || 0,
          earningsChange: earnings?.growth || 0,
        });
        setLastSync("Live API");
      } catch {
        toast.error("Failed to load dashboard stats");
        setStats(null);
        setLastSync("Error");
      }
    } finally {
      setLoading(false);
    }
  }, [connected, syncData]);

  // Subscriber insights now provided by useSubscribers() hook (shared React Query cache)
  // No separate fetchSubscriberInsights needed — eliminates duplicate /insights/subscribers call

  useEffect(() => {
    fetchStats();
    // fetchSubscriberInsights removed — useSubscribers() hook handles it via shared cache
  }, [fetchStats]);

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Activity className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Connect Your Fanvue Account</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Link your Fanvue account to view real-time analytics, manage messages, track earnings, and optimize your creator operations.
        </p>
        <Button
          size="lg"
          onClick={() => (window.location.href = "/api/fanvue/authorize")}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
        >
          <DollarSign className="w-5 h-5 mr-2" />
          Connect Fanvue
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Secure OAuth2 PKCE authentication — your credentials never leave our servers
        </p>
      </div>
    );
  }

  // Subscriber widget data — prefer dedicated insights, fallback to sync stats
  const subscriberCount = subInsights?.total ?? stats?.subscribers ?? 0;
  const subscriberChange = subInsights?.growthRate ?? stats?.subscriberChange ?? 0;

  const statCards = [
    {
      title: "Subscribers",
      value: subscriberCount.toLocaleString() || "—",
      change: subscriberChange,
      icon: Users,
      color: "text-emerald-400",
      detail: subInsights ? {
        active: subInsights.active,
        expired: subInsights.expired,
        newThisMonth: subInsights.newThisMonth,
        churnedThisMonth: subInsights.churnedThisMonth,
      } : undefined,
    },
    {
      title: "Earnings",
      value: stats?.earnings ? `$${stats.earnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
      change: stats?.earningsChange,
      icon: DollarSign,
      color: "text-emerald-400",
    },
    {
      title: "Messages",
      value: (stats?.messages ?? 0).toLocaleString() || "—",
      icon: MessageSquare,
      color: "text-sky-400",
    },
    {
      title: "Posts",
      value: (stats?.posts ?? 0).toLocaleString() || "—",
      icon: FileText,
      color: "text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview of your Fanvue creator operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            Last sync: {lastSync}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer(0.06)}
        initial="initial"
        animate="animate"
      >
        {statCards.map((card) => (
          <motion.div key={card.title} variants={staggerItem}>
            <Card className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              {card.change !== undefined && card.change !== 0 && (
                <div className="flex items-center text-xs mt-1">
                  {card.change > 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400 mr-1" />
                  )}
                  <span className={card.change > 0 ? "text-emerald-400" : "text-red-400"}>
                    {card.change > 0 ? "+" : ""}
                    {card.change}%
                  </span>
                  <span className="text-muted-foreground ml-1">vs last period</span>
                </div>
              )}
              {"detail" in card && card.detail && (
                <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-x-4 gap-y-1">
                  {(card.detail as { active?: number; expired?: number; newThisMonth?: number; churnedThisMonth?: number }).active !== undefined && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Active</span>
                      <span className="font-medium text-emerald-400">{(card.detail as { active: number }).active.toLocaleString()}</span>
                    </div>
                  )}
                  {(card.detail as { expired?: number }).expired !== undefined && (card.detail as { expired: number }).expired > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Expired</span>
                      <span className="font-medium text-orange-400">{(card.detail as { expired: number }).expired.toLocaleString()}</span>
                    </div>
                  )}
                  {(card.detail as { newThisMonth?: number }).newThisMonth !== undefined && (card.detail as { newThisMonth: number }).newThisMonth > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">New</span>
                      <span className="font-medium text-sky-400">+{(card.detail as { newThisMonth: number }).newThisMonth.toLocaleString()}</span>
                    </div>
                  )}
                  {(card.detail as { churnedThisMonth?: number }).churnedThisMonth !== undefined && (card.detail as { churnedThisMonth: number }).churnedThisMonth > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Churned</span>
                      <span className="font-medium text-red-400">-{(card.detail as { churnedThisMonth: number }).churnedThisMonth.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Subscriber Breakdown Widget */}
      {subInsights && subInsights.total > 0 && (
        <motion.div variants={fadeInUp} initial="initial" animate="animate">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Subscriber Insights
              </CardTitle>
              <Badge variant="outline" className="text-[10px] px-2 py-0">
                {subInsights.total.toLocaleString()} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Active subscribers */}
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Active Subscribers</div>
                <div className="text-xl font-bold text-emerald-400">
                  {subInsights.active ?? subInsights.total}
                </div>
                {subInsights.total > 0 && subInsights.active !== undefined && (
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-emerald-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, ((subInsights.active / subInsights.total) * 100)).toFixed(0)}%` }}
                    />
                  </div>
                )}
              </div>
              {/* New this month */}
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">New This Month</div>
                <div className="text-xl font-bold text-sky-400">
                  +{subInsights.newThisMonth ?? 0}
                </div>
                {subInsights.growthRate !== undefined && subInsights.growthRate !== 0 && (
                  <div className="flex items-center text-xs">
                    {subInsights.growthRate > 0 ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400 mr-1" />
                    )}
                    <span className={subInsights.growthRate > 0 ? "text-emerald-400" : "text-red-400"}>
                      {subInsights.growthRate > 0 ? "+" : ""}
                      {subInsights.growthRate}%
                    </span>
                    <span className="text-muted-foreground ml-1">growth</span>
                  </div>
                )}
              </div>
              {/* Expired */}
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Expired</div>
                <div className="text-xl font-bold text-orange-400">
                  {subInsights.expired ?? 0}
                </div>
                {subInsights.churnedThisMonth !== undefined && subInsights.churnedThisMonth > 0 && (
                  <div className="text-xs text-red-400">
                    -{subInsights.churnedThisMonth} churned this month
                  </div>
                )}
              </div>
              {/* Avg length */}
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Avg Subscription</div>
                <div className="text-xl font-bold">
                  {subInsights.avgSubscriptionLength ? `${subInsights.avgSubscriptionLength}d` : "---"}
                </div>
              </div>
            </div>
            {/* Tiers breakdown */}
            {subInsights.tiers && Object.keys(subInsights.tiers).length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-2">Subscription Tiers</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(subInsights.tiers).map(([tier, count]) => (
                    <Badge key={tier} variant="outline" className="text-xs px-2.5 py-1">
                      <span className="capitalize">{tier}</span>
                      <span className="ml-1 font-bold">{Number(count).toLocaleString()}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>
      )}

      {/* Recent Activity — derived from synced data */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate">
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activities.length === 0 ? (
              <EmptyState size="compact" icon={Activity} title="No activity yet" description="Sync your Fanvue account to see recent activity" />
            ) : (
              activities.map((activity, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <activity.icon className={`w-4 h-4 ${activity.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.text}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {activity.time}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
