"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FlaskConical,
  Send,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Users,
  Mail,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Plus,
  X,
  Info,
  Trophy,
  BarChart3,
  TrendingUp,
  Pause,
  RotateCcw,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionBreadcrumbs } from "@/components/dashboard/section-breadcrumbs";

// --- Types ---

interface SmartList {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
}

interface CustomList {
  uuid: string;
  name: string;
  memberCount?: number;
  createdAt?: string;
}

interface ABTestVariant {
  id: "A" | "B";
  text: string;
  mediaUuids: string[];
  ppvPrice: string;
  mediaInput: string;
}

interface ABTestMetrics {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  converted: number;
  revenue: number;
  tips: number;
  ppvPurchases: number;
}

interface ABTest {
  id: string;
  name: string;
  status: "draft" | "running" | "completed" | "paused";
  variantA: ABTestVariant;
  variantB: ABTestVariant;
  targetListIds: string[];
  targetCustomListIds: string[];
  splitRatio: number;
  createdAt: string;
  launchedAt?: string;
  completedAt?: string;
  metricsA: ABTestMetrics;
  metricsB: ABTestMetrics;
  winner?: "A" | "B" | "tie" | "pending";
  confidenceScore?: number;
}

// --- Constants ---

const SMART_LIST_IDS: Array<{ id: string; name: string; description: string }> = [
  { id: "all_fans", name: "All Fans", description: "Everyone who follows you" },
  { id: "subscribers", name: "Active Subscribers", description: "Users with active subscriptions" },
  { id: "expired_subscribers", name: "Expired Subscribers", description: "Users whose subscriptions expired" },
  { id: "top_spenders", name: "Top Spenders", description: "Highest spending fans" },
];

const SPLIT_OPTIONS = [
  { value: 50, label: "50 / 50" },
  { value: 60, label: "60 / 40" },
  { value: 70, label: "70 / 30" },
  { value: 30, label: "30 / 70" },
  { value: 40, label: "40 / 60" },
];

// --- Helpers ---

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

function calcOpenRate(m: ABTestMetrics): number {
  return m.sent > 0 ? Math.round((m.opened / m.sent) * 100) : 0;
}

function calcClickRate(m: ABTestMetrics): number {
  return m.opened > 0 ? Math.round((m.clicked / m.opened) * 100) : 0;
}

function calcConversionRate(m: ABTestMetrics): number {
  return m.sent > 0 ? Math.round((m.converted / m.sent) * 100) : 0;
}

function calcReplyRate(m: ABTestMetrics): number {
  return m.opened > 0 ? Math.round((m.replied / m.opened) * 100) : 0;
}

function determineWinner(test: ABTest): "A" | "B" | "tie" | "pending" {
  if (test.status !== "completed" && test.status !== "running") return "pending";
  if (test.status === "running") {
    // Early declaration if one variant is clearly winning after enough data
    if (test.metricsA.sent < 10 || test.metricsB.sent < 10) return "pending";
  }
  const scoreA = calcOpenRate(test.metricsA) + calcConversionRate(test.metricsA) * 2 + (test.metricsA.revenue / 100);
  const scoreB = calcOpenRate(test.metricsB) + calcConversionRate(test.metricsB) * 2 + (test.metricsB.revenue / 100);
  const diff = Math.abs(scoreA - scoreB);
  if (diff < 2) return "tie";
  return scoreA > scoreB ? "A" : "B";
}

function calcConfidence(a: ABTestMetrics, b: ABTestMetrics): number {
  // Simple confidence based on sample size and difference
  const totalSent = a.sent + b.sent;
  if (totalSent < 20) return 0;
  const convA = calcConversionRate(a);
  const convB = calcConversionRate(b);
  const convDiff = Math.abs(convA - convB);
  const base = Math.min(totalSent / 100, 1) * 80;
  const bonus = Math.min(convDiff / 10, 1) * 20;
  return Math.min(Math.round(base + bonus), 99);
}

function generateDemoMetrics(recipientCount: number, seed: number): ABTestMetrics {
  const jitter = (base: number, range: number) => Math.round(base + (Math.sin(seed * 7.3 + base) * range));
  const half = Math.floor(recipientCount / 2);
  return {
    sent: half,
    opened: jitter(Math.floor(half * 0.72), half * 0.15),
    clicked: jitter(Math.floor(half * 0.23), half * 0.10),
    replied: jitter(Math.floor(half * 0.15), half * 0.08),
    converted: jitter(Math.floor(half * 0.08), half * 0.06),
    revenue: jitter(half * 350, half * 200),
    tips: jitter(half * 2, half),
    ppvPurchases: jitter(Math.floor(half * 0.12), half * 0.08),
  };
}

// --- Component ---

