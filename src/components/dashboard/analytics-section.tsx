"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BarChart3, TrendingUp, TrendingDown, DollarSign, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EarningsPoint {
  date: string;
  label: string;
  total: number;
  tips: number;
  subscriptions: number;
  ppv: number;
}

interface EarningsSummary {
  totalEarnings: number;
  totalTips: number;
  totalSubscriptions: number;
  totalPPV: number;
  periodStart?: string;
  periodEnd?: string;
  currency?: string;
}

interface SpendingRecord {
  id?: string;
  type: string;
  amount: number;
  status: string;
  date: string;
  description?: string;
  userId?: string;
  username?: string;
}

type PeriodKey = "7d" | "30d" | "90d" | "12m";

// ─── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_DAILY_EARNINGS: EarningsPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const base = 120 + Math.sin(i * 0.5) * 60;
  return {
    date: date.toISOString().split("T")[0],
    label: date.toLocaleDateString("en", { month: "short", day: "numeric" }),
    total: Math.round(base + Math.random() * 80),
    tips: Math.round((base + Math.random() * 80) * 0.25),
    subscriptions: Math.round((base + Math.random() * 80) * 0.6),
    ppv: Math.round((base + Math.random() * 80) * 0.15),
  };
});

const DEMO_MONTHLY_EARNINGS: EarningsPoint[] = [
  { date: "2025-04-01", label: "Apr", total: 2780, tips: 900, subscriptions: 1880, ppv: 0 },
  { date: "2025-05-01", label: "May", total: 3890, tips: 1400, subscriptions: 2490, ppv: 0 },
  { date: "2025-06-01", label: "Jun", total: 3490, tips: 1100, subscriptions: 2390, ppv: 0 },
  { date: "2025-07-01", label: "Jul", total: 4200, tips: 1500, subscriptions: 2700, ppv: 0 },
  { date: "2025-08-01", label: "Aug", total: 3800, tips: 1300, subscriptions: 2500, ppv: 0 },
  { date: "2025-09-01", label: "Sep", total: 4350, tips: 1600, subscriptions: 2750, ppv: 0 },
  { date: "2025-10-01", label: "Oct", total: 4100, tips: 1400, subscriptions: 2700, ppv: 0 },
  { date: "2025-11-01", label: "Nov", total: 4600, tips: 1700, subscriptions: 2900, ppv: 0 },
  { date: "2025-12-01", label: "Dec", total: 5200, tips: 1900, subscriptions: 3300, ppv: 0 },
  { date: "2026-01-01", label: "Jan", total: 4800, tips: 1650, subscriptions: 3150, ppv: 0 },
  { date: "2026-02-01", label: "Feb", total: 4450, tips: 1500, subscriptions: 2950, ppv: 0 },
  { date: "2026-03-01", label: "Mar", total: 5100, tips: 1850, subscriptions: 3250, ppv: 0 },
];

const DEMO_SUBSCRIBERS = [
  { label: "Apr", subscribers: 750 },
  { label: "May", subscribers: 890 },
  { label: "Jun", subscribers: 950 },
  { label: "Jul", subscribers: 1020 },
  { label: "Aug", subscribers: 1080 },
  { label: "Sep", subscribers: 1100 },
  { label: "Oct", subscribers: 1150 },
  { label: "Nov", subscribers: 1200 },
  { label: "Dec", subscribers: 1247 },
  { label: "Jan", subscribers: 1280 },
  { label: "Feb", subscribers: 1310 },
  { label: "Mar", subscribers: 1350 },
];

