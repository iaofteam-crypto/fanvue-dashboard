"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Filter, Tag, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Loader2 } from "lucide-react";

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

const DEMO_DISCOVERIES: Discovery[] = [
  { id: "d1", refId: "D1", title: "AI Content Generation Opportunity", category: "Technology", tags: "AI, Content", status: "new", createdAt: "2024-01-15" },
  { id: "d2", refId: "D2", title: "Cross-Platform Engagement Strategy", category: "Marketing", tags: "Social, Growth", status: "new", createdAt: "2024-01-16" },
  { id: "d3", refId: "D3", title: "Premium Tier Pricing Analysis", category: "Revenue", tags: "Pricing, Analytics", status: "reviewed", createdAt: "2024-01-17" },
  { id: "d4", refId: "D4", title: "Fan Community Building Framework", category: "Community", tags: "Engagement, Fans", status: "new", createdAt: "2024-01-18" },
  { id: "d5", refId: "D5", title: "Content Calendar Optimization", category: "Operations", tags: "Scheduling, Content", status: "implemented", createdAt: "2024-01-19" },
  { id: "d6", refId: "D6", title: "Video Content Monetization Path", category: "Revenue", tags: "Video, Monetization", status: "new", createdAt: "2024-01-20" },
  { id: "d7", refId: "D7", title: "Direct Message Automation Rules", category: "Technology", tags: "AI, DMs", status: "new", createdAt: "2024-01-21" },
  { id: "d8", refId: "D8", title: "Referral Program Design", category: "Growth", tags: "Referral, Growth", status: "reviewed", createdAt: "2024-01-22" },
  { id: "d9", refId: "D9", title: "Exclusive Content Tier Strategy", category: "Content", tags: "Exclusive, Tiers", status: "new", createdAt: "2024-01-23" },
  { id: "d10", refId: "D10", title: "Seasonal Content Themes", category: "Content", tags: "Seasonal, Planning", status: "new", createdAt: "2024-01-24" },
  { id: "d11", refId: "D11", title: "Analytics Dashboard Integration", category: "Technology", tags: "Analytics, Dashboard", status: "implemented", createdAt: "2024-01-25" },
  { id: "d12", refId: "D12", title: "Subscriber Churn Prevention", category: "Retention", tags: "Churn, Subscribers", status: "reviewed", createdAt: "2024-01-26" },
];

export function DiscoveriesSection() {
  const [discoveries, setDiscoveries] = useState<Discovery[]>(DEMO_DISCOVERIES);
  const [loading] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  const statusColor = (status: string) => {
    switch (status) {
      case "implemented": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "reviewed": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discoveries</h1>
        <p className="text-muted-foreground text-sm">
          Explore insights and opportunities from handoff analysis
        </p>
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
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(100vh-22rem)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
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
                  {filteredDiscoveries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        No discoveries found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDiscoveries.map((discovery) => (
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
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
