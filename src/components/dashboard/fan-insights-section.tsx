"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  ArrowLeft,
  Loader2,
  Search,
  TrendingUp,
  DollarSign,
  MessageCircle,
  Crown,
  Calendar,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations";
import { FanInsightsSkeleton } from "@/components/dashboard/section-skeletons";
import { SectionBreadcrumbs } from "@/components/dashboard/section-breadcrumbs";
import { EmptyState } from "@/components/dashboard/empty-state";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface TopSpender {
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  totalSpent?: number;
  subscriptionActive?: boolean;
  messageCount?: number;
  lastActivity?: string;
  ltv?: number;
}

interface FanInsight {
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  totalSpent?: number;
  subscriptionActive?: boolean;
  subscriptionTier?: string;
  subscriptionStart?: string;
  messageCount?: number;
  messageFrequency?: string;
  tipCount?: number;
  tipTotal?: number;
  ppvPurchases?: number;
  ppvTotal?: number;
  lastActivity?: string;
  firstActivity?: string;
  ltv?: number;
  engagementScore?: number;
  topContent?: string;
}

// ─── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_SPENDERS: TopSpender[] = [
  { id: "f1", displayName: "Alex Johnson", totalSpent: 12450, subscriptionActive: true, messageCount: 342, lastActivity: "2026-04-18T10:30:00Z", ltv: 15800 },
  { id: "f2", displayName: "Sarah Mitchell", totalSpent: 8920, subscriptionActive: true, messageCount: 215, lastActivity: "2026-04-18T08:15:00Z", ltv: 11200 },
  { id: "f3", displayName: "Mike Davidson", totalSpent: 6780, subscriptionActive: true, messageCount: 178, lastActivity: "2026-04-17T22:00:00Z", ltv: 8400 },
  { id: "f4", displayName: "Jordan Kim", totalSpent: 5340, subscriptionActive: false, messageCount: 89, lastActivity: "2026-04-16T14:30:00Z", ltv: 6500 },
  { id: "f5", displayName: "Chris Palmer", totalSpent: 4210, subscriptionActive: true, messageCount: 156, lastActivity: "2026-04-18T12:00:00Z", ltv: 5800 },
  { id: "f6", displayName: "Emma Wilson", totalSpent: 3890, subscriptionActive: true, messageCount: 203, lastActivity: "2026-04-17T19:45:00Z", ltv: 5200 },
  { id: "f7", displayName: "Tyler Brooks", totalSpent: 3100, subscriptionActive: false, messageCount: 67, lastActivity: "2026-04-15T09:00:00Z", ltv: 4200 },
  { id: "f8", displayName: "Jessica Lee", totalSpent: 2870, subscriptionActive: true, messageCount: 134, lastActivity: "2026-04-18T06:30:00Z", ltv: 3900 },
  { id: "f9", displayName: "Daniel Ortiz", totalSpent: 2450, subscriptionActive: false, messageCount: 45, lastActivity: "2026-04-14T16:00:00Z", ltv: 3200 },
  { id: "f10", displayName: "Ashley Chen", totalSpent: 2100, subscriptionActive: true, messageCount: 98, lastActivity: "2026-04-18T01:20:00Z", ltv: 2900 },
];

