"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Filter, Tag, Hash, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/dashboard/section-skeletons";
import { EmptyState } from "@/components/dashboard/empty-state";

interface Discovery {
  id: string;
  refId: string;
  title: string;
  category: string;
  tags?: string;
  summary?: string;
  status: string;
  createdAt: string;
}

// Fallback demo data
const DEMO_DISCOVERIES: Discovery[] = [
  { id: "d1", refId: "D1", title: "AI Content Generation Opportunity", category: "Technology", tags: "AI, Content", status: "new", createdAt: "2024-01-15" },
  { id: "d2", refId: "D2", title: "Cross-Platform Engagement Strategy", category: "Marketing", tags: "Social, Growth", status: "new", createdAt: "2024-01-16" },
  { id: "d3", refId: "D3", title: "Premium Tier Pricing Analysis", category: "Revenue", tags: "Pricing, Analytics", status: "reviewed", createdAt: "2024-01-17" },
  { id: "d4", refId: "D4", title: "Fan Community Building Framework", category: "Community", tags: "Engagement, Fans", status: "new", createdAt: "2024-01-18" },
  { id: "d5", refId: "D5", title: "Content Calendar Optimization", category: "Operations", tags: "Scheduling, Content", status: "implemented", createdAt: "2024-01-19" },
];

export function DiscoveriesSection() {
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [hasRealData, setHasRealData] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchDiscoveries = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sync-data");
      const result = await res.json();

      // Check if we have synced discovery data or data we can derive
      const syncedKeys = result.keys || [];

      // Check for discoveries in the sync data
      if (syncedKeys.length > 0) {
        // Try to derive discoveries from available data
        const derived: Discovery[] = [];

        // From posts
        const posts = result.data?.posts?.data;
        if (Array.isArray(posts)) {
          posts.slice(0, 5).forEach((p: Record<string, unknown>, i: number) => {
            derived.push({
              id: `post_${i}`,
              refId: `P${i + 1}`,
              title: (p.title as string) || (p.type as string) || `Post #${i + 1}`,
              category: "Content",
              tags: "post",
              status: "published",
              createdAt: (p.createdAt as string) || new Date().toISOString().split("T")[0],
            });
          });
        }

        // From chats (show as engagement insights)
        const chats = result.data?.chats?.data;
        if (Array.isArray(chats)) {
          derived.push({
            id: "chat_insight",
            refId: "C1",
            title: `${chats.length} fan conversations tracked`,
            category: "Engagement",
            tags: "chats, engagement",
            status: "new",
            createdAt: new Date().toISOString().split("T")[0],
          });
        }

        // From earnings
        const earnings = result.data?.earnings?.data || result.data?.earnings_summary?.data;
        if (earnings) {
          const total = Array.isArray(earnings)
            ? earnings.reduce((sum: number, e: Record<string, unknown>) => sum + Number(e.total || e.amount || 0), 0)
            : Number((earnings as Record<string, unknown>)?.total || 0);
          if (total > 0) {
            derived.push({
              id: "earnings_insight",
              refId: "E1",
              title: `Total earnings data available: $${total.toLocaleString()}`,
              category: "Revenue",
              tags: "earnings, analytics",
              status: "new",
              createdAt: new Date().toISOString().split("T")[0],
            });
          }
        }

        if (derived.length > 0) {
          setDiscoveries(derived);
          setHasRealData(true);
        } else {
          setDiscoveries(DEMO_DISCOVERIES);
          setHasRealData(false);
        }
      } else {
        setDiscoveries(DEMO_DISCOVERIES);
        setHasRealData(false);
      }
    } catch {
      toast.error("Failed to load discoveries");
      setDiscoveries(DEMO_DISCOVERIES);
      setHasRealData(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscoveries();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(discoveries.map((d) => d.category));
    return Array.from(cats);
  }, [discoveries]);

  const filteredDiscoveries = useMemo(() => {
    return discoveries.filter((d) => {
      const matchesSearch =
        search === "" ||
        d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.refId.toLowerCase().includes(search.toLowerCase()) ||
        (d.tags && d.tags.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory =
        categoryFilter === "all" || d.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [discoveries, search, categoryFilter]);

  // A6: Pagination
  const totalPages = Math.ceil(filteredDiscoveries.length / PAGE_SIZE);
  const paginatedDiscoveries = filteredDiscoveries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, categoryFilter]);

  const statusColor = (status: string) => {
    switch (status) {
      case "implemented":
      case "published":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "reviewed":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discoveries</h1>
          <p className="text-muted-foreground text-sm">
            {hasRealData
              ? "Insights derived from your synced Fanvue data"
              : "Explore insights and opportunities from handoff analysis"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDiscoveries} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search discoveries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline" className="text-xs">
              {filteredDiscoveries.length} of {discoveries.length} discoveries
            </Badge>
            {!hasRealData && (
              <Badge variant="outline" className="text-xs text-amber-400">
                Demo data
              </Badge>
            )}
            {totalPages > 1 && (
              <Badge variant="outline" className="text-xs ml-auto">
                Page {page} of {totalPages}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(100vh-22rem)]">
            {loading ? (
              <div className="animate-pulse p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-4 py-3 border-b border-border/30">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : filteredDiscoveries.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No discoveries found"
                description="Discoveries will appear as you interact with fans"
              />
            ) : (
              <div className="overflow-x-auto -mx-4 px-4">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-[80px]">Ref</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead className="hidden md:table-cell">Tags</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDiscoveries.map((discovery) => (
                      <TableRow
                        key={discovery.id}
                        className="border-border/30 hover:bg-muted/30 cursor-pointer"
                      >
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Hash className="w-3 h-3 text-muted-foreground" />
                            <span className="font-mono text-xs text-primary">
                              {discovery.refId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{discovery.title}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {discovery.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1 flex-wrap">
                            {discovery.tags?.split(", ").map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs px-1.5 py-0"
                              >
                                <Tag className="w-2.5 h-2.5 mr-0.5" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusColor(discovery.status)}`}
                          >
                            {discovery.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              </div>
            )}
          </ScrollArea>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredDiscoveries.length)} of {filteredDiscoveries.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, i, arr) => (
                    <span key={p} className="flex items-center">
                      {i > 0 && arr[i - 1] !== p - 1 && (
                        <span className="text-xs text-muted-foreground px-1">...</span>
                      )}
                      <Button
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    </span>
                  ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
