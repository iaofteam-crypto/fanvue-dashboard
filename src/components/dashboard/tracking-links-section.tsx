"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Link2,
  Plus,
  Trash2,
  Loader2,
  Copy,
  ExternalLink,
  Search,
  RefreshCw,
  Users,
  MousePointerClick,
  DollarSign,
  TrendingUp,
  ArrowLeft,
  AlertCircle,
  Check,
  X,
  Globe,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SectionBreadcrumbs } from "@/components/dashboard/section-breadcrumbs";

// --- Types ---

interface TrackingLink {
  id: string;
  slug?: string;
  url?: string;
  name?: string;
  destination?: string;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  subscribers?: number;
  source?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface TrackingLinkUser {
  id: string;
  username?: string;
  displayName?: string;
  clicks?: number;
  converted?: boolean;
  subscribed?: boolean;
  spent?: number;
  firstVisitAt?: string;
  lastVisitAt?: string;
  source?: string;
}

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
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

function conversionRate(clicks: number, conversions: number): string {
  if (clicks === 0) return "0%";
  return `${((conversions / clicks) * 100).toFixed(1)}%`;
}

// --- Demo data ---

const DEMO_LINKS: TrackingLink[] = [
  { id: "tl-demo-1", name: "Instagram Bio", destination: "https://fanvue.com/creator", source: "instagram", clicks: 1247, conversions: 89, revenue: 44500, subscribers: 67, isActive: true, createdAt: new Date(Date.now() - 86400000 * 60).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "tl-demo-2", name: "Twitter Link", destination: "https://fanvue.com/creator", source: "twitter", clicks: 834, conversions: 52, revenue: 26000, subscribers: 41, isActive: true, createdAt: new Date(Date.now() - 86400000 * 45).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "tl-demo-3", name: "TikTok Profile", destination: "https://fanvue.com/creator", source: "tiktok", clicks: 2156, conversions: 143, revenue: 71500, subscribers: 112, isActive: true, createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), updatedAt: new Date(Date.now() - 1800000).toISOString() },
  { id: "tl-demo-4", name: "YouTube Description", destination: "https://fanvue.com/creator/promo", source: "youtube", clicks: 567, conversions: 34, revenue: 17000, subscribers: 28, isActive: true, createdAt: new Date(Date.now() - 86400000 * 20).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "tl-demo-5", name: "Reddit Post", destination: "https://fanvue.com/creator", source: "reddit", clicks: 312, conversions: 18, revenue: 9000, subscribers: 12, isActive: false, createdAt: new Date(Date.now() - 86400000 * 90).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: "tl-demo-6", name: "Email Signature", destination: "https://fanvue.com/creator/newsletter", source: "email", clicks: 89, conversions: 7, revenue: 3500, subscribers: 5, isActive: true, createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
];

const DEMO_USERS: TrackingLinkUser[] = [
  { id: "u-1", displayName: "Alex Johnson", clicks: 3, converted: true, subscribed: true, spent: 2500, firstVisitAt: new Date(Date.now() - 86400000 * 10).toISOString(), lastVisitAt: new Date(Date.now() - 3600000).toISOString(), source: "instagram" },
  { id: "u-2", displayName: "Sarah Mitchell", clicks: 1, converted: true, subscribed: true, spent: 5000, firstVisitAt: new Date(Date.now() - 86400000 * 7).toISOString(), lastVisitAt: new Date(Date.now() - 86400000 * 2).toISOString(), source: "instagram" },
  { id: "u-3", displayName: "Mike Davis", clicks: 5, converted: false, subscribed: false, spent: 0, firstVisitAt: new Date(Date.now() - 86400000 * 3).toISOString(), lastVisitAt: new Date(Date.now() - 3600000 * 8).toISOString(), source: "twitter" },
  { id: "u-4", displayName: "Jordan Kim", clicks: 2, converted: true, subscribed: true, spent: 12000, firstVisitAt: new Date(Date.now() - 86400000 * 14).toISOString(), lastVisitAt: new Date(Date.now() - 3600000 * 2).toISOString(), source: "tiktok" },
  { id: "u-5", displayName: "Chris Park", clicks: 8, converted: true, subscribed: false, spent: 800, firstVisitAt: new Date(Date.now() - 86400000 * 5).toISOString(), lastVisitAt: new Date(Date.now() - 86400000 * 1).toISOString(), source: "tiktok" },
  { id: "u-6", displayName: "Emma Wilson", clicks: 1, converted: true, subscribed: true, spent: 3500, firstVisitAt: new Date(Date.now() - 86400000 * 2).toISOString(), lastVisitAt: new Date(Date.now() - 3600000 * 12).toISOString(), source: "youtube" },
  { id: "u-7", displayName: "David Chen", clicks: 4, converted: false, subscribed: false, spent: 0, firstVisitAt: new Date(Date.now() - 86400000 * 8).toISOString(), lastVisitAt: new Date(Date.now() - 86400000 * 4).toISOString(), source: "reddit" },
  { id: "u-8", displayName: "Lisa Taylor", clicks: 2, converted: true, subscribed: true, spent: 7800, firstVisitAt: new Date(Date.now() - 86400000 * 6).toISOString(), lastVisitAt: new Date(Date.now() - 3600000 * 4).toISOString(), source: "instagram" },
];

const SOURCE_COLORS: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  twitter: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  tiktok: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  youtube: "bg-red-500/10 text-red-400 border-red-500/20",
  reddit: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  email: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

// --- Component ---

export function TrackingLinksSection({ connected }: { connected: boolean }) {
  // View state
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Data state
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [linkUsers, setLinkUsers] = useState<TrackingLinkUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create form state
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkDestination, setNewLinkDestination] = useState("");
  const [newLinkSource, setNewLinkSource] = useState("");

