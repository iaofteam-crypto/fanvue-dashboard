"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Loader2,
  ArrowLeft,
  Search,
  ChevronRight,
  UserCheck,
  UserX,
  TrendingUp,
  Star,
  Crown,
  Eye,
  Mail,
  RefreshCw,
  ListFilter,
  DollarSign,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";

// --- Types ---

interface SmartList {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ListMember {
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt?: string;
  spentTotal?: number;
  messageCount?: number;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  lastActiveAt?: string;
  isSubscriber?: boolean;
  engagementScore?: number;
}

interface ListMembersResponse {
  members?: ListMember[];
  data?: ListMember[];
  total?: number;
  page?: number;
  size?: number;
  totalPages?: number;
}

// --- Constants ---

const BUILT_IN_SMART_LISTS: Array<{
  id: string;
  name: string;
  description: string;
  icon: typeof Users;
  color: string;
  bgColor: string;
}> = [
  {
    id: "all_fans",
    name: "All Fans",
    description: "Everyone who follows you across all tiers",
    icon: Users,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "subscribers",
    name: "Active Subscribers",
    description: "Users with currently active paid subscriptions",
    icon: Crown,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    id: "expired_subscribers",
    name: "Expired Subscribers",
    description: "Users whose subscriptions have lapsed — re-engagement targets",
    icon: UserX,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
  },
  {
    id: "top_spenders",
    name: "Top Spenders",
    description: "Your highest revenue-generating fans by total spend",
    icon: Star,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
];

// --- Helpers ---

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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
  if (diffDay < 30) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 30)}mo ago`;
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

// --- Component ---

export function SmartListsSection({ connected }: { connected: boolean }) {
  // View state
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Data state
  const [smartLists, setSmartLists] = useState<SmartList[]>([]);
  const [members, setMembers] = useState<ListMember[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Loading state
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingMembers, setLodingMembers] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "spent" | "recent" | "engagement">("name");

  const PAGE_SIZE = 20;

  // --- Fetch smart lists ---

  const fetchSmartLists = useCallback(async () => {
    if (!connected) return;
    setLoadingLists(true);
    try {
      const res = await fetch("/api/fanvue/chats/lists/smart");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data || data?.lists || [];
        if (list.length > 0) {
          setSmartLists(list);
        } else {
          setSmartLists(
            BUILT_IN_SMART_LISTS.map((sl) => ({
              id: sl.id,
              name: sl.name,
              description: sl.description,
            }))
          );
        }
        return;
      }
    } catch {
      // fall through to fallback
    }
    setSmartLists(
      BUILT_IN_SMART_LISTS.map((sl) => ({
        id: sl.id,
        name: sl.name,
        description: sl.description,
      }))
    );
    setLoadingLists(false);
  }, [connected]);

  // --- Fetch list members ---

  const fetchMembers = useCallback(
    async (listId: string, page: number) => {
      setLodingMembers(true);
      try {
        const res = await fetch(
          `/api/fanvue/chats/lists/smart/${listId}?page=${page}&size=${PAGE_SIZE}`
        );
        if (res.ok) {
          const data = (await res.json()) as ListMembersResponse;
          const memberList = Array.isArray(data)
            ? data
            : data?.members || data?.data || [];
          setMembers(memberList);
          setTotalMembers(data?.total ?? memberList.length);
          setTotalPages(data?.totalPages ?? Math.ceil((data?.total ?? memberList.length) / PAGE_SIZE));
          setCurrentPage(page);
          setLodingMembers(false);
          return;
        }
      } catch {
        // fall through to demo
      }
      // Demo data fallback
      const demoMembers = generateDemoMembers(listId, page);
      setMembers(demoMembers.members);
      setTotalMembers(demoMembers.total);
      setTotalPages(Math.ceil(demoMembers.total / PAGE_SIZE));
      setCurrentPage(page);
      setLodingMembers(false);
    },
    []
  );

  useEffect(() => {
    fetchSmartLists();
  }, [fetchSmartLists]);

  const handleSelectList = (listId: string) => {
    setSelectedListId(listId);
    fetchMembers(listId, 1);
  };

  const handleBack = () => {
    setSelectedListId(null);
    setMembers([]);
    setTotalMembers(0);
    setCurrentPage(1);
    setTotalPages(1);
  };

  const handlePageChange = (page: number) => {
    if (selectedListId) {
      fetchMembers(selectedListId, page);
    }
  };

  const handleRefresh = () => {
    if (selectedListId) {
      fetchMembers(selectedListId, currentPage);
    } else {
      fetchSmartLists();
    }
  };

  // --- Get list metadata ---

  const getListMeta = (listId: string) => {
    return BUILT_IN_SMART_LISTS.find((sl) => sl.id === listId);
  };

  const selectedList = selectedListId
    ? smartLists.find((sl) => sl.id === selectedListId)
    : null;
  const selectedMeta = selectedListId ? getListMeta(selectedListId) : null;

  // --- Sort members ---

  const sortedMembers = [...members].sort((a, b) => {
    switch (sortBy) {
      case "spent":
        return ((b.spentTotal ?? 0) - (a.spentTotal ?? 0));
      case "recent":
        return new Date(b.lastActiveAt || "1970-01-01").getTime() - new Date(a.lastActiveAt || "1970-01-01").getTime();
      case "engagement":
        return ((b.engagementScore ?? 0) - (a.engagementScore ?? 0));
      default:
        return (a.displayName || a.username || "").localeCompare(b.displayName || b.username || "");
    }
  });

  const filteredMembers = sortedMembers.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (m.displayName || "").toLowerCase().includes(q) ||
      (m.username || "").toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  });

  // --- Disconnected state ---

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Smart Lists unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to view smart lists</p>
      </div>
    );
  }

  // --- Member detail view ---

  if (selectedListId && selectedList) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            {selectedMeta && (
              <div className={`w-9 h-9 rounded-lg ${selectedMeta.bgColor} flex items-center justify-center`}>
                <selectedMeta.icon className={`w-4 h-4 ${selectedMeta.color}`} />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold">{selectedList.name}</h2>
              <p className="text-xs text-muted-foreground">
                {selectedList.description || selectedMeta?.description}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loadingMembers}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingMembers ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{totalMembers}</p>
                <p className="text-xs text-muted-foreground">Total Members</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold">
                  {members.reduce((sum, m) => sum + (m.spentTotal ?? 0), 0) > 0
                    ? formatCurrency(
                        members.reduce((sum, m) => sum + (m.spentTotal ?? 0), 0)
                      )
                    : "---"}
                </p>
                <p className="text-xs text-muted-foreground">Page Total Spend</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold">
                  {members.filter((m) => m.isSubscriber || m.subscriptionStatus === "active").length}
                </p>
                <p className="text-xs text-muted-foreground">Active Subs (page)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-bold">
                  {members.length > 0
                    ? Math.round(
                        members.reduce((sum, m) => sum + (m.engagementScore ?? 50), 0) / members.length
                      )
                    : 0}
                </p>
                <p className="text-xs text-muted-foreground">Avg. Engagement</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + Sort */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            {(
              [
                { id: "name" as const, label: "Name" },
                { id: "spent" as const, label: "Spent" },
                { id: "recent" as const, label: "Recent" },
                { id: "engagement" as const, label: "Score" },
              ] as const
            ).map((opt) => (
              <Button
                key={opt.id}
                variant={sortBy === opt.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(opt.id)}
                className="text-xs h-8"
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Members list */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-0">
            <ScrollArea className="max-h-[calc(100vh-18rem)]">
              {loadingMembers ? (
                <div className="space-y-1 p-4 animate-pulse">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-3 border-b border-border/30">
                      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-1" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  ))}
                </div>
              ) : filteredMembers.length === 0 ? (
                <EmptyState
                  size="compact"
                  icon={Users}
                  title="No members found"
                  description={searchQuery ? "Try adjusting your search" : "This list may be empty"}
                />
              ) : (
                <div>
                  {filteredMembers.map((member, idx) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0"
                    >
                      {/* Rank badge for top spenders */}
                      {sortBy === "spent" && idx < 3 && (
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            idx === 0
                              ? "bg-amber-500/20 text-amber-400"
                              : idx === 1
                              ? "bg-muted-foreground/20 text-muted-foreground"
                              : "bg-orange-700/20 text-orange-600"
                          }`}
                        >
                          {idx + 1}
                        </div>
                      )}

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <UserCheck className="w-4 h-4 text-primary/60" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {member.displayName || member.username || member.id}
                          </p>
                          {member.isSubscriber || member.subscriptionStatus === "active" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20"
                            >
                              <Crown className="w-2.5 h-2.5 mr-0.5" />
                              {member.subscriptionTier || "Sub"}
                            </Badge>
                          ) : member.subscriptionStatus === "expired" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-400 border-orange-500/20"
                            >
                              Expired
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {member.messageCount != null && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {member.messageCount} msgs
                            </span>
                          )}
                          {member.spentTotal != null && member.spentTotal > 0 && (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(member.spentTotal)}
                            </span>
                          )}
                          {member.lastActiveAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(member.lastActiveAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Engagement bar */}
                      {member.engagementScore != null && (
                        <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0 w-24">
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                member.engagementScore >= 80
                                  ? "bg-emerald-400"
                                  : member.engagementScore >= 50
                                  ? "bg-amber-400"
                                  : "bg-red-400"
                              }`}
                              style={{ width: `${member.engagementScore}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {member.engagementScore}
          </span>
                        </div>
                      )}

                      {/* Action */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary flex-shrink-0"
                        onClick={() => {
                          // Navigate to messages section for this fan (future: pass fanId to messages)
                          toast.info(`Opening chat with ${member.displayName || member.username || member.id}`);
                        }}
                        title="Send message"
                      >
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalMembers} total members)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || loadingMembers}
                className="text-xs h-8"
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                if (pageNum < 1 || pageNum > totalPages) return null;
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={loadingMembers}
                    className="text-xs h-8 w-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || loadingMembers}
                className="text-xs h-8"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- List overview ---

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Smart Lists</h1>
          <p className="text-muted-foreground text-sm">
            Auto-curated fan segments based on engagement and spending
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loadingLists}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingLists ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Info banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <ListFilter className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Automatically maintained by Fanvue</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Smart lists are dynamically updated based on fan activity. You cannot manually add or remove members.
              Use Custom Lists for manual segmentation.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* List grid */}
      {loadingLists ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-28 mb-1" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BUILT_IN_SMART_LISTS.map((builtIn) => {
            const apiList = smartLists.find((sl) => sl.id === builtIn.id);
            const memberCount = apiList?.memberCount ?? null;

            return (
              <Card
                key={builtIn.id}
                className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors cursor-pointer group"
                onClick={() => handleSelectList(builtIn.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl ${builtIn.bgColor} flex items-center justify-center flex-shrink-0`}
                    >
                      <builtIn.icon className={`w-5 h-5 ${builtIn.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">{builtIn.name}</h3>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {apiList?.description || builtIn.description}
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          {memberCount != null ? `${memberCount} fans` : "View members"}
                        </div>
                        {memberCount != null && (
                          <Badge variant="secondary" className="text-[10px]">
                            Auto
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick insights */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Quick Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Total Fans</p>
              <p className="text-xl font-bold mt-1">
                {smartLists.find((s) => s.id === "all_fans")?.memberCount ?? "---"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Active Subscribers</p>
              <p className="text-xl font-bold mt-1">
                {smartLists.find((s) => s.id === "subscribers")?.memberCount ?? "---"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Expired Subscribers</p>
              <p className="text-xl font-bold mt-1">
                {smartLists.find((s) => s.id === "expired_subscribers")?.memberCount ?? "---"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">Top Spenders</p>
              <p className="text-xl font-bold mt-1">
                {smartLists.find((s) => s.id === "top_spenders")?.memberCount ?? "---"}
              </p>
            </div>
          </div>
          {smartLists.length > 0 && smartLists[0]?.memberCount != null && (
            <p className="text-xs text-muted-foreground mt-3">
              Click any list above to browse its members, sort by spend or engagement, and view detailed fan profiles.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Demo data generator ---

function generateDemoMembers(
  listId: string,
  page: number
): { members: ListMember[]; total: number } {
  const names = [
    "Alex Johnson", "Sarah Mitchell", "Mike Davis", "Jordan Kim", "Chris Park",
    "Emma Wilson", "Ryan Martinez", "Taylor Brown", "Jamie Lee", "Casey Morgan",
    "Quinn Taylor", "Avery Thomas", "Blake Anderson", "Reese Garcia", "Dakota Moore",
    "Cameron Rivera", "Skyler Chen", "Finley Patel", "Rowan Stewart", "Hayden Young",
  ];

  const total = listId === "all_fans" ? 1247 : listId === "subscribers" ? 389 : listId === "expired_subscribers" ? 156 : 42;
  const pageMembers: ListMember[] = names.slice((page - 1) * 20, page * 20).map((name, i) => {
    const idx = (page - 1) * 20 + i;
    const isSub = listId === "subscribers" || (listId === "all_fans" && Math.random() > 0.6);
    const isTop = listId === "top_spenders";
    const spent = isTop
      ? Math.floor(Math.random() * 50000) + 2000
      : Math.floor(Math.random() * 5000) + 100;
    const daysAgo = Math.floor(Math.random() * 60);
    const hoursAgo = Math.floor(Math.random() * 24);

    return {
      id: `fan-${idx + 1}`,
      displayName: name,
      username: name.toLowerCase().replace(" ", ".").slice(0, 12),
      isSubscriber: isSub,
      subscriptionStatus: isSub ? "active" : Math.random() > 0.8 ? "expired" : "none",
      subscriptionTier: isSub
        ? Math.random() > 0.7
          ? "VIP"
          : "Standard"
        : undefined,
      spentTotal: spent,
      messageCount: Math.floor(Math.random() * 200) + 5,
      lastActiveAt: new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000).toISOString(),
      joinedAt: new Date(Date.now() - Math.floor(Math.random() * 365) * 86400000).toISOString(),
      engagementScore: Math.floor(Math.random() * 100) + 1,
    };
  });

  return {
    members: pageMembers,
    total,
  };
}