const DEMO_FAN_INSIGHT: FanInsight = {
  id: "f1",
  displayName: "Alex Johnson",
  subscriptionActive: true,
  subscriptionTier: "VIP",
  subscriptionStart: "2025-06-15T00:00:00Z",
  totalSpent: 12450,
  messageCount: 342,
  messageFrequency: "4.2 per day",
  tipCount: 28,
  tipTotal: 3200,
  ppvPurchases: 12,
  ppvTotal: 4150,
  lastActivity: "2026-04-18T10:30:00Z",
  firstActivity: "2025-06-16T12:00:00Z",
  ltv: 15800,
  engagementScore: 94,
  topContent: "Exclusive photos",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return "Unknown";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(iso);
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-sky-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 60) return "bg-sky-500/10 border-sky-500/20";
  if (score >= 40) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function getRankBadge(index: number): { label: string; color: string } {
  if (index === 0) return { label: "1st", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
  if (index === 1) return { label: "2nd", color: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30" };
  if (index === 2) return { label: "3rd", color: "bg-orange-700/20 text-orange-400 border-orange-700/30" };
  return { label: `${index + 1}`, color: "bg-muted text-muted-foreground border-border/50" };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FanInsightsSection({ connected }: { connected: boolean }) {
  const [spenders, setSpenders] = useState<TopSpender[]>([]);
  const [selectedFanId, setSelectedFanId] = useState<string | null>(null);
  const [fanInsight, setFanInsight] = useState<FanInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"totalSpent" | "messageCount" | "lastActivity">("totalSpent");
  const [hasRealData, setHasRealData] = useState(false);

  // ─── Fetch Top Spenders ─────────────────────────────────────────────────

  const fetchTopSpenders = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/fanvue/insights/top-spenders");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : data?.data || data?.spenders || data?.fans || [];
        if (list.length > 0) {
          setHasRealData(true);
          setSpenders(list as TopSpender[]);
          return;
        }
      }
    } catch {
      toast.error("Failed to load fan insights");
    }
    // Fallback to demo data
    setSpenders(DEMO_SPENDERS);
    setLoading(false);
  }, [connected]);

  useEffect(() => {
    fetchTopSpenders();
  }, [fetchTopSpenders]);

  // ─── Fetch Individual Fan Insight ───────────────────────────────────────

  const fetchFanInsight = useCallback(async (fanId: string) => {
    setLoadingDetail(true);
    setSelectedFanId(fanId);
    try {
      const res = await fetch(`/api/fanvue/insights/fan-insights/${fanId}`);
      if (res.ok) {
        const data = await res.json();
        const insight = Array.isArray(data) ? data[0] : data?.data || data?.insight || data;
        if (insight && typeof insight === "object" && "id" in (insight as Record<string, unknown>)) {
          setFanInsight(insight as FanInsight);
          setLoadingDetail(false);
          return;
        }
      }
    } catch {
      toast.error("Failed to load fan details");
    }
    // Fallback to demo
    setFanInsight({ ...DEMO_FAN_INSIGHT, id: fanId });
    setLoadingDetail(false);
  }, []);

  // ─── Disconnected State ─────────────────────────────────────────────────

  if (loading && spenders.length === 0) {
    return <FanInsightsSkeleton />;
  }

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Fan Insights unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to view fan analytics</p>
      </div>
    );
  }

  // ─── Fan Detail View ────────────────────────────────────────────────────

  if (selectedFanId && fanInsight) {
    const fi = fanInsight;
    const breadcrumbItems = [{ label: "Fan Insights" }, { label: fi.displayName || fi.username || "Fan" }];
    const subscriptionDuration = fi.subscriptionStart
      ? Math.floor((Date.now() - new Date(fi.subscriptionStart).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const monthlyAvg = subscriptionDuration > 30 && fi.totalSpent
      ? Math.round(fi.totalSpent / (subscriptionDuration / 30))
      : 0;

    return (
      <div className="space-y-6">
        {/* Back button + header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedFanId(null); setFanInsight(null); }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{fi.displayName || fi.username || "Fan Profile"}</h1>
              <p className="text-sm text-muted-foreground">
                {fi.subscriptionActive ? (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20 mr-2">
                    <Crown className="w-3 h-3 mr-1" /> Active Subscriber
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                    Not Subscribed
                  </Badge>
                )}
                {fi.subscriptionTier && (
                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 ml-2">
                    {fi.subscriptionTier}
                  </Badge>
                )}
              </p>
            </div>
          </div>
        </div>

        {loadingDetail ? (
          <div className="animate-pulse space-y-6">
            {/* Summary stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card/50 border border-border/50 rounded-lg p-6 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
            {/* Detail rows */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-card/50 border border-border/50 rounded-lg p-6 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Summary Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4" />
                    Total Spent
                  </div>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(fi.totalSpent ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fi.tipCount && fi.tipCount > 0
                      ? `${fi.tipCount} tips (${formatCurrency(fi.tipTotal ?? 0)})`
                      : "No tips yet"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="w-4 h-4" />
                    Estimated LTV
                  </div>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(fi.ltv ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {monthlyAvg > 0 ? `~${formatCurrency(monthlyAvg)}/month avg` : "Insufficient data"}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="w-4 h-4" />
                    Messages
                  </div>
                  <p className="text-2xl font-bold mt-1">{fi.messageCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fi.messageFrequency ?? "N/A"}
                  </p>
                </CardContent>
              </Card>

              <Card className={`bg-card/50 border ${getScoreBgColor(fi.engagementScore ?? 0)}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    Engagement
                  </div>
                  <p className={`text-2xl font-bold mt-1 ${getScoreColor(fi.engagementScore ?? 0)}`}>
                    {fi.engagementScore ?? 0}/100
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fi.topContent || "No preference data"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Detail Rows */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Subscription Info */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Crown className="w-4 h-4 text-primary" />
                    Subscription Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className={fi.subscriptionActive ? "text-emerald-400 font-medium" : "text-muted-foreground"}>
                      {fi.subscriptionActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {fi.subscriptionTier && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tier</span>
                      <span className="font-medium">{fi.subscriptionTier}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subscribed Since</span>
                    <span>{formatDate(fi.subscriptionStart)}</span>
                  </div>
                  {subscriptionDuration > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Duration</span>
                      <span>{subscriptionDuration} days ({Math.round(subscriptionDuration / 30)} months)</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Spending Breakdown */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Spending Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Subscription bar */}
                  {(fi.ppvTotal ?? 0) + (fi.tipTotal ?? 0) > 0 ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subscriptions</span>
                        <span className="font-medium">
                          {formatCurrency((fi.totalSpent ?? 0) - (fi.tipTotal ?? 0) - (fi.ppvTotal ?? 0))}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{
                            width: `${Math.round(((fi.totalSpent ?? 1) - (fi.tipTotal ?? 0) - (fi.ppvTotal ?? 0)) / (fi.totalSpent ?? 1) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-sm mt-3">
                        <span className="text-muted-foreground">Tips ({fi.tipCount ?? 0})</span>
                        <span className="font-medium">{formatCurrency(fi.tipTotal ?? 0)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-500 transition-all duration-500"
                          style={{
                            width: `${Math.round((fi.tipTotal ?? 0) / (fi.totalSpent ?? 1) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="flex justify-between text-sm mt-3">
                        <span className="text-muted-foreground">PPV ({fi.ppvPurchases ?? 0})</span>
                        <span className="font-medium">{formatCurrency(fi.ppvTotal ?? 0)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all duration-500"
                          style={{
                            width: `${Math.round((fi.ppvTotal ?? 0) / (fi.totalSpent ?? 1) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Detailed breakdown requires synced data. Showing total: {formatCurrency(fi.totalSpent ?? 0)}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Activity Timeline */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-sky-400" />
                    Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Active</span>
                    <span>{relativeTime(fi.lastActivity)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">First Active</span>
                    <span>{formatDate(fi.firstActivity)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Messages</span>
                    <span>{fi.messageCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Frequency</span>
                    <span>{fi.messageFrequency ?? "N/A"}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Content Preferences */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Top Content</span>
                    <span className="font-medium">{fi.topContent || "No data"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">PPV Purchases</span>
                    <span>{fi.ppvPurchases ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tips Sent</span>
                    <span>{fi.tipCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Engagement Score</span>
                    <span className={`font-medium ${getScoreColor(fi.engagementScore ?? 0)}`}>
                      {fi.engagementScore ?? 0}/100
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── Top Spenders List View ─────────────────────────────────────────────

  const sortedSpenders = useMemo(() => [...spenders]
    .filter((s) => {
      const name = s.displayName || s.username || `Fan ${s.id}`;
      return !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "messageCount":
          return (b.messageCount ?? 0) - (a.messageCount ?? 0);
        case "lastActivity":
          return new Date(b.lastActivity || 0).getTime() - new Date(a.lastActivity || 0).getTime();
        default:
          return (b.totalSpent ?? 0) - (a.totalSpent ?? 0);
      }
    }), [spenders, searchQuery, sortBy]);

  const totalRevenue = spenders.reduce((sum, s) => sum + (s.totalSpent ?? 0), 0);
  const activeSubscribers = spenders.filter((s) => s.subscriptionActive).length;
  const avgLtv = spenders.length > 0
    ? Math.round(spenders.reduce((sum, s) => sum + (s.ltv ?? 0), 0) / spenders.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fan Insights</h1>
          <p className="text-muted-foreground text-sm">
            Understand your top fans — spending, engagement, and lifetime value
            {!hasRealData && (
              <span className="block text-xs mt-1 text-amber-400">
                Showing demo data. Sync your account for real insights.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              Total Fans
            </div>
            <p className="text-2xl font-bold mt-1">{spenders.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeSubscribers} active subscribers
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              From top {spenders.length} fans
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="w-4 h-4" />
              Avg LTV
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(avgLtv)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime value per fan
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Crown className="w-4 h-4" />
              Top Spender
            </div>
            <p className="text-2xl font-bold mt-1">
              {sortedSpenders.length > 0 ? formatCurrency(sortedSpenders[0]?.totalSpent ?? 0) : "$0"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {sortedSpenders[0]?.displayName || "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Sort Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search fans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={sortBy === "totalSpent" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("totalSpent")}
            className="text-xs flex-shrink-0"
          >
            <DollarSign className="w-3 h-3 mr-1" />
            Revenue
          </Button>
          <Button
            variant={sortBy === "messageCount" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("messageCount")}
            className="text-xs flex-shrink-0"
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            Messages
          </Button>
          <Button
            variant={sortBy === "lastActivity" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("lastActivity")}
            className="text-xs flex-shrink-0"
          >
            <Calendar className="w-3 h-3 mr-1" />
            Recent
          </Button>
        </div>
      </div>

      {/* Fans Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">
            Top Fans
            <span className="text-muted-foreground font-normal ml-2">
              {sortedSpenders.length} fans
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(100vh-20rem)]">
            {loading ? (
              <div className="space-y-1 p-4 animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b border-border/30">
                    <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            ) : sortedSpenders.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No fans found"
                description={searchQuery ? "Try a different search term" : "Sync your account to load fan data"}
              />
            ) : (
              <div>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border/50 font-medium">
                  <div className="col-span-1">#</div>
                  <div className="col-span-3">Fan</div>
                  <div className="col-span-2 text-right">Total Spent</div>
                  <div className="col-span-2 text-right">LTV</div>
                  <div className="col-span-1 text-center">Sub</div>
                  <div className="col-span-1 text-right">Msgs</div>
                  <div className="col-span-2 text-right">Last Active</div>
                </div>
                {/* Table Rows */}
                <motion.div variants={staggerContainer(0.03)} initial="initial" animate="animate">
                {sortedSpenders.map((fan, index) => {
                  const rank = getRankBadge(index);
                  return (
                    <motion.button
                      key={fan.id}
                      variants={staggerItem}
                      onClick={() => fetchFanInsight(fan.id)}
                      className="w-full grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 text-left items-center"
                    >
                      <div className="col-span-1">
                        <Badge variant="outline" className={`text-xs px-1.5 py-0.5 ${rank.color}`}>
                          {rank.label}
                        </Badge>
                      </div>
                      <div className="col-span-3 flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Users className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="text-sm font-medium truncate">
                          {fan.displayName || fan.username || `Fan ${fan.id}`}
                        </span>
                      </div>
                      <div className="col-span-2 text-right text-sm font-medium">
                        {formatCurrency(fan.totalSpent ?? 0)}
                      </div>
                      <div className="col-span-2 text-right text-sm text-muted-foreground">
                        {formatCurrency(fan.ltv ?? 0)}
                      </div>
                      <div className="col-span-1 text-center">
                        {fan.subscriptionActive ? (
                          <Crown className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                      <div className="col-span-1 text-right text-sm text-muted-foreground">
                        {fan.messageCount ?? 0}
                      </div>
                      <div className="col-span-2 text-right text-xs text-muted-foreground">
                        {relativeTime(fan.lastActivity)}
                      </div>
                    </motion.button>
                  );
                })}
                </motion.div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