  // Loading state
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // --- Fetch links ---

  const fetchLinks = useCallback(async () => {
    if (!connected) return;
    setLoadingLinks(true);
    try {
      const res = await fetch("/api/fanvue/tracking-links?page=1&size=50");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data || data?.links || [];
        if (list.length > 0) {
          setLinks(list);
        } else {
          setLinks([]);
        }
        setLoadingLinks(false);
        return;
      }
    } catch {
      // fall through to demo
    }
    setLinks(DEMO_LINKS);
    setLoadingLinks(false);
  }, [connected]);

  // --- Fetch users for a link ---

  const fetchLinkUsers = useCallback(async (linkId: string) => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`/api/fanvue/tracking-links/${linkId}/users?page=1&size=50`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.data || data?.users || [];
        if (items.length > 0) {
          setLinkUsers(items);
          setLoadingUsers(false);
          return;
        }
      }
    } catch {
      // fall through to demo
    }
    setLinkUsers(DEMO_USERS);
    setLoadingUsers(false);
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // --- CRUD operations ---

  const handleCreateLink = async () => {
    if (!newLinkName.trim()) {
      toast.error("Link name is required");
      return;
    }
    if (!newLinkDestination.trim()) {
      toast.error("Destination URL is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/fanvue/tracking-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newLinkName.trim(),
          destination: newLinkDestination.trim(),
          source: newLinkSource.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success(`Tracking link "${newLinkName.trim()}" created`);
        setNewLinkName("");
        setNewLinkDestination("");
        setNewLinkSource("");
        setShowCreateForm(false);
        fetchLinks();
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { error?: string; message?: string }).error || (err as { error?: string; message?: string }).message || `Failed (${res.status})`;
        toast.error(msg);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    setDeleting(linkId);
    try {
      const res = await fetch(`/api/fanvue/tracking-links/${linkId}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        toast.success("Tracking link deleted");
        setLinks((prev) => prev.filter((l) => l.id !== linkId));
        if (selectedLinkId === linkId) {
          setSelectedLinkId(null);
          setLinkUsers([]);
        }
        setConfirmDeleteId(null);
      } else {
        toast.error("Failed to delete tracking link");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy");
    });
  };

  // --- Navigation ---

  const handleSelectLink = (linkId: string) => {
    setSelectedLinkId(linkId);
    fetchLinkUsers(linkId);
  };

  const handleBack = () => {
    setSelectedLinkId(null);
    setLinkUsers([]);
  };

  // --- Filtered links ---

  const filteredLinks = links.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (l.name || "").toLowerCase().includes(q) || (l.source || "").toLowerCase().includes(q) || (l.destination || "").toLowerCase().includes(q);
  });

  const selectedLink = selectedLinkId
    ? links.find((l) => l.id === selectedLinkId)
    : null;

  // Stats
  const totalClicks = links.reduce((sum, l) => sum + (l.clicks ?? 0), 0);
  const totalConversions = links.reduce((sum, l) => sum + (l.conversions ?? 0), 0);
  const totalRevenue = links.reduce((sum, l) => sum + (l.revenue ?? 0), 0);
  const totalSubscribers = links.reduce((sum, l) => sum + (l.subscribers ?? 0), 0);

  // --- Disconnected state ---

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Link2 className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Tracking Links unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to manage tracking links</p>
      </div>
    );
  }

  // --- Detail view (users for a selected link) ---

  if (selectedLinkId && selectedLink) {
    const breadcrumbItems = [{ label: "Tracking Links" }, { label: selectedLink.name || "Tracking Link" }];
    return (
      <div className="space-y-4">
        <SectionBreadcrumbs items={breadcrumbItems} />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                {selectedLink.name || "Tracking Link"}
                {selectedLink.source && (
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${SOURCE_COLORS[selectedLink.source] || ""}`}>
                    {selectedLink.source}
                  </Badge>
                )}
              </h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {linkUsers.length} user{linkUsers.length !== 1 ? "s" : ""}
                </Badge>
                {selectedLink.destination && (
                  <span className="truncate max-w-[200px]">{selectedLink.destination}</span>
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchLinkUsers(selectedLinkId)} disabled={loadingUsers}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingUsers ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats for this link */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" />
                Clicks
              </div>
              <div className="text-lg font-bold mt-0.5">{selectedLink.clicks ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Conversions
              </div>
              <div className="text-lg font-bold mt-0.5">
                {selectedLink.conversions ?? 0}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({conversionRate(selectedLink.clicks ?? 0, selectedLink.conversions ?? 0)})
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                Subscribers
              </div>
              <div className="text-lg font-bold mt-0.5">{selectedLink.subscribers ?? 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Revenue
              </div>
              <div className="text-lg font-bold mt-0.5 text-emerald-400">
                {selectedLink.revenue ? formatCurrency(selectedLink.revenue) : "$0.00"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users list */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Users from this link</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingUsers ? (
              <div className="py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/30 items-center">
                    <div className="col-span-3 flex items-center gap-2">
                      <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-2.5 w-14" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-8 mx-auto col-span-2" />
                    <Skeleton className="h-4 w-8 mx-auto col-span-2" />
                    <Skeleton className="h-4 w-12 mx-auto col-span-2" />
                    <Skeleton className="h-3 w-16 ml-auto col-span-3" />
                  </div>
                ))}
              </div>
            ) : linkUsers.length === 0 ? (
              <EmptyState size="compact" icon={Users} title="No users yet" description="Users will appear here once they click this link" />
            ) : (
              <div>
                {/* Table header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground border-b border-border/50 font-medium">
                  <div className="col-span-3">User</div>
                  <div className="col-span-2 text-center">Clicks</div>
                  <div className="col-span-2 text-center">Converted</div>
                  <div className="col-span-2 text-center">Spent</div>
                  <div className="col-span-3 text-right">Last Visit</div>
                </div>
                {/* User rows */}
                {linkUsers.map((user) => (
                  <div
                    key={user.id}
                    className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0 items-center"
                  >
                    {/* User info */}
                    <div className="col-span-3 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Users className="w-3 h-3 text-primary/60" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{user.displayName || user.username || user.id}</p>
                          {user.source && (
                            <span className="text-[10px] text-muted-foreground">{user.source}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Clicks */}
                    <div className="col-span-2 text-center">
                      <span className="text-sm">{user.clicks ?? 0}</span>
                    </div>
                    {/* Converted */}
                    <div className="col-span-2 text-center">
                      {user.converted ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          <Check className="w-2.5 h-2.5 mr-0.5" />
                          {user.subscribed ? "Sub" : "Yes"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </div>
                    {/* Spent */}
                    <div className="col-span-2 text-center">
                      <span className={`text-sm ${(user.spent ?? 0) > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {user.spent ? formatCurrency(user.spent) : "---"}
                      </span>
                    </div>
                    {/* Last visit */}
                    <div className="col-span-3 text-right">
                      <span className="text-xs text-muted-foreground">
                        {user.lastVisitAt ? timeAgo(user.lastVisitAt) : "---"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Overview (main view) ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" />
            Tracking Links
          </h1>
          <p className="text-muted-foreground text-sm">
            Track clicks, conversions, and revenue from your social media links
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Link
        </Button>
      </div>

      {/* Stats bar */}
      {!loadingLinks && links.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" />
                Total Clicks
              </div>
              <div className="text-lg font-bold mt-0.5">{totalClicks.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Conversions
              </div>
              <div className="text-lg font-bold mt-0.5">
                {totalConversions}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({conversionRate(totalClicks, totalConversions)})
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Revenue
              </div>
              <div className="text-lg font-bold mt-0.5 text-emerald-400">
                {formatCurrency(totalRevenue)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                Subscribers
              </div>
              <div className="text-lg font-bold mt-0.5">{totalSubscribers}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <Card className="bg-card/50 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create Tracking Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">Link Name *</Label>
              <Input
                value={newLinkName}
                onChange={(e) => setNewLinkName(e.target.value)}
                placeholder="e.g. Instagram Bio, Twitter Link..."
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newLinkName.trim() && newLinkDestination.trim()) handleCreateLink();
                }}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Destination URL *</Label>
              <Input
                value={newLinkDestination}
                onChange={(e) => setNewLinkDestination(e.target.value)}
                placeholder="https://fanvue.com/your-profile"
                type="url"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Source (optional)</Label>
              <Input
                value={newLinkSource}
                onChange={(e) => setNewLinkSource(e.target.value)}
                placeholder="e.g. instagram, twitter, tiktok..."
                maxLength={50}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreateForm(false); setNewLinkName(""); setNewLinkDestination(""); setNewLinkSource(""); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateLink} disabled={!newLinkName.trim() || !newLinkDestination.trim() || creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Create Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search links by name, source, or URL..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Links table */}
      {loadingLinks ? (
        <div className="bg-card/50 border border-border/50 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/50 bg-muted/30">
            <div className="grid grid-cols-12 gap-2">
              <Skeleton className="h-3 w-12 col-span-3" />
              <Skeleton className="h-3 w-12 mx-auto col-span-2" />
              <Skeleton className="h-3 w-16 mx-auto col-span-2" />
              <Skeleton className="h-3 w-12 mx-auto col-span-2" />
              <Skeleton className="h-3 w-8 mx-auto col-span-1" />
              <Skeleton className="h-3 w-12 ml-auto col-span-2" />
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/30 items-center">
              <div className="col-span-3 flex items-center gap-2 min-w-0">
                <Skeleton className="w-5 h-5 rounded flex-shrink-0" />
                <div className="min-w-0 space-y-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-2.5 w-2/3" />
                </div>
              </div>
              <Skeleton className="h-4 w-8 mx-auto col-span-2" />
              <Skeleton className="h-4 w-10 mx-auto col-span-2" />
              <Skeleton className="h-4 w-14 mx-auto col-span-2" />
              <Skeleton className="h-4 w-6 mx-auto col-span-1" />
              <Skeleton className="h-8 w-16 rounded ml-auto col-span-2" />
            </div>
          ))}
        </div>
      ) : filteredLinks.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-8">
            <EmptyState
              icon={Link2}
              title={searchQuery ? "No matching links" : "No tracking links yet"}
              description={searchQuery ? "Try adjusting your search" : "Create your first tracking link to measure conversions from social media"}
              actionLabel={!searchQuery ? "Create Link" : undefined}
              onAction={!searchQuery ? () => setShowCreateForm(true) : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          <CardContent className="p-0">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-xs text-muted-foreground border-b border-border/50 font-medium bg-muted/30">
              <div className="col-span-3">Link</div>
              <div className="col-span-2 text-center">Clicks</div>
              <div className="col-span-2 text-center">Conversions</div>
              <div className="col-span-2 text-center">Revenue</div>
              <div className="col-span-1 text-center">Subs</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
            {/* Link rows */}
            {filteredLinks.map((link) => (
              <div key={link.id}>
                <div className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 items-center group">
                  {/* Link info */}
                  <div className="col-span-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate cursor-pointer hover:text-primary" onClick={() => handleSelectLink(link.id)}>
                          {link.name || link.slug || link.id}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {link.source && (
                            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${SOURCE_COLORS[link.source] || ""}`}>
                              {link.source}
                            </Badge>
                          )}
                          {link.isActive !== false && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Clicks */}
                  <div className="col-span-2 text-center">
                    <span className="text-sm font-medium">{(link.clicks ?? 0).toLocaleString()}</span>
                  </div>
                  {/* Conversions */}
                  <div className="col-span-2 text-center">
                    <span className="text-sm">
                      {link.conversions ?? 0}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">
                      ({conversionRate(link.clicks ?? 0, link.conversions ?? 0)})
                    </span>
                  </div>
                  {/* Revenue */}
                  <div className="col-span-2 text-center">
                    <span className="text-sm text-emerald-400">
                      {link.revenue ? formatCurrency(link.revenue) : "---"}
                    </span>
                  </div>
                  {/* Subscribers */}
                  <div className="col-span-1 text-center">
                    <span className="text-sm">{link.subscribers ?? 0}</span>
                  </div>
                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => handleCopyLink(link.url || link.destination || `https://fanvue.com/track/${link.slug || link.id}`)}
                      title="Copy link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => handleSelectLink(link.id)}
                      title="View users"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setConfirmDeleteId(link.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Delete confirmation */}
                {confirmDeleteId === link.id && (
                  <div className="border-t border-destructive/30 bg-destructive/5 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="text-sm text-destructive">Delete &quot;{link.name || link.id}&quot;?</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)} className="text-xs h-7">
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteLink(link.id)}
                        disabled={deleting === link.id}
                        className="text-xs h-7"
                      >
                        {deleting === link.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {!loadingLinks && links.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{links.length} tracking link{links.length !== 1 ? "s" : ""}</span>
              <span>
                {totalClicks.toLocaleString()} total clicks &middot; {conversionRate(totalClicks, totalConversions)} conversion rate
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Link2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">About Tracking Links</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tracking links let you measure how effectively your social media profiles drive traffic to your Fanvue page.
              Each link is attributed to a source platform (Instagram, Twitter, TikTok, etc.) so you can see which channels
              generate the most clicks, conversions, and revenue. Use these insights to optimize your social media strategy
              and focus effort on your highest-performing platforms.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