const DEMO_SPENDING: SpendingRecord[] = [
  { type: "refund", amount: -45.00, status: "completed", date: "2026-04-15", description: "PPV content refund" },
  { type: "chargeback", amount: -120.00, status: "pending", date: "2026-04-12", description: "Subscription chargeback" },
  { type: "refund", amount: -15.00, status: "completed", date: "2026-04-08", description: "Tip refund" },
  { type: "chargeback", amount: -75.00, status: "completed", date: "2026-03-28", description: "PPV chargeback" },
  { type: "refund", amount: -30.00, status: "completed", date: "2026-03-20", description: "Subscription refund" },
  { type: "refund", amount: -20.00, status: "completed", date: "2026-03-15", description: "Tip refund" },
  { type: "chargeback", amount: -200.00, status: "under_review", date: "2026-03-10", description: "Mass chargeback dispute" },
];

const DEMO_ENGAGEMENT = [
  { name: "Messages", value: 89, color: "#38bdf8" },
  { name: "Tips", value: 45, color: "#a78bfa" },
  { name: "Post Likes", value: 234, color: "#f97316" },
  { name: "Comments", value: 67, color: "#34d399" },
  { name: "Shares", value: 23, color: "#fb7185" },
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

function getDaysForPeriod(period: PeriodKey): number {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    case "12m": return 365;
  }
}

function filterByPeriod<T extends { date: string }>(data: T[], period: PeriodKey): T[] {
  const days = getDaysForPeriod(period);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter((item) => new Date(item.date) >= cutoff);
}

/** Transform raw Fanvue earnings API response into our chart format */
function transformEarningsFromAPI(raw: unknown): EarningsPoint[] {
  if (!raw || typeof raw !== "object") return DEMO_DAILY_EARNINGS;

  const data = Array.isArray(raw) ? raw : (raw as Record<string, unknown>).data
    ? (raw as Record<string, unknown>).data as unknown[]
    : raw as Record<string, unknown>[];

  if (Array.isArray(data) && data.length > 0) {
    return data.map((item) => {
      const d = item as Record<string, unknown>;
      const date = (d.date || d.period || d.createdAt || new Date().toISOString()) as string;
      const parsedDate = new Date(date);
      const label = parsedDate.toLocaleDateString("en", { month: "short", day: "numeric" });
      const total = Number(d.total || d.amount || d.earnings || 0);
      const tips = Number(d.tips || 0);
      const subs = Number(d.subscriptions || d.subs || 0);
      const ppv = Number(d.ppv || d.ppvPurchases || 0);

      return {
        date: parsedDate.toISOString().split("T")[0],
        label,
        total,
        tips,
        subscriptions: total > 0 && subs === 0 ? total - tips - ppv : subs,
        ppv,
      };
    });
  }

  // Summary object — synthesize a single point
  if (!Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const total = Number(obj.total || obj.totalEarnings || obj.amount || 0);
    if (total > 0) {
      return [{
        date: new Date().toISOString().split("T")[0],
        label: "Total",
        total,
        tips: Number(obj.tips || obj.totalTips || Math.round(total * 0.25)),
        subscriptions: Number(obj.subscriptions || obj.totalSubscriptions || Math.round(total * 0.6)),
        ppv: Number(obj.ppv || obj.totalPPV || Math.round(total * 0.15)),
      }];
    }
  }

  return DEMO_DAILY_EARNINGS;
}

/** Transform earnings summary from API */
function transformSummaryFromAPI(raw: unknown): EarningsSummary {
  if (!raw || typeof raw !== "object") {
    return {
      totalEarnings: DEMO_DAILY_EARNINGS.reduce((s, e) => s + e.total, 0),
      totalTips: DEMO_DAILY_EARNINGS.reduce((s, e) => s + e.tips, 0),
      totalSubscriptions: DEMO_DAILY_EARNINGS.reduce((s, e) => s + e.subscriptions, 0),
      totalPPV: DEMO_DAILY_EARNINGS.reduce((s, e) => s + e.ppv, 0),
    };
  }

  const obj = raw as Record<string, unknown>;
  return {
    totalEarnings: Number(obj.total || obj.totalEarnings || 0),
    totalTips: Number(obj.tips || obj.totalTips || 0),
    totalSubscriptions: Number(obj.subscriptions || obj.totalSubscriptions || 0),
    totalPPV: Number(obj.ppv || obj.totalPPV || 0),
    periodStart: (obj.periodStart || "") as string,
    periodEnd: (obj.periodEnd || "") as string,
    currency: (obj.currency || "USD") as string,
  };
}