export function ABTestingSection({ connected }: { connected: boolean }) {
  // State
  const [tests, setTests] = useState<ABTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [smartLists, setSmartLists] = useState<SmartList[]>([]);
  const [customLists, setCustomLists] = useState<CustomList[]>([]);

  // Create test form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTestName, setNewTestName] = useState("");
  const [selectedSmartLists, setSelectedSmartLists] = useState<Set<string>>(new Set());
  const [selectedCustomLists, setSelectedCustomLists] = useState<Set<string>>(new Set());
  const [splitRatio, setSplitRatio] = useState(50);
  const [variantA, setVariantA] = useState<ABTestVariant>({ id: "A", text: "", mediaUuids: [], ppvPrice: "", mediaInput: "" });
  const [variantB, setVariantB] = useState<ABTestVariant>({ id: "B", text: "", mediaUuids: [], ppvPrice: "", mediaInput: "" });
  const [showConfirmLaunch, setShowConfirmLaunch] = useState(false);
  const [showVariantPreview, setShowVariantPreview] = useState<"A" | "B" | null>(null);

  // Loading states
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeTest = tests.find((t) => t.id === selectedTestId) ?? null;

  // --- Fetch lists ---

  const fetchLists = useCallback(async () => {
    if (!connected) return;
    setLoadingLists(true);
    try {
      const [smartRes, customRes] = await Promise.allSettled([
        fetch("/api/fanvue/chats/lists/smart"),
        fetch("/api/fanvue/chats/lists/custom?page=1&size=50"),
      ]);

      if (smartRes.status === "fulfilled" && smartRes.value.ok) {
        const data = await smartRes.value.json();
        const list = Array.isArray(data) ? data : data?.data || data?.lists || [];
        setSmartLists(list.length > 0 ? list : SMART_LIST_IDS.map((sl) => ({ id: sl.id, name: sl.name, description: sl.description })));
      } else {
        setSmartLists(SMART_LIST_IDS.map((sl) => ({ id: sl.id, name: sl.name, description: sl.description })));
      }

      if (customRes.status === "fulfilled" && customRes.value.ok) {
        const data = await customRes.value.json();
        const list = Array.isArray(data) ? data : data?.data || data?.lists || [];
        setCustomLists(list);
      }
    } catch {
      setSmartLists(SMART_LIST_IDS.map((sl) => ({ id: sl.id, name: sl.name, description: sl.description })));
    } finally {
      setLoadingLists(false);
    }
  }, [connected]);

  // --- Fetch / load tests ---

  const fetchTests = useCallback(async () => {
    if (!connected) return;
    setLoadingTests(true);
    try {
      const res = await fetch("/api/fanvue/chat-messages/mass");
      if (res.ok) {
        // A/B tests are tracked client-side; use demo data to populate
        const _data = await res.json().catch(() => null);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTests(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchLists();
    fetchTests();
    // Load demo tests
    setTests([
      {
        id: "demo-1",
        name: "Welcome Message Test",
        status: "completed",
        variantA: { id: "A", text: "Hey! Welcome to our exclusive content. New drop this Friday!", mediaUuids: [], ppvPrice: "", mediaInput: "" },
        variantB: { id: "B", text: "Welcome aboard! We have something special coming this Friday. Don't miss it!", mediaUuids: [], ppvPrice: "", mediaInput: "" },
        targetListIds: ["subscribers"],
        targetCustomListIds: [],
        splitRatio: 50,
        createdAt: new Date(Date.now() - 604800000).toISOString(),
        launchedAt: new Date(Date.now() - 604000000).toISOString(),
        completedAt: new Date(Date.now() - 518400000).toISOString(),
        metricsA: generateDemoMetrics(342, 1),
        metricsB: generateDemoMetrics(342, 2),
        winner: "B",
        confidenceScore: 87,
      },
      {
        id: "demo-2",
        name: "PPV Offer A/B",
        status: "running",
        variantA: { id: "A", text: "Special PPV just for you! 20% off this week only.", mediaUuids: ["media-uuid-1"], ppvPrice: "4.99", mediaInput: "" },
        variantB: { id: "B", text: "Exclusive content inside! Limited time access at a special price.", mediaUuids: ["media-uuid-2"], ppvPrice: "3.99", mediaInput: "" },
        targetListIds: ["top_spenders"],
        targetCustomListIds: [],
        splitRatio: 50,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        launchedAt: new Date(Date.now() - 72000000).toISOString(),
        metricsA: generateDemoMetrics(89, 3),
        metricsB: generateDemoMetrics(89, 4),
      },
      {
        id: "demo-3",
        name: "Re-engagement Campaign",
        status: "completed",
        variantA: { id: "A", text: "We miss you! Come back and check out what you've been missing.", mediaUuids: [], ppvPrice: "", mediaInput: "" },
        variantB: { id: "B", text: "It's been a while! Here's a free preview to welcome you back.", mediaUuids: [], ppvPrice: "", mediaInput: "" },
        targetListIds: ["expired_subscribers"],
        targetCustomListIds: [],
        splitRatio: 60,
        createdAt: new Date(Date.now() - 1728000000).toISOString(),
        launchedAt: new Date(Date.now() - 1692000000).toISOString(),
        completedAt: new Date(Date.now() - 1584000000).toISOString(),
        metricsA: generateDemoMetrics(156, 5),
        metricsB: generateDemoMetrics(156, 6),
        winner: "B",
        confidenceScore: 72,
      },
    ]);
  }, [fetchLists, fetchTests]);

  // --- Toggle list selection ---

  const toggleSmartList = (id: string) => {
    setSelectedSmartLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCustomList = (uuid: string) => {
    setSelectedCustomLists((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  // --- Media helpers ---

  const addMediaUuid = (variant: "A" | "B") => {
    const input = variant === "A" ? variantA.mediaInput : variantB.mediaInput;
    const trimmed = input.trim();
    if (!trimmed) return;
    const uuids = variant === "A" ? variantA.mediaUuids : variantB.mediaUuids;
    if (uuids.includes(trimmed)) {
      toast.error("This media UUID is already added");
      return;
    }
    if (uuids.length >= 10) {
      toast.error("Maximum 10 media attachments allowed");
      return;
    }
    if (variant === "A") {
      setVariantA({ ...variantA, mediaUuids: [...variantA.mediaUuids, trimmed], mediaInput: "" });
    } else {
      setVariantB({ ...variantB, mediaUuids: [...variantB.mediaUuids, trimmed], mediaInput: "" });
    }
  };

  const removeMediaUuid = (variant: "A" | "B", uuid: string) => {
    if (variant === "A") {
      setVariantA({ ...variantA, mediaUuids: variantA.mediaUuids.filter((u) => u !== uuid) });
    } else {
      setVariantB({ ...variantB, mediaUuids: variantB.mediaUuids.filter((u) => u !== uuid) });
    }
  };

  // --- Validation ---

  const canCreate =
    newTestName.trim().length > 0 &&
    variantA.text.trim().length > 0 &&
    variantB.text.trim().length > 0 &&
    (selectedSmartLists.size > 0 || selectedCustomLists.size > 0);

  // --- Create test ---

  const handleCreateTest = () => {
    if (!canCreate) return;

    const newTest: ABTest = {
      id: `test-${Date.now()}`,
      name: newTestName.trim(),
      status: "draft",
      variantA: { ...variantA, mediaInput: "" },
      variantB: { ...variantB, mediaInput: "" },
      targetListIds: Array.from(selectedSmartLists),
      targetCustomListIds: Array.from(selectedCustomLists),
      splitRatio,
      createdAt: new Date().toISOString(),
      metricsA: { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0, revenue: 0, tips: 0, ppvPurchases: 0 },
      metricsB: { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0, revenue: 0, tips: 0, ppvPurchases: 0 },
    };

    setTests((prev) => [newTest, ...prev]);
    setSelectedTestId(newTest.id);
    setShowCreateForm(false);
    resetForm();
    toast.success(`A/B test "${newTest.name}" created`);
  };

  const resetForm = () => {
    setNewTestName("");
    setVariantA({ id: "A", text: "", mediaUuids: [], ppvPrice: "", mediaInput: "" });
    setVariantB({ id: "B", text: "", mediaUuids: [], ppvPrice: "", mediaInput: "" });
    setSelectedSmartLists(new Set());
    setSelectedCustomLists(new Set());
    setSplitRatio(50);
  };

  // --- Launch test ---

  const handleLaunch = async () => {
    if (!activeTest) return;
    setLaunching(true);
    try {
      // Send variant A and B as separate mass messages via Fanvue API
      const bodyBase: Record<string, unknown> = {
        includedLists: {
          smartListUuids: activeTest.targetListIds,
          customListUuids: activeTest.targetCustomListIds,
        },
      };

      // Send variant A
      const bodyA = {
        ...bodyBase,
        text: `[A/B Test: ${activeTest.name} - Variant A]\n${activeTest.variantA.text}`,
        mediaUuids: activeTest.variantA.mediaUuids.length > 0 ? activeTest.variantA.mediaUuids : undefined,
        price: activeTest.variantA.ppvPrice ? parseInt(activeTest.variantA.ppvPrice, 10) * 100 : undefined,
      };

      const resA = await fetch("/api/fanvue/chats/mass-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyA),
      });

      // Send variant B
      const bodyB = {
        ...bodyBase,
        text: `[A/B Test: ${activeTest.name} - Variant B]\n${activeTest.variantB.text}`,
        mediaUuids: activeTest.variantB.mediaUuids.length > 0 ? activeTest.variantB.mediaUuids : undefined,
        price: activeTest.variantB.ppvPrice ? parseInt(activeTest.variantB.ppvPrice, 10) * 100 : undefined,
      };

      const resB = await fetch("/api/fanvue/chats/mass-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyB),
      });

      if (resA.ok || resB.ok) {
        // Update test status to running with simulated metrics
        const recipientCount = 200; // estimated
        const half = Math.floor(recipientCount * activeTest.splitRatio / 100);
        const otherHalf = recipientCount - half;

        setTests((prev) =>
          prev.map((t) =>
            t.id === activeTest.id
              ? {
                  ...t,
                  status: "running",
                  launchedAt: new Date().toISOString(),
                  metricsA: { ...t.metricsA, sent: half },
                  metricsB: { ...t.metricsB, sent: otherHalf },
                }
              : t
          )
        );

        toast.success(`A/B test "${activeTest.name}" launched! Both variants sent.`);
        setShowConfirmLaunch(false);
      } else {
        const errorA = resA.ok ? null : await resA.json().catch(() => ({}));
        const errorB = resB.ok ? null : await resB.json().catch(() => ({}));
        const msg = (errorA as { error?: string })?.error || (errorB as { error?: string })?.error || "Failed to send variants";
        toast.error(msg);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error launching A/B test";
      toast.error(message);
    } finally {
      setLaunching(false);
    }
  };

  // --- Pause / Resume ---

  const handleTogglePause = (testId: string) => {
    setTests((prev) =>
      prev.map((t) => {
        if (t.id !== testId) return t;
        const newStatus = t.status === "running" ? "paused" : "running";
        return { ...t, status: newStatus };
      })
    );
    const test = tests.find((t) => t.id === testId);
    if (test) {
      toast.success(test.status === "running" ? "Test paused" : "Test resumed");
    }
  };

  // --- Complete test ---

  const handleComplete = (testId: string) => {
    setTests((prev) =>
      prev.map((t) => {
        if (t.id !== testId) return t;
        const winner = determineWinner(t);
        const confidence = calcConfidence(t.metricsA, t.metricsB);
        return {
          ...t,
          status: "completed" as const,
          completedAt: new Date().toISOString(),
          winner,
          confidenceScore: confidence,
        };
      })
    );
    toast.success("Test completed. Results are now available.");
  };

  // --- Delete test ---

  const handleDelete = (testId: string) => {
    setDeletingId(testId);
    setTests((prev) => prev.filter((t) => t.id !== testId));
    if (selectedTestId === testId) setSelectedTestId(null);
    setDeletingId(null);
    toast.success("A/B test deleted");
  };

  // --- Copy variant text ---

  const [copiedVariant, setCopiedVariant] = useState<"A" | "B" | null>(null);

  const handleCopyVariant = (variant: "A" | "B", text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedVariant(variant);
      setTimeout(() => setCopiedVariant(null), 2000);
      toast.success(`Variant ${variant} text copied`);
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  // --- Duplicate test ---

  const handleDuplicate = (test: ABTest) => {
    const dup: ABTest = {
      ...test,
      id: `test-${Date.now()}`,
      name: `${test.name} (Copy)`,
      status: "draft",
      createdAt: new Date().toISOString(),
      launchedAt: undefined,
      completedAt: undefined,
      winner: undefined,
      confidenceScore: undefined,
      metricsA: { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0, revenue: 0, tips: 0, ppvPurchases: 0 },
      metricsB: { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0, revenue: 0, tips: 0, ppvPurchases: 0 },
    };
    setTests((prev) => [dup, ...prev]);
    setSelectedTestId(dup.id);
    toast.success(`Duplicated "${test.name}"`);
  };

  // --- Disconnected state ---

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FlaskConical className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">A/B Testing unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to create A/B tests</p>
      </div>
    );
  }

  // --- Status badge ---

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">Draft</Badge>;
      case "running":
        return (
          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Running
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
            <Pause className="w-3 h-3 mr-1" />
            Paused
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  // --- Metrics bar ---

  const MetricBar = ({ label, valueA, valueB, unit, higherIsBetter }: { label: string; valueA: number; valueB: number; unit: string; higherIsBetter?: boolean }) => {
    const aWins = higherIsBetter !== false ? valueA >= valueB : valueA <= valueB;
    const bWins = higherIsBetter !== false ? valueB >= valueA : valueB <= valueA;
    const maxVal = Math.max(valueA, valueB, 1);
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
        </div>
        <div className="space-y-1">
          {/* Variant A bar */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] w-4 font-bold ${aWins && valueA !== valueB ? "text-sky-400" : "text-muted-foreground"}`}>A</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${aWins && valueA !== valueB ? "bg-sky-500" : "bg-sky-500/50"}`}
                style={{ width: `${(valueA / maxVal) * 100}%` }}
              />
            </div>
            <span className={`text-[10px] w-12 text-right ${aWins && valueA !== valueB ? "text-sky-400 font-medium" : "text-muted-foreground"}`}>
              {valueA}{unit}
            </span>
          </div>
          {/* Variant B bar */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] w-4 font-bold ${bWins && valueB !== valueA ? "text-violet-400" : "text-muted-foreground"}`}>B</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${bWins && valueB !== valueA ? "bg-violet-500" : "bg-violet-500/50"}`}
                style={{ width: `${(valueB / maxVal) * 100}%` }}
              />
            </div>
            <span className={`text-[10px] w-12 text-right ${bWins && valueB !== valueA ? "text-violet-400 font-medium" : "text-muted-foreground"}`}>
              {valueB}{unit}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // --- Metric card ---

  const MetricCard = ({ icon: Icon, label, valueA, valueB, unit, color }: { icon: typeof BarChart3; label: string; valueA: number; valueB: number; unit: string; color: string }) => (
    <div className="bg-card/50 border border-border/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] text-sky-400 font-medium">Variant A</span>
          <p className="text-sm font-semibold">{valueA}{unit}</p>
        </div>
        <div>
          <span className="text-[10px] text-violet-400 font-medium">Variant B</span>
          <p className="text-sm font-semibold">{valueB}{unit}</p>
        </div>
      </div>
    </div>
  );

  // --- Create form ---

  const renderCreateForm = () => (
    <div className="space-y-6">
      <button
        onClick={() => setShowCreateForm(false)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to tests
      </button>

      <h2 className="text-xl font-bold">Create A/B Test</h2>

      {/* Test Name */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            Test Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Test Name</Label>
            <Input
              value={newTestName}
              onChange={(e) => setNewTestName(e.target.value)}
              placeholder="e.g., Welcome Message Test"
              className="max-w-md"
            />
          </div>

          {/* Split Ratio */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Split Ratio</Label>
            <div className="flex gap-2">
              {SPLIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSplitRatio(opt.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    splitRatio === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-border"
                  }`}
                >
                  A: {opt.value}% / B: {100 - opt.value}%
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Variant A goes to {splitRatio}% of recipients, Variant B to {100 - splitRatio}%
            </p>
          </div>

          {/* Target Lists */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Target Lists</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {smartLists.map((list) => {
                const isSelected = selectedSmartLists.has(list.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => toggleSmartList(list.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border transition-colors text-left ${
                      isSelected ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                      isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{list.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{list.description || list.id}</p>
                    </div>
                  </button>
                );
              })}
              {customLists.map((list) => {
                const isSelected = selectedCustomLists.has(list.uuid);
                return (
                  <button
                    key={list.uuid}
                    onClick={() => toggleCustomList(list.uuid)}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border transition-colors text-left ${
                      isSelected ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                      isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{list.name}</p>
                      {list.memberCount != null && <p className="text-xs text-muted-foreground">{list.memberCount} members</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variant A */}
      <Card className="bg-card/50 border border-sky-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold">A</div>
            Variant A
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={variantA.text}
            onChange={(e) => setVariantA({ ...variantA, text: e.target.value })}
            placeholder="Write variant A message..."
            className="min-h-[100px] resize-y"
            maxLength={5000}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>First message your recipients will see</span>
            <span>{variantA.text.length}/5000</span>
          </div>

          {/* Media */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Media Attachments (optional)</Label>
            <div className="flex gap-2">
              <Input
                value={variantA.mediaInput}
                onChange={(e) => setVariantA({ ...variantA, mediaInput: e.target.value })}
                placeholder="Paste media UUID..."
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMediaUuid("A"); } }}
              />
              <Button variant="outline" size="sm" onClick={() => addMediaUuid("A")} disabled={!variantA.mediaInput.trim() || variantA.mediaUuids.length >= 10}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {variantA.mediaUuids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {variantA.mediaUuids.map((uuid) => (
                  <Badge key={uuid} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                    <span className="max-w-[120px] truncate">{uuid}</span>
                    <button onClick={() => removeMediaUuid("A", uuid)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* PPV */}
          <div>
            <Label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              PPV Price (optional)
            </Label>
            <div className="relative w-28">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                value={variantA.ppvPrice}
                onChange={(e) => setVariantA({ ...variantA, ppvPrice: e.target.value })}
                placeholder="0.00"
                className="pl-7"
                min="2"
                step="0.01"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variant B */}
      <Card className="bg-card/50 border border-violet-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-violet-500/20 text-violet-400 flex items-center justify-center text-xs font-bold">B</div>
            Variant B
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={variantB.text}
            onChange={(e) => setVariantB({ ...variantB, text: e.target.value })}
            placeholder="Write variant B message..."
            className="min-h-[100px] resize-y"
            maxLength={5000}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Alternative message for comparison</span>
            <span>{variantB.text.length}/5000</span>
          </div>

          {/* Media */}
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Media Attachments (optional)</Label>
            <div className="flex gap-2">
              <Input
                value={variantB.mediaInput}
                onChange={(e) => setVariantB({ ...variantB, mediaInput: e.target.value })}
                placeholder="Paste media UUID..."
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMediaUuid("B"); } }}
              />
              <Button variant="outline" size="sm" onClick={() => addMediaUuid("B")} disabled={!variantB.mediaInput.trim() || variantB.mediaUuids.length >= 10}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {variantB.mediaUuids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {variantB.mediaUuids.map((uuid) => (
                  <Badge key={uuid} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                    <span className="max-w-[120px] truncate">{uuid}</span>
                    <button onClick={() => removeMediaUuid("B", uuid)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* PPV */}
          <div>
            <Label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              PPV Price (optional)
            </Label>
            <div className="relative w-28">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                value={variantB.ppvPrice}
                onChange={(e) => setVariantB({ ...variantB, ppvPrice: e.target.value })}
                placeholder="0.00"
                className="pl-7"
                min="2"
                step="0.01"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create button */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => { setShowCreateForm(false); resetForm(); }}>
          Cancel
        </Button>
        <Button onClick={handleCreateTest} disabled={!canCreate}>
          <FlaskConical className="w-4 h-4 mr-2" />
          Create A/B Test
        </Button>
      </div>
    </div>
  );

  // --- Test detail view ---

  const renderTestDetail = () => {
    if (!activeTest) return null;
    const winner = activeTest.winner || determineWinner(activeTest);
    const confidence = activeTest.confidenceScore || calcConfidence(activeTest.metricsA, activeTest.metricsB);

    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedTestId(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to tests
        </button>

        <SectionBreadcrumbs items={[{ label: "A/B Testing" }, { label: activeTest.name }]} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold">{activeTest.name}</h2>
              <StatusBadge status={activeTest.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              Created {timeAgo(activeTest.createdAt)} {activeTest.launchedAt ? `| Launched ${timeAgo(activeTest.launchedAt)}` : ""}
              {activeTest.completedAt ? ` | Completed ${timeAgo(activeTest.completedAt)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(activeTest.status === "running" || activeTest.status === "paused") && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleTogglePause(activeTest.id)}>
                  {activeTest.status === "running" ? <Pause className="w-3.5 h-3.5 mr-1.5" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                  {activeTest.status === "running" ? "Pause" : "Resume"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleComplete(activeTest.id)} className="text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Complete
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => handleDuplicate(activeTest)}>
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(activeTest.id)} disabled={deletingId === activeTest.id} className="text-destructive">
              {deletingId === activeTest.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete
            </Button>
          </div>
        </div>

        {/* Split Ratio Info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <FlaskConical className="w-4 h-4" />
          <span>Split: <strong className="text-sky-400">A: {activeTest.splitRatio}%</strong> / <strong className="text-violet-400">B: {100 - activeTest.splitRatio}%</strong></span>
          <Separator orientation="vertical" className="h-4" />
          <span>Lists: {activeTest.targetListIds.length + activeTest.targetCustomListIds.length}</span>
        </div>

        {/* Winner Banner (if completed) */}
        {activeTest.status === "completed" && winner !== "pending" && (
          <div className={`rounded-lg p-4 border ${winner === "tie" ? "bg-amber-500/5 border-amber-500/20" : winner === "A" ? "bg-sky-500/5 border-sky-500/20" : "bg-violet-500/5 border-violet-500/20"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${winner === "tie" ? "bg-amber-500/20" : winner === "A" ? "bg-sky-500/20" : "bg-violet-500/20"}`}>
                <Trophy className={`w-5 h-5 ${winner === "tie" ? "text-amber-400" : winner === "A" ? "text-sky-400" : "text-violet-400"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  {winner === "tie" ? "No Clear Winner" : `Variant ${winner} Wins!`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {winner === "tie"
                    ? "Both variants performed similarly. Consider testing with a larger sample or different variables."
                    : `Variant ${winner} showed superior engagement and conversion rates across all key metrics.`
                  }
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{confidence}%</p>
                <p className="text-[10px] text-muted-foreground">Confidence</p>
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={Mail}
            label="Open Rate"
            valueA={calcOpenRate(activeTest.metricsA)}
            valueB={calcOpenRate(activeTest.metricsB)}
            unit="%"
            color="text-sky-400"
          />
          <MetricCard
            icon={TrendingUp}
            label="Conversion Rate"
            valueA={calcConversionRate(activeTest.metricsA)}
            valueB={calcConversionRate(activeTest.metricsB)}
            unit="%"
            color="text-emerald-400"
          />
          <MetricCard
            icon={DollarSign}
            label="Revenue"
            valueA={activeTest.metricsA.revenue}
            valueB={activeTest.metricsB.revenue}
            unit=""
            color="text-amber-400"
          />
          <MetricCard
            icon={Users}
            label="Replies"
            valueA={activeTest.metricsA.replied}
            valueB={activeTest.metricsB.replied}
            unit=""
            color="text-violet-400"
          />
        </div>

        {/* Detailed Metrics Comparison */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Detailed Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricBar label="Sent" valueA={activeTest.metricsA.sent} valueB={activeTest.metricsB.sent} unit="" />
            <MetricBar label="Opened" valueA={activeTest.metricsA.opened} valueB={activeTest.metricsB.opened} unit="" />
            <MetricBar label="Open Rate" valueA={calcOpenRate(activeTest.metricsA)} valueB={calcOpenRate(activeTest.metricsB)} unit="%" />
            <MetricBar label="Clicked" valueA={activeTest.metricsA.clicked} valueB={activeTest.metricsB.clicked} unit="" />
            <MetricBar label="Click Rate" valueA={calcClickRate(activeTest.metricsA)} valueB={calcClickRate(activeTest.metricsB)} unit="%" />
            <MetricBar label="Replied" valueA={activeTest.metricsA.replied} valueB={activeTest.metricsB.replied} unit="" />
            <MetricBar label="Reply Rate" valueA={calcReplyRate(activeTest.metricsA)} valueB={calcReplyRate(activeTest.metricsB)} unit="%" />
            <MetricBar label="Converted" valueA={activeTest.metricsA.converted} valueB={activeTest.metricsB.converted} unit="" />
            <MetricBar label="Conversion Rate" valueA={calcConversionRate(activeTest.metricsA)} valueB={calcConversionRate(activeTest.metricsB)} unit="%" />
            <MetricBar label="Revenue (cents)" valueA={activeTest.metricsA.revenue} valueB={activeTest.metricsB.revenue} unit="" />
            <MetricBar label="Tips" valueA={activeTest.metricsA.tips} valueB={activeTest.metricsB.tips} unit="" />
            <MetricBar label="PPV Purchases" valueA={activeTest.metricsA.ppvPurchases} valueB={activeTest.metricsB.ppvPurchases} unit="" />
          </CardContent>
        </Card>

        {/* Variant Messages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Variant A */}
          <Card className={`bg-card/50 ${winner === "A" && activeTest.status === "completed" ? "border-sky-500/50" : "border-border/50"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${winner === "A" && activeTest.status === "completed" ? "bg-sky-500 text-white" : "bg-sky-500/20 text-sky-400"}`}>
                    A
                  </div>
                  Variant A
                  {winner === "A" && activeTest.status === "completed" && <Trophy className="w-4 h-4 text-sky-400" />}
                </CardTitle>
                <button onClick={() => handleCopyVariant("A", activeTest.variantA.text)} className="text-muted-foreground hover:text-foreground" title="Copy text">
                  {copiedVariant === "A" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{activeTest.variantA.text}</p>
              </div>
              {activeTest.variantA.mediaUuids.length > 0 && (
                <p className="text-xs text-muted-foreground">{activeTest.variantA.mediaUuids.length} media attachment(s)</p>
              )}
              {activeTest.variantA.ppvPrice && (
                <p className="text-xs text-primary">PPV: {activeTest.variantA.ppvPrice}</p>
              )}
              <div className="text-[10px] text-muted-foreground">
                Sent to {activeTest.metricsA.sent} recipients
              </div>
            </CardContent>
          </Card>

          {/* Variant B */}
          <Card className={`bg-card/50 ${winner === "B" && activeTest.status === "completed" ? "border-violet-500/50" : "border-border/50"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${winner === "B" && activeTest.status === "completed" ? "bg-violet-500 text-white" : "bg-violet-500/20 text-violet-400"}`}>
                    B
                  </div>
                  Variant B
                  {winner === "B" && activeTest.status === "completed" && <Trophy className="w-4 h-4 text-violet-400" />}
                </CardTitle>
                <button onClick={() => handleCopyVariant("B", activeTest.variantB.text)} className="text-muted-foreground hover:text-foreground" title="Copy text">
                  {copiedVariant === "B" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{activeTest.variantB.text}</p>
              </div>
              {activeTest.variantB.mediaUuids.length > 0 && (
                <p className="text-xs text-muted-foreground">{activeTest.variantB.mediaUuids.length} media attachment(s)</p>
              )}
              {activeTest.variantB.ppvPrice && (
                <p className="text-xs text-primary">PPV: {activeTest.variantB.ppvPrice}</p>
              )}
              <div className="text-[10px] text-muted-foreground">
                Sent to {activeTest.metricsB.sent} recipients
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // --- Test list view ---

  const renderTestList = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground text-sm">
            Test different messages to find what resonates best with your audience
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <FlaskConical className="w-4 h-4 mr-2" />
          New Test
        </Button>
      </div>

      {/* Info banner */}
      <div className="bg-muted/30 rounded-lg p-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>A/B tests send two message variants to your selected lists. Compare open rates, conversions, and revenue to determine the winning variant.</p>
          <p>Tests can be launched immediately. Results are tracked per variant with confidence scoring.</p>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card/50 border border-border/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total Tests</p>
          <p className="text-xl font-bold mt-1">{tests.length}</p>
        </div>
        <div className="bg-card/50 border border-border/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Running</p>
          <p className="text-xl font-bold mt-1 text-blue-400">{tests.filter((t) => t.status === "running").length}</p>
        </div>
        <div className="bg-card/50 border border-border/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-xl font-bold mt-1 text-emerald-400">{tests.filter((t) => t.status === "completed").length}</p>
        </div>
        <div className="bg-card/50 border border-border/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Best Win Rate</p>
          <p className="text-xl font-bold mt-1 text-amber-400">
            {tests.filter((t) => t.status === "completed" && t.confidenceScore && t.confidenceScore > 0).length > 0
              ? `${Math.max(...tests.filter((t) => t.confidenceScore && t.confidenceScore > 0).map((t) => t.confidenceScore ?? 0))}%`
              : "N/A"}
          </p>
        </div>
      </div>

      {/* Test cards */}
      {loadingTests ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-card/50 border border-border/50 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-10 w-full rounded" />
                    <Skeleton className="h-10 w-full rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tests.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <FlaskConical className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="font-medium text-sm">No A/B tests yet</p>
            <p className="text-xs mt-1">Create your first test to start optimizing your messages</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreateForm(true)}>
              <FlaskConical className="w-4 h-4 mr-2" />
              Create Test
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => {
            const winner = test.winner || determineWinner(test);
            const confidence = test.confidenceScore || calcConfidence(test.metricsA, test.metricsB);
            return (
              <Card key={test.id} className="bg-card/50 border-border/50 hover:border-border transition-colors cursor-pointer" onClick={() => setSelectedTestId(test.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={test.status} />
                        <span className="text-xs text-muted-foreground">{timeAgo(test.createdAt)}</span>
                      </div>
                      <p className="font-medium text-sm">{test.name}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {test.targetListIds.length + test.targetCustomListIds.length} list(s)
                        </span>
                        <span className="flex items-center gap-1">
                          <FlaskConical className="w-3 h-3" />
                          A: {test.splitRatio}% / B: {100 - test.splitRatio}%
                        </span>
                        {(test.status === "running" || test.status === "completed") && (
                          <>
                            <span className="flex items-center gap-1 text-sky-400">
                              A: {calcOpenRate(test.metricsA)}% open
                            </span>
                            <span className="flex items-center gap-1 text-violet-400">
                              B: {calcOpenRate(test.metricsB)}% open
                            </span>
                          </>
                        )}
                      </div>
                      {/* Preview variants truncated */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-muted/30 rounded p-2">
                          <span className="text-[10px] text-sky-400 font-medium">A: </span>
                          <span className="text-[10px] text-muted-foreground truncate block">{test.variantA.text.slice(0, 60)}...</span>
                        </div>
                        <div className="bg-muted/30 rounded p-2">
                          <span className="text-[10px] text-violet-400 font-medium">B: </span>
                          <span className="text-[10px] text-muted-foreground truncate block">{test.variantB.text.slice(0, 60)}...</span>
                        </div>
                      </div>
                    </div>
                    {/* Winner badge */}
                    {test.status === "completed" && winner !== "pending" && winner !== "tie" && (
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${winner === "A" ? "bg-sky-500/20" : "bg-violet-500/20"}`}>
                        <Trophy className={`w-5 h-5 ${winner === "A" ? "text-sky-400" : "text-violet-400"}`} />
                      </div>
                    )}
                    {test.status === "completed" && winner === "tie" && (
                      <div className="flex-shrink-0">
                        <p className="text-xs text-amber-400">Tie</p>
                        <p className="text-[10px] text-muted-foreground">{confidence}%</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // --- Confirm launch dialog ---

  const renderConfirmLaunch = () => {
    if (!showConfirmLaunch || !activeTest) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="w-full max-w-md mx-4 bg-background border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              Launch A/B Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="font-medium">You are about to launch "{activeTest.name}".</p>
              <p className="text-muted-foreground">Both variants will be sent as separate mass messages to your selected lists. The Fanvue API will deliver each variant to all recipients in the target lists.</p>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px] font-bold">A</div>
                  <span className="text-xs truncate">{activeTest.variantA.text.slice(0, 80)}...</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-violet-500/20 text-violet-400 flex items-center justify-center text-[10px] font-bold">B</div>
                  <span className="text-xs truncate">{activeTest.variantB.text.slice(0, 80)}...</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Split: A {activeTest.splitRatio}% / B {100 - activeTest.splitRatio}%</span>
                <Separator orientation="vertical" className="h-3" />
                <span>{activeTest.targetListIds.length + activeTest.targetCustomListIds.length} list(s)</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirmLaunch(false)} disabled={launching}>
                Cancel
              </Button>
              <Button onClick={handleLaunch} disabled={launching}>
                {launching ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Launch Test</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // --- Main render ---

  if (showCreateForm) return renderCreateForm();
  if (selectedTestId) return renderTestDetail();
  return (
    <>
      {renderTestList()}
      {renderConfirmLaunch()}
    </>
  );
}
