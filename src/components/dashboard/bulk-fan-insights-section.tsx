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
  Download,
  ChevronDown,
  ChevronUp,
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
import { BulkInsightsTableSkeleton } from "@/components/dashboard/section-skeletons";
import { SectionBreadcrumbs } from "@/components/dashboard/section-breadcrumbs";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface BulkFanInsight {
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
  daysSinceLastActivity?: number;
}

interface BulkResponse {
  fans?: BulkFanInsight[];
  data?: BulkFanInsight[];
  total?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

type SortField =
  | "totalSpent"
  | "ltv"
  | "engagementScore"
  | "messageCount"
  | "tipTotal"
  | "lastActivity"
  | "ppvTotal";
type SortDir = "asc" | "desc";
type FilterTier = "all" | "active" | "expired" | "vip" | "standard";

// ─── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_FANS: BulkFanInsight[] = [
  { id: "bf1", displayName: "Alex Johnson", totalSpent: 12450, subscriptionActive: true, subscriptionTier: "VIP", subscriptionStart: "2025-06-15T00:00:00Z", messageCount: 342, messageFrequency: "4.2/day", tipCount: 28, tipTotal: 3200, ppvPurchases: 12, ppvTotal: 4150, lastActivity: "2026-04-18T10:30:00Z", firstActivity: "2025-06-16T12:00:00Z", ltv: 15800, engagementScore: 94, topContent: "Exclusive photos", daysSinceLastActivity: 0 },
  { id: "bf2", displayName: "Sarah Mitchell", totalSpent: 8920, subscriptionActive: true, subscriptionTier: "Standard", subscriptionStart: "2025-08-01T00:00:00Z", messageCount: 215, messageFrequency: "2.8/day", tipCount: 19, tipTotal: 1850, ppvPurchases: 8, ppvTotal: 2670, lastActivity: "2026-04-18T08:15:00Z", firstActivity: "2025-08-02T09:00:00Z", ltv: 11200, engagementScore: 87, topContent: "Video content", daysSinceLastActivity: 0 },
  { id: "bf3", displayName: "Mike Davidson", totalSpent: 6780, subscriptionActive: true, subscriptionTier: "Standard", subscriptionStart: "2025-09-20T00:00:00Z", messageCount: 178, messageFrequency: "2.1/day", tipCount: 14, tipTotal: 980, ppvPurchases: 6, ppvTotal: 3200, lastActivity: "2026-04-17T22:00:00Z", firstActivity: "2025-09-21T14:00:00Z", ltv: 8400, engagementScore: 76, topContent: "Behind the scenes", daysSinceLastActivity: 1 },
  { id: "bf4", displayName: "Jordan Kim", totalSpent: 5340, subscriptionActive: false, subscriptionTier: "Standard", subscriptionStart: "2025-07-10T00:00:00Z", messageCount: 89, messageFrequency: "1.0/day", tipCount: 7, tipTotal: 650, ppvPurchases: 4, ppvTotal: 1890, lastActivity: "2026-04-16T14:30:00Z", firstActivity: "2025-07-11T18:00:00Z", ltv: 6500, engagementScore: 52, topContent: "Photos", daysSinceLastActivity: 2 },
  { id: "bf5", displayName: "Chris Palmer", totalSpent: 4210, subscriptionActive: true, subscriptionTier: "VIP", subscriptionStart: "2025-05-01T00:00:00Z", messageCount: 156, messageFrequency: "1.9/day", tipCount: 11, tipTotal: 890, ppvPurchases: 5, ppvTotal: 1320, lastActivity: "2026-04-18T12:00:00Z", firstActivity: "2025-05-02T10:00:00Z", ltv: 5800, engagementScore: 81, topContent: "Exclusive videos", daysSinceLastActivity: 0 },
  { id: "bf6", displayName: "Emma Wilson", totalSpent: 3890, subscriptionActive: true, subscriptionTier: "Standard", subscriptionStart: "2025-10-15T00:00:00Z", messageCount: 203, messageFrequency: "2.5/day", tipCount: 9, tipTotal: 720, ppvPurchases: 3, ppvTotal: 1170, lastActivity: "2026-04-17T19:45:00Z", firstActivity: "2025-10-16T08:00:00Z", ltv: 5200, engagementScore: 89, topContent: "Chat sessions", daysSinceLastActivity: 1 },
  { id: "bf7", displayName: "Tyler Brooks", totalSpent: 3100, subscriptionActive: false, subscriptionTier: "Standard", subscriptionStart: "2025-11-01T00:00:00Z", messageCount: 67, messageFrequency: "0.8/day", tipCount: 4, tipTotal: 340, ppvPurchases: 2, ppvTotal: 1560, lastActivity: "2026-04-15T09:00:00Z", firstActivity: "2025-11-02T16:00:00Z", ltv: 4200, engagementScore: 34, topContent: "Photos", daysSinceLastActivity: 3 },
  { id: "bf8", displayName: "Jessica Lee", totalSpent: 2870, subscriptionActive: true, subscriptionTier: "Standard", subscriptionStart: "2026-01-10T00:00:00Z", messageCount: 134, messageFrequency: "1.6/day", tipCount: 8, tipTotal: 560, ppvPurchases: 3, ppvTotal: 810, lastActivity: "2026-04-18T06:30:00Z", firstActivity: "2026-01-11T12:00:00Z", ltv: 3900, engagementScore: 72, topContent: "Behind the scenes", daysSinceLastActivity: 0 },
  { id: "bf9", displayName: "Daniel Ortiz", totalSpent: 2450, subscriptionActive: false, subscriptionTier: "Standard", subscriptionStart: "2025-12-01T00:00:00Z", messageCount: 45, messageFrequency: "0.5/day", tipCount: 3, tipTotal: 280, ppvPurchases: 1, ppvTotal: 1170, lastActivity: "2026-04-14T16:00:00Z", firstActivity: "2025-12-02T10:00:00Z", ltv: 3200, engagementScore: 22, topContent: "Video content", daysSinceLastActivity: 4 },
  { id: "bf10", displayName: "Ashley Chen", totalSpent: 2100, subscriptionActive: true, subscriptionTier: "Standard", subscriptionStart: "2026-02-01T00:00:00Z", messageCount: 98, messageFrequency: "1.2/day", tipCount: 6, tipTotal: 420, ppvPurchases: 2, ppvTotal: 680, lastActivity: "2026-04-18T01:20:00Z", firstActivity: "2026-02-02T08:00:00Z", ltv: 2900, engagementScore: 68, topContent: "Chat sessions", daysSinceLastActivity: 0 },
  { id: "bf11", displayName: "Ryan Foster", totalSpent: 1890, subscriptionActive: true, subscriptionTier: "Standard", subscriptionStart: "2026-01-20T00:00:00Z", messageCount: 76, messageFrequency: "0.9/day", tipCount: 5, tipTotal: 380, ppvPurchases: 1, ppvTotal: 810, lastActivity: "2026-04-17T15:00:00Z", firstActivity: "2026-01-21T11:00:00Z", ltv: 2600, engagementScore: 61, topContent: "Photos", daysSinceLastActivity: 1 },
  { id: "bf12", displayName: "Mia Torres", totalSpent: 1650, subscriptionActive: false, subscriptionTier: "Standard", subscriptionStart: "2025-10-01T00:00:00Z", messageCount: 34, messageFrequency: "0.4/day", tipCount: 2, tipTotal: 200, ppvPurchases: 1, ppvTotal: 850, lastActivity: "2026-04-12T20:00:00Z", firstActivity: "2025-10-02T14:00:00Z", ltv: 2200, engagementScore: 18, topContent: "Video content", daysSinceLastActivity: 6 },
  { id: "bf13", displayName: "Nathan Cruz", totalSpent: 1420, subscriptionActive: true, subscriptionTier: "VIP", subscriptionStart: "2026-03-01T00:00:00Z", messageCount: 112, messageFrequency: "1.3/day", tipCount: 7, tipTotal: 520, ppvPurchases: 0, ppvTotal: 0, lastActivity: "2026-04-18T09:45:00Z", firstActivity: "2026-03-02T16:00:00Z", ltv: 1900, engagementScore: 78, topContent: "Exclusive photos", daysSinceLastActivity: 0 },
  { id: "bf14", displayName: "Sophia Gray", totalSpent: 1180, subscriptionActive: true, subscriptionTier: "Standard", subscriptionStart: "2026-02-15T00:00:00Z", messageCount: 58, messageFrequency: "0.7/day", tipCount: 3, tipTotal: 260, ppvPurchases: 1, ppvTotal: 420, lastActivity: "2026-04-17T11:30:00Z", firstActivity: "2026-02-16T09:00:00Z", ltv: 1600, engagementScore: 55, topContent: "Behind the scenes", daysSinceLastActivity: 1 },
  { id: "bf15", displayName: "Liam Patel", totalSpent: 920, subscriptionActive: false, subscriptionTier: "Standard", subscriptionStart: "2025-12-15T00:00:00Z", messageCount: 22, messageFrequency: "0.3/day", tipCount: 1, tipTotal: 100, ppvPurchases: 0, ppvTotal: 520, lastActivity: "2026-04-10T18:00:00Z", firstActivity: "2025-12-16T10:00:00Z", ltv: 1200, engagementScore: 12, topContent: "Photos", daysSinceLastActivity: 8 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-sky-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/15";
  if (score >= 60) return "bg-sky-500/15";
  if (score >= 40) return "bg-amber-500/15";
  return "bg-red-500/15";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  if (score >= 40) return "Low";
  return "At Risk";
}

function getRiskColor(days: number): string {
  if (days === 0) return "text-emerald-400 bg-emerald-500/10";
  if (days <= 2) return "text-sky-400 bg-sky-500/10";
  if (days <= 5) return "text-amber-400 bg-amber-500/10";
  return "text-red-400 bg-red-500/10";
}

function getRiskLabel(days: number): string {
  if (days === 0) return "Active";
  if (days <= 2) return "Recent";
  if (days <= 5) return "Cooling";
  return "Cold";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function BulkFanInsightsSection({ connected }: { connected: boolean }) {
  const [fans, setFans] = useState<BulkFanInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalSpent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterTier, setFilterTier] = useState<FilterTier>("all");
  const [hasRealData, setHasRealData] = useState(false);
  const [selectedFanId, setSelectedFanId] = useState<string | null>(null);
  const [expandedFanId, setExpandedFanId] = useState<string | null>(null);

  // ─── Fetch Bulk Fan Insights ─────────────────────────────────────────────

  const fetchBulkInsights = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/fanvue/insights/fans/bulk");
      if (res.ok) {
        const data: BulkResponse = await res.json();
        const list: BulkFanInsight[] = Array.isArray(data)
          ? data as BulkFanInsight[]
          : data?.fans || data?.data || [];
        if (list.length > 0) {
          setHasRealData(true);
          setFans(list);
          setLoading(false);
          return;
        }
      }
    } catch {
      toast.error("Failed to load bulk fan insights");
    }
    // Fallback to demo
    setFans(DEMO_FANS);
    setLoading(false);
  }, [connected]);

  useEffect(() => {
    fetchBulkInsights();
  }, [fetchBulkInsights]);

  // ─── Filtering & Sorting ─────────────────────────────────────────────────

  const filteredFans = useMemo(() => {
    let result = [...fans];

    // Filter by tier
    if (filterTier === "active") {
      result = result.filter((f) => f.subscriptionActive);
    } else if (filterTier === "expired") {
      result = result.filter((f) => !f.subscriptionActive);
    } else if (filterTier === "vip") {
      result = result.filter((f) => f.subscriptionTier?.toLowerCase() === "vip");
    } else if (filterTier === "standard") {
      result = result.filter((f) => f.subscriptionTier?.toLowerCase() !== "vip" || !f.subscriptionTier);
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          (f.displayName || "").toLowerCase().includes(q) ||
          (f.username || "").toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortField) {
        case "totalSpent":
          aVal = a.totalSpent ?? 0;
          bVal = b.totalSpent ?? 0;
          break;
        case "ltv":
          aVal = a.ltv ?? 0;
          bVal = b.ltv ?? 0;
          break;
        case "engagementScore":
          aVal = a.engagementScore ?? 0;
          bVal = b.engagementScore ?? 0;
          break;
        case "messageCount":
          aVal = a.messageCount ?? 0;
          bVal = b.messageCount ?? 0;
          break;
        case "tipTotal":
          aVal = a.tipTotal ?? 0;
          bVal = b.tipTotal ?? 0;
          break;
        case "ppvTotal":
          aVal = a.ppvTotal ?? 0;
          bVal = b.ppvTotal ?? 0;
          break;
        case "lastActivity":
        default:
          aVal = new Date(a.lastActivity || 0).getTime();
          bVal = new Date(b.lastActivity || 0).getTime();
          break;
      }

      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [fans, searchQuery, sortField, sortDir, filterTier]);

  // ─── Aggregated Stats ────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = fans.length;
    const activeSubs = fans.filter((f) => f.subscriptionActive).length;
    const totalRevenue = fans.reduce((sum, f) => sum + (f.totalSpent ?? 0), 0);
    const totalTips = fans.reduce((sum, f) => sum + (f.tipTotal ?? 0), 0);
    const totalPpv = fans.reduce((sum, f) => sum + (f.ppvTotal ?? 0), 0);
    const totalMsgs = fans.reduce((sum, f) => sum + (f.messageCount ?? 0), 0);
    const avgEngagement = total > 0
      ? Math.round(fans.reduce((sum, f) => sum + (f.engagementScore ?? 0), 0) / total)
      : 0;
    const avgLtv = total > 0
      ? Math.round(fans.reduce((sum, f) => sum + (f.ltv ?? 0), 0) / total)
      : 0;
    const vipCount = fans.filter((f) => f.subscriptionTier?.toLowerCase() === "vip").length;
    const atRiskCount = fans.filter((f) => (f.daysSinceLastActivity ?? 99) > 5).length;
    return { total, activeSubs, totalRevenue, totalTips, totalPpv, totalMsgs, avgEngagement, avgLtv, vipCount, atRiskCount };
  }, [fans]);

  // ─── Export CSV ──────────────────────────────────────────────────────────

  const handleExportCSV = useCallback(() => {
    const headers = ["Name", "Total Spent", "LTV", "Engagement", "Messages", "Tips", "PPV", "Sub Status", "Tier", "Last Active", "Risk"];
    const rows = filteredFans.map((f) => [
      f.displayName || f.username || f.id,
      (f.totalSpent ?? 0).toString(),
      (f.ltv ?? 0).toString(),
      (f.engagementScore ?? 0).toString(),
      (f.messageCount ?? 0).toString(),
      (f.tipTotal ?? 0).toString(),
      (f.ppvTotal ?? 0).toString(),
      f.subscriptionActive ? "Active" : "Expired",
      f.subscriptionTier || "Standard",
      f.lastActivity ? relativeTime(f.lastActivity) : "Unknown",
      getRiskLabel(f.daysSinceLastActivity ?? 99),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-fan-insights-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  }, [filteredFans]);

  // ─── Handle Sort Toggle ──────────────────────────────────────────────────

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField]
  );

  // ─── Disconnected State ──────────────────────────────────────────────────

  if (loading && fans.length === 0) {
    return <BulkInsightsTableSkeleton />;
  }

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Bulk Fan Insights unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to view fan analytics</p>
      </div>
    );
  }

  // ─── Fan Detail Panel (expanded inline) ──────────────────────────────────

  const selectedFan = selectedFanId ? fans.find((f) => f.id === selectedFanId) : null;

  if (selectedFan) {
    const fi = selectedFan;
    const subAmount = (fi.totalSpent ?? 0) - (fi.tipTotal ?? 0) - (fi.ppvTotal ?? 0);
    const breadcrumbItems = [{ label: "Bulk Insights" }, { label: fi.displayName || fi.username || "Fan" }];
    return (
      <div className="space-y-6">
        <SectionBreadcrumbs items={breadcrumbItems} />
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedFanId(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{fi.displayName || fi.username || "Fan"}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {fi.subscriptionActive ? (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <Crown className="w-3 h-3 mr-1" /> Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">Expired</Badge>
                )}
                {fi.subscriptionTier && (
                  <Badge variant="outline" className={`text-xs ${fi.subscriptionTier.toLowerCase() === "vip" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-sky-500/10 text-sky-400 border-sky-500/20"}`}>
                    {fi.subscriptionTier}
                  </Badge>
                )}
                <Badge variant="outline" className={`text-xs ${getRiskColor(fi.daysSinceLastActivity ?? 99)}`}>
                  {getRiskLabel(fi.daysSinceLastActivity ?? 99)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                Total Spent
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(fi.totalSpent ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                LTV: {formatCurrency(fi.ltv ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                Engagement
              </div>
              <p className={`text-2xl font-bold mt-1 ${getScoreColor(fi.engagementScore ?? 0)}`}>
                {fi.engagementScore ?? 0}/100
              </p>
              <p className="text-xs text-muted-foreground mt-1">{getScoreLabel(fi.engagementScore ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageCircle className="w-4 h-4" />
                Messages
              </div>
              <p className="text-2xl font-bold mt-1">{fi.messageCount ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{fi.messageFrequency ?? "N/A"}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Last Active
              </div>
              <p className="text-lg font-bold mt-1">{relativeTime(fi.lastActivity)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(fi.daysSinceLastActivity ?? 0) === 0 ? "Online today" : `${fi.daysSinceLastActivity}d inactive`}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Spending Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Subscriptions", value: subAmount, color: "bg-emerald-500" },
                { label: `Tips (${fi.tipCount ?? 0})`, value: fi.tipTotal ?? 0, color: "bg-sky-500" },
                { label: `PPV (${fi.ppvPurchases ?? 0})`, value: fi.ppvTotal ?? 0, color: "bg-purple-500 dark:bg-purple-400" },
              ].map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-500`}
                      style={{ width: `${(fi.totalSpent ?? 1) > 0 ? Math.round((item.value / (fi.totalSpent ?? 1)) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                Preferences & Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Top Content</span>
                <span className="font-medium">{fi.topContent || "No data"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">First Active</span>
                <span>{fi.firstActivity ? new Date(fi.firstActivity).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subscribed Since</span>
                <span>{fi.subscriptionStart ? new Date(fi.subscriptionStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Engagement Score</span>
                <span className={`font-medium ${getScoreColor(fi.engagementScore ?? 0)}`}>{fi.engagementScore ?? 0}/100</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Main Table View ─────────────────────────────────────────────────────

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bulk Fan Insights</h1>
          <p className="text-muted-foreground text-sm">
            Aggregate analytics across all your fans — spending, engagement, and retention
            {!hasRealData && (
              <span className="block text-xs mt-1 text-amber-400">
                Showing demo data. Sync your account for real insights.
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs">
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              Total Fans
            </div>
            <p className="text-xl font-bold mt-0.5">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{stats.activeSubs} active</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DollarSign className="w-3.5 h-3.5" />
              Total Revenue
            </div>
            <p className="text-xl font-bold mt-0.5">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalTips)} tips</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" />
              Avg Engagement
            </div>
            <p className={`text-xl font-bold mt-0.5 ${getScoreColor(stats.avgEngagement)}`}>{stats.avgEngagement}</p>
            <p className="text-xs text-muted-foreground">out of 100</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Crown className="w-3.5 h-3.5" />
              VIP Fans
            </div>
            <p className="text-xl font-bold mt-0.5">{stats.vipCount}</p>
            <p className="text-xs text-muted-foreground">{stats.activeSubs} subs total</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Target className="w-3.5 h-3.5" />
              At Risk
            </div>
            <p className="text-xl font-bold mt-0.5 text-red-400">{stats.atRiskCount}</p>
            <p className="text-xs text-muted-foreground">5d+ inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search fans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "expired", label: "Expired" },
            { key: "vip", label: "VIP" },
          ] as const).map((f) => (
            <Button
              key={f.key}
              variant={filterTier === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterTier(f.key)}
              className="text-xs h-8"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>
              Fan Analytics Table
              <span className="text-muted-foreground font-normal ml-2">
                {filteredFans.length} fans
              </span>
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              Click a row for details
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(100vh-22rem)]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mr-2" />
                <span className="text-muted-foreground text-sm">Loading fan insights...</span>
              </div>
            ) : filteredFans.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="font-medium text-sm">No fans found</p>
                <p className="text-xs mt-1">
                  {searchQuery ? "Try a different search term" : "Sync your account to load fan data"}
                </p>
              </div>
            ) : (
              <div>
                {/* Table Header */}
                <div className="grid grid-cols-14 gap-1 px-3 py-2 text-xs text-muted-foreground border-b border-border/50 font-medium sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                  <button onClick={() => handleSort("totalSpent")} className="col-span-1 text-right hover:text-foreground transition-colors flex items-center justify-end gap-0.5">
                    # <SortIcon field="totalSpent" />
                  </button>
                  <div className="col-span-2">Fan</div>
                  <button onClick={() => handleSort("totalSpent")} className="col-span-2 text-right hover:text-foreground transition-colors flex items-center justify-end gap-0.5">
                    Spent <SortIcon field="totalSpent" />
                  </button>
                  <button onClick={() => handleSort("ltv")} className="col-span-1 text-right hover:text-foreground transition-colors flex items-center justify-end gap-0.5">
                    LTV <SortIcon field="ltv" />
                  </button>
                  <button onClick={() => handleSort("engagementScore")} className="col-span-1 text-center hover:text-foreground transition-colors flex items-center justify-center gap-0.5">
                    Eng <SortIcon field="engagementScore" />
                  </button>
                  <button onClick={() => handleSort("messageCount")} className="col-span-1 text-right hover:text-foreground transition-colors flex items-center justify-end gap-0.5">
                    Msgs <SortIcon field="messageCount" />
                  </button>
                  <button onClick={() => handleSort("tipTotal")} className="col-span-1 text-right hover:text-foreground transition-colors flex items-center justify-end gap-0.5">
                    Tips <SortIcon field="tipTotal" />
                  </button>
                  <button onClick={() => handleSort("ppvTotal")} className="col-span-1 text-right hover:text-foreground transition-colors flex items-center justify-end gap-0.5">
                    PPV <SortIcon field="ppvTotal" />
                  </button>
                  <div className="col-span-1 text-center">Tier</div>
                  <div className="col-span-1 text-center">Risk</div>
                  <button onClick={() => handleSort("lastActivity")} className="col-span-2 text-right hover:text-foreground transition-colors flex items-center justify-end gap-0.5">
                    Last Active <SortIcon field="lastActivity" />
                  </button>
                </div>

                {/* Table Rows */}
                <motion.div variants={staggerContainer(0.02)} initial="initial" animate="animate">
                {filteredFans.map((fan, index) => {
                  const isExpanded = expandedFanId === fan.id;
                  const daysInactive = fan.daysSinceLastActivity ?? 99;

                  return (
                    <div key={fan.id}>
                      <button
                        onClick={() => setSelectedFanId(fan.id)}
                        className="w-full grid grid-cols-14 gap-1 px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/20 text-left items-center"
                      >
                        <div className="col-span-1 text-right text-xs text-muted-foreground">
                          {index + 1}
                        </div>
                        <div className="col-span-2 flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {fan.displayName || fan.username || `Fan ${fan.id}`}
                            </span>
                            {fan.subscriptionActive && (
                              <Crown className="w-3 h-3 text-emerald-400" />
                            )}
                          </div>
                        </div>
                        <div className="col-span-2 text-right text-sm font-medium">
                          {formatCurrency(fan.totalSpent ?? 0)}
                        </div>
                        <div className="col-span-1 text-right text-sm text-muted-foreground">
                          {formatCurrency(fan.ltv ?? 0)}
                        </div>
                        <div className="col-span-1 text-center">
                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${getScoreBg(fan.engagementScore ?? 0)} ${getScoreColor(fan.engagementScore ?? 0)}`}>
                            {fan.engagementScore ?? 0}
                          </div>
                        </div>
                        <div className="col-span-1 text-right text-sm text-muted-foreground">
                          {fan.messageCount ?? 0}
                        </div>
                        <div className="col-span-1 text-right text-sm text-muted-foreground">
                          {formatCurrency(fan.tipTotal ?? 0)}
                        </div>
                        <div className="col-span-1 text-right text-sm text-muted-foreground">
                          {formatCurrency(fan.ppvTotal ?? 0)}
                        </div>
                        <div className="col-span-1 text-center">
                          {fan.subscriptionTier?.toLowerCase() === "vip" ? (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                              VIP
                            </Badge>
                          ) : fan.subscriptionActive ? (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 bg-sky-500/10 text-sky-400 border-sky-500/20">
                              STD
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                        <div className="col-span-1 text-center">
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getRiskColor(daysInactive)}`}>
                            {getRiskLabel(daysInactive)}
                          </Badge>
                        </div>
                        <div className="col-span-2 text-right text-xs text-muted-foreground">
                          {relativeTime(fan.lastActivity)}
                        </div>
                      </button>

                      {/* Expanded Inline Preview */}
                      {isExpanded && (
                        <div className="px-3 py-3 bg-muted/30 border-b border-border/20 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-[10px] sm:text-xs">
                          <div>
                            <span className="text-muted-foreground">Frequency</span>
                            <p className="font-medium mt-0.5">{fan.messageFrequency ?? "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Top Content</span>
                            <p className="font-medium mt-0.5">{fan.topContent || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">PPV Purchases</span>
                            <p className="font-medium mt-0.5">{fan.ppvPurchases ?? 0}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tips</span>
                            <p className="font-medium mt-0.5">{fan.tipCount ?? 0} ({formatCurrency(fan.tipTotal ?? 0)})</p>
                          </div>
                        </div>
                      )}
                    </div>
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
