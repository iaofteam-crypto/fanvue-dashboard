"use client";

import { Skeleton } from "@/components/ui/skeleton";

// ─── Generic Section Skeleton (used in dynamic imports) ───────────────────────

export function SectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-28 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

// ─── Dashboard Overview Skeleton ──────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4">
            <div className="flex items-center justify-between pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-7 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Activity + Subscriber Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border border-border/50 bg-card/50 p-4">
          <Skeleton className="h-5 w-32 mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-border/30 last:border-0">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border/50 bg-card/50 p-4">
          <Skeleton className="h-5 w-36 mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Skeleton ───────────────────────────────────────────────────────

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-28 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-3">
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-6 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-64 w-full rounded" />
      </div>

      {/* Secondary chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/50 bg-card/50 p-4">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-48 w-full rounded" />
        </div>
        <div className="rounded-lg border border-border/50 bg-card/50 p-4">
          <Skeleton className="h-4 w-28 mb-4" />
          <Skeleton className="h-48 w-full rounded" />
        </div>
      </div>
    </div>
  );
}

// ─── Messages / Chat List Skeleton ────────────────────────────────────────────

export function ChatListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-1 animate-pulse">
      {/* Search bar */}
      <div className="p-3 border-b border-border/50">
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-border/30">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-12 flex-shrink-0" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── Chat Messages Skeleton ───────────────────────────────────────────────────

export function ChatMessagesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => {
        const isRight = i % 2 === 1;
        return (
          <div key={i} className={`flex ${isRight ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] ${isRight ? "order-1" : ""}`}>
              <Skeleton className={`h-4 w-${20 + (i * 7) % 20} mb-1 rounded-lg`} />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Content / Posts Grid Skeleton ────────────────────────────────────────────

export function PostsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-28 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
            {/* Image placeholder */}
            <Skeleton className="h-40 w-full" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex items-center gap-4 pt-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-8 ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Fan Insights Skeleton ───────────────────────────────────────────────────

export function FanInsightsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-7 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Spender list */}
      <div className="rounded-lg border border-border/50 bg-card/50">
        <div className="p-4 border-b border-border/50">
          <Skeleton className="h-5 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0">
            <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-20 text-right flex-shrink-0" />
            <Skeleton className="h-3 w-14 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bulk Fan Insights Table Skeleton ─────────────────────────────────────────

export function BulkInsightsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-36 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-3">
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
        <Skeleton className="h-8 w-48 rounded-md ml-auto" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-16 col-span-2" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-border/30 last:border-0">
            <Skeleton className="h-4 w-5 rounded-full" />
            <div className="col-span-2 flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-6 w-10 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Smart Lists / Cards Grid Skeleton ────────────────────────────────────────

export function CardsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-3">
            <Skeleton className="h-3 w-20 mb-1" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-5 w-28 mb-1" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-6 w-8 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Table Skeleton (generic) ─────────────────────────────────────────────────

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-3">
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-6 w-14" />
          </div>
        ))}
      </div>

      {/* Search */}
      <Skeleton className="h-9 w-64 rounded-md" />

      {/* Table */}
      <div className="rounded-lg border border-border/50 bg-card/50 overflow-x-auto">
        {/* Header */}
        <div className="flex gap-4 px-4 py-3 border-b border-border/50 min-w-[600px]">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0 min-w-[600px]">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Simple Content Skeleton (for lightweight sections) ────────────────────────

export function SimpleContentSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <Skeleton className="h-48 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Detail View Skeleton ─────────────────────────────────────────────────────

export function DetailViewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-7 w-40" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-card/50 p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-4">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-32 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
