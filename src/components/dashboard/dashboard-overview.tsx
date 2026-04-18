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
import { Button } from "@/components/ui/button";

interface DashboardStats {
  subscribers: number;
  earnings: number;
  messages: number;
  posts: number;
  subscriberChange: number;
  earningsChange: number;
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

  const fetchStats = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      // Try to get synced data first
      const syncRes = await fetch("/api/sync-data");
      const syncData: SyncDataResponse = await syncRes.json();

      const earnings = syncData.data?.earnings?.data || syncData.data?.earnings_summary?.data;
      const subscribers = syncData.data?.subscribers?.data;
      const chats = syncData.data?.chats?.data;
      const posts = syncData.data?.posts?.data;

      const hasData = !!(earnings || subscribers || chats || posts);

      if (hasData) {
        setHasSyncedData(true);
        setLastSync(syncData.syncedAt ? new Date(syncData.syncedAt).toLocaleTimeString() : new Date().toLocaleTimeString());

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

        setActivities(buildActivityFromSync(syncData));
      } else {
        // No synced data — show zero state with guidance
        setStats({ subscribers: 0, earnings: 0, messages: 0, posts: 0, subscriberChange: 0, earningsChange: 0 });
        setLastSync("No data");
        setActivities([
          { icon: AlertCircle, text: "No synced data yet. Go to Connection and click Sync Now.", time: "Action needed", color: "text-amber-400" },
        ]);
      }
    } catch {
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
        setStats(null);
        setLastSync("Error");
      }
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

  const statCards = [
    {
      title: "Subscribers",
      value: stats?.subscribers.toLocaleString() || "—",
      change: stats?.subscriberChange,
      icon: Users,
      color: "text-emerald-400",
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
      value: stats?.messages.toLocaleString() || "—",
      icon: MessageSquare,
      color: "text-sky-400",
    },
    {
      title: "Posts",
      value: stats?.posts.toLocaleString() || "—",
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
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="bg-card/50 border-border/50">
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
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity — derived from synced data */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No activity data. Sync your Fanvue account to see recent activity.
              </p>
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
    </div>
  );
}