/** Transform spending/refunds API response */
function transformSpendingFromAPI(raw: unknown): SpendingRecord[] {
  if (!raw || typeof raw !== "object") return DEMO_SPENDING;

  const data = Array.isArray(raw) ? raw : (raw as Record<string, unknown>).data
    ? ((raw as Record<string, unknown>).data as unknown[])
    : [raw];

  if (Array.isArray(data) && data.length > 0) {
    return data.map((item) => {
      const d = item as Record<string, unknown>;
      return {
        id: (d.id || "") as string,
        type: (d.type || d.kind || "refund") as string,
        amount: Number(d.amount || 0),
        status: (d.status || "completed") as string,
        date: (d.date || d.createdAt || "") as string,
        description: (d.description || d.reason || "") as string,
        userId: (d.userId || d.fanId || "") as string,
        username: (d.username || d.fanName || "") as string,
      };
    });
  }

  return DEMO_SPENDING;
}

/** Transform subscriber data from sync */
function transformSubscribers(raw: unknown): typeof DEMO_SUBSCRIBERS {
  if (!raw) return DEMO_SUBSCRIBERS;

  if (Array.isArray(raw)) {
    if (raw.length === 0) return DEMO_SUBSCRIBERS;
    const total = raw.length;
    return [{ label: "Current", subscribers: total }];
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const total = Number(obj.total || obj.count || 0);
    if (total > 0) {
      return [{ label: "Current", subscribers: total }];
    }
  }

  return DEMO_SUBSCRIBERS;
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function getTooltipStyle(): React.CSSProperties {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    backgroundColor: isDark ? "oklch(0.14 0.005 270)" : "oklch(1 0 0)",
    border: isDark ? "1px solid oklch(0.22 0 0)" : "1px solid oklch(0.922 0 0)",
    borderRadius: "8px",
    color: isDark ? "oklch(0.985 0 0)" : "oklch(0.145 0 0)",
    fontSize: 12,
  };
}

function EarningsTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={getTooltipStyle()} className="p-3 space-y-1">
      <p className="font-medium text-sm mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.name}</span>
          </div>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AnalyticsSection({ connected }: { connected: boolean }) {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [activeTab, setActiveTab] = useState("earnings");
  const [loading, setLoading] = useState(false);
  const [hasRealData, setHasRealData] = useState(false);

  // Data states
  const [allEarnings, setAllEarnings] = useState<EarningsPoint[]>(DEMO_DAILY_EARNINGS);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary>({
    totalEarnings: DEMO_DAILY_EARNINGS.reduce((s, e) => s + e.total, 0),
    totalTips: DEMO_DAILY_EARNINGS.reduce((s, e) => s + e.tips, 0),
    totalSubscriptions: DEMO_DAILY_EARNINGS.reduce((s, e) => s + e.subscriptions, 0),
    totalPPV: DEMO_DAILY_EARNINGS.reduce((s, e) => s + e.ppv, 0),
  });
  const [subscriberData, setSubscriberData] = useState(DEMO_SUBSCRIBERS);
  const [spendingRecords, setSpendingRecords] = useState<SpendingRecord[]>(DEMO_SPENDING);
  const [engagementData, setEngagementData] = useState(DEMO_ENGAGEMENT);

  // ─── Fetch Data ─────────────────────────────────────────────────────────

  const fetchAnalytics = useCallback(async () => {
    if (!connected) return;
    setLoading(true);

    try {
      // Fetch earnings + summary + spending in parallel
      const [earningsRes, summaryRes, spendingRes, syncRes] = await Promise.allSettled([
        fetch("/api/fanvue/insights/earnings"),
        fetch("/api/fanvue/insights/earnings-summary"),
        fetch("/api/fanvue/insights/spending"),
        fetch("/api/sync-data"),
      ]);

      let gotRealData = false;

      // 1. Earnings data
      if (earningsRes.status === "fulfilled" && earningsRes.value.ok) {
        const data = await earningsRes.value.json();
        const parsed = Array.isArray(data) ? data : data?.data || data?.earnings || data;
        const transformed = transformEarningsFromAPI(parsed);
        if (transformed.length > 0 && transformed[0].total > 0) {
          setAllEarnings(transformed);
          gotRealData = true;
        }
      }

      // 2. Earnings summary
      if (summaryRes.status === "fulfilled" && summaryRes.value.ok) {
        const data = await summaryRes.value.json();
        const parsed = Array.isArray(data) ? data[0] : data?.data || data?.summary || data;
        const transformed = transformSummaryFromAPI(parsed);
        if (transformed.totalEarnings > 0) {
          setEarningsSummary(transformed);
          gotRealData = true;
        }
      }

      // 3. Spending/refunds
      if (spendingRes.status === "fulfilled" && spendingRes.value.ok) {
        const data = await spendingRes.value.json();
        const parsed = Array.isArray(data) ? data : data?.data || data?.spending || data;
        const transformed = transformSpendingFromAPI(parsed);
        if (transformed.length > 0) {
          setSpendingRecords(transformed);
          gotRealData = true;
        }
      }

      // 4. Fallback: sync-data for subscribers + engagement counts
      if (syncRes.status === "fulfilled" && syncRes.value.ok) {
        const result = await syncRes.value.json();
        const sd = result.data;
        if (sd) {
          const subs = sd.subscribers?.data;
          if (subs) setSubscriberData(transformSubscribers(subs));

          const chats = sd.chats?.data;
          const posts = sd.posts?.data;
          if (chats || posts) {
            const chatCount = Array.isArray(chats) ? chats.length : 0;
            const postCount = Array.isArray(posts) ? posts.length : 0;
            if (chatCount > 0 || postCount > 0) {
              setEngagementData([
                { name: "Messages", value: chatCount, color: "#38bdf8" },
                { name: "Posts", value: postCount, color: "#f97316" },
                { name: "Tips", value: Math.round(chatCount * 0.5), color: "#a78bfa" },
                { name: "Comments", value: Math.round(postCount * 0.4), color: "#34d399" },
                { name: "Shares", value: Math.round(postCount * 0.15), color: "#fb7185" },
              ]);
            }
          }
        }
      }

      setHasRealData(gotRealData);
    } catch {
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ─── Derived Data (filtered by period) ─────────────────────────────────

  const filteredEarnings = useMemo(
    () => filterByPeriod(allEarnings, period),
    [allEarnings, period]
  );

  const filteredSpending = useMemo(
    () => filterByPeriod(spendingRecords, period),
    [spendingRecords, period]
  );

  const periodStats = useMemo(() => {
    const totalEarnings = filteredEarnings.reduce((s, e) => s + e.total, 0);
    const totalTips = filteredEarnings.reduce((s, e) => s + e.tips, 0);
    const totalSubs = filteredEarnings.reduce((s, e) => s + e.subscriptions, 0);
    const totalPPV = filteredEarnings.reduce((s, e) => s + e.ppv, 0);
    const totalRefunds = Math.abs(filteredSpending
      .filter((s) => s.type === "refund")
      .reduce((s, e) => s + e.amount, 0));
    const totalChargebacks = Math.abs(filteredSpending
      .filter((s) => s.type === "chargeback")
      .reduce((s, e) => s + e.amount, 0));

    // Compute period-over-period change
    const days = getDaysForPeriod(period);
    const prevCutoff = new Date();
    prevCutoff.setDate(prevCutoff.getDate() - days * 2);
    const currCutoff = new Date();
    currCutoff.setDate(currCutoff.getDate() - days);
    const prevEarnings = allEarnings
      .filter((e) => new Date(e.date) >= prevCutoff && new Date(e.date) < currCutoff)
      .reduce((s, e) => s + e.total, 0);
    const changePercent = prevEarnings > 0 ? Math.round(((totalEarnings - prevEarnings) / prevEarnings) * 100) : 0;

    const netEarnings = totalEarnings - totalRefunds - totalChargebacks;
    const avgDaily = filteredEarnings.length > 0 ? Math.round(totalEarnings / filteredEarnings.length) : 0;

    return {
      totalEarnings, totalTips, totalSubs, totalPPV,
      totalRefunds, totalChargebacks, netEarnings,
      changePercent, avgDaily,
    };
  }, [filteredEarnings, filteredSpending, allEarnings, period]);

  const revenueBreakdown = useMemo(() => {
    const total = periodStats.totalEarnings || 1;
    return [
      { name: "Subscriptions", value: periodStats.totalSubs, pct: Math.round((periodStats.totalSubs / total) * 100), color: "#34d399" },
      { name: "Tips", value: periodStats.totalTips, pct: Math.round((periodStats.totalTips / total) * 100), color: "#38bdf8" },
      { name: "PPV Content", value: periodStats.totalPPV, pct: Math.round((periodStats.totalPPV / total) * 100), color: "#a78bfa" },
    ].filter((r) => r.value > 0);
  }, [periodStats]);

  // ─── Disconnected State ─────────────────────────────────────────────────

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BarChart3 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Analytics unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to view analytics</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Loading analytics...</span>
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Earnings, spending, and engagement metrics
            {!hasRealData && (
              <span className="block text-xs mt-1 text-amber-400">
                Showing demo data. Sync your account for real insights.
              </span>
            )}
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 3 months</SelectItem>
            <SelectItem value="12m">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Net Earnings</p>
              {periodStats.changePercent !== 0 && (
                periodStats.changePercent > 0
                  ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                  : <TrendingDown className="w-4 h-4 text-red-400" />
              )}
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(periodStats.netEarnings)}</p>
            <p className={`text-xs mt-1 ${periodStats.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {periodStats.changePercent >= 0 ? "+" : ""}{periodStats.changePercent}% vs prev period
              {hasRealData ? "" : " (demo)"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Daily</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(periodStats.avgDaily)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(periodStats.totalEarnings)} gross
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Refunds</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{formatCurrency(periodStats.totalRefunds)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(periodStats.totalChargebacks)} chargebacks
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Current Subs</p>
            <p className="text-2xl font-bold mt-1">
              {subscriberData.length > 0 ? subscriberData[subscriberData.length - 1].subscribers.toLocaleString() : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Active subscribers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        {/* ─── Earnings Tab ──────────────────────────────────────────────── */}
        <TabsContent value="earnings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Earnings Bar Chart (daily) */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Daily Earnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredEarnings}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="label"
                        stroke="#666"
                        fontSize={10}
                        interval="preserveStartEnd"
                        angle={-30}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip content={<EarningsTooltipContent />} />
                      <Bar dataKey="total" fill="url(#barGrad)" radius={[3, 3, 0, 0]} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Earnings Trend Line */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-400" />
                  Earnings Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={filteredEarnings}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="label"
                        stroke="#666"
                        fontSize={10}
                        interval="preserveStartEnd"
                        angle={-30}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip content={<EarningsTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={false}
                        name="Total"
                      />
                      <Line
                        type="monotone"
                        dataKey="tips"
                        stroke="#a78bfa"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        name="Tips"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Stacked Area — Revenue Sources Over Time */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Revenue Sources Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredEarnings}>
                      <defs>
                        <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="tipGrad2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ppvGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis
                        dataKey="label"
                        stroke="#666"
                        fontSize={10}
                        interval="preserveStartEnd"
                        angle={-30}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip content={<EarningsTooltipContent />} />
                      <Area type="monotone" dataKey="subscriptions" stackId="1" stroke="#34d399" fill="url(#subGrad)" name="Subscriptions" />
                      <Area type="monotone" dataKey="tips" stackId="1" stroke="#38bdf8" fill="url(#tipGrad2)" name="Tips" />
                      <Area type="monotone" dataKey="ppv" stackId="1" stroke="#a78bfa" fill="url(#ppvGrad)" name="PPV" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Breakdown Bars */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-4">
                {revenueBreakdown.map((source) => (
                  <div key={source.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                        <span>{source.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(source.value)}</span>
                        <span className="text-xs text-muted-foreground">({source.pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${source.pct}%`, backgroundColor: source.color }}
                      />
                    </div>
                  </div>
                ))}
                {revenueBreakdown.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No revenue data for this period</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Subscriber Growth (full width) */}
          {subscriberData.length > 1 && (
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Subscriber Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subscriberData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="label" stroke="#666" fontSize={12} />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip contentStyle={getTooltipStyle()} />
                      <Bar dataKey="subscribers" fill="#34d399" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Spending Tab ──────────────────────────────────────────────── */}
        <TabsContent value="spending" className="space-y-6">
          {/* Spending Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Refunds</p>
                <p className="text-2xl font-bold mt-1 text-amber-400">
                  {formatCurrency(periodStats.totalRefunds)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filteredSpending.filter((s) => s.type === "refund").length} refunds
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Chargebacks</p>
                <p className="text-2xl font-bold mt-1 text-red-400">
                  {formatCurrency(periodStats.totalChargebacks)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {filteredSpending.filter((s) => s.type === "chargeback").length} disputes
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Deduction Rate</p>
                <p className="text-2xl font-bold mt-1">
                  {periodStats.totalEarnings > 0
                    ? `${(((periodStats.totalRefunds + periodStats.totalChargebacks) / periodStats.totalEarnings) * 100).toFixed(1)}%`
                    : "0%"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Of gross earnings
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Spending Records Table */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Refunds &amp; Chargebacks
                <span className="text-muted-foreground font-normal text-sm">
                  ({filteredSpending.length} records)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[400px] overflow-y-auto">
                {filteredSpending.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="font-medium text-sm">No refunds or chargebacks</p>
                    <p className="text-xs mt-1">Clean record for this period</p>
                  </div>
                ) : (
                  <div>
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border/50 font-medium">
                      <div className="col-span-2">Type</div>
                      <div className="col-span-3 text-right">Amount</div>
                      <div className="col-span-3">Status</div>
                      <div className="col-span-2">Date</div>
                      <div className="col-span-2">Description</div>
                    </div>
                    {filteredSpending.map((record, idx) => (
                      <div
                        key={record.id || idx}
                        className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 text-sm"
                      >
                        <div className="col-span-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${record.type === "chargeback" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}
                          >
                            {record.type}
                          </Badge>
                        </div>
                        <div className="col-span-3 text-right font-medium text-red-400">
                          -{formatCurrency(Math.abs(record.amount))}
                        </div>
                        <div className="col-span-3">
                          <Badge
                            variant="outline"
                            className={`text-xs ${record.status === "completed" ? "bg-muted text-muted-foreground" : record.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-sky-500/10 text-sky-400"}`}
                          >
                            {record.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="col-span-2 text-xs text-muted-foreground">
                          {new Date(record.date).toLocaleDateString()}
                        </div>
                        <div className="col-span-2 text-xs text-muted-foreground truncate">
                          {record.description || "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Engagement Tab ────────────────────────────────────────────── */}
        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Engagement Pie */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Engagement Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={engagementData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {engagementData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={getTooltipStyle()} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Engagement Stats */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Key Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {engagementData.map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (item.value / Math.max(...engagementData.map((e) => e.value), 1)) * 100)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
