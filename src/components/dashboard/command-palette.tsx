"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  FileText,
  ListTodo,
  Bot,
  FolderOpen,
  Link2,
  Users,
  Megaphone,
  ListFilter,
  Vault,
  UsersRound,
  FlaskConical,
  CalendarClock,
  BookTemplate,
  GitCompareArrows,
  CornerDownLeft,
  Shield,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

type Section =
  | "dashboard"
  | "analytics"
  | "messages"
  | "content"
  | "discoveries"
  | "tasks"
  | "aeliana"
  | "repo"
  | "connection"
  | "insights"
  | "mass-messaging"
  | "smart-lists"
  | "custom-lists"
  | "vault"
  | "tracking"
  | "bulk-insights"
  | "ab-testing"
  | "scheduled"
  | "templates"
  | "advanced-analytics"
  | "integrations";

const NAV_ITEMS: { id: Section; label: string; icon: typeof LayoutDashboard; keywords?: string[] }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: ["home", "overview", "stats"] },
  { id: "analytics", label: "Analytics", icon: BarChart3, keywords: ["earnings", "revenue", "charts", "metrics"] },
  { id: "messages", label: "Messages", icon: MessageSquare, keywords: ["chat", "inbox", "dm", "conversations"] },
  { id: "content", label: "Content", icon: FileText, keywords: ["posts", "media", "photos", "videos"] },
  { id: "insights", label: "Fan Insights", icon: Users, keywords: ["spenders", "fans", "top", "ranking"] },
  { id: "mass-messaging", label: "Mass Message", icon: Megaphone, keywords: ["broadcast", "bulk", "send all"] },
  { id: "smart-lists", label: "Smart Lists", icon: ListFilter, keywords: ["auto", "segments", "filters"] },
  { id: "custom-lists", label: "Custom Lists", icon: FolderOpen, keywords: ["lists", "groups", "manual"] },
  { id: "vault", label: "Vault", icon: Vault, keywords: ["folders", "storage", "media library"] },
  { id: "tracking", label: "Tracking Links", icon: Link2, keywords: ["links", "urls", "affiliates", "clicks"] },
  { id: "bulk-insights", label: "Bulk Insights", icon: UsersRound, keywords: ["fans table", "all fans", "spreadsheet"] },
  { id: "ab-testing", label: "A/B Testing", icon: FlaskConical, keywords: ["experiments", "split test", "variants"] },
  { id: "advanced-analytics", label: "Adv. Analytics", icon: GitCompareArrows, keywords: ["advanced", "forecast", "heat map", "funnel"] },
  { id: "scheduled", label: "Scheduled Posts", icon: CalendarClock, keywords: ["queue", "calendar", "automation", "schedule"] },
  { id: "templates", label: "Chat Templates", icon: BookTemplate, keywords: ["replies", "canned", "quick", "macros"] },
  { id: "discoveries", label: "Discoveries", icon: Search, keywords: ["explore", "trending", "recommendations"] },
  { id: "tasks", label: "Tasks", icon: ListTodo, keywords: ["todo", "checklist", "reminders"] },
  { id: "aeliana", label: "AELIANA AI", icon: Bot, keywords: ["ai", "assistant", "chatbot", "help"] },
  { id: "repo", label: "Repo Browser", icon: FolderOpen, keywords: ["github", "code", "files"] },
  { id: "connection", label: "Connection", icon: Link2, keywords: ["settings", "connect", "disconnect", "auth"] },
  { id: "integrations", label: "Security", icon: Shield, keywords: ["security", "integrations", "api key", "webhook", "csp", "audit", "rate limit"] },
];

function scoreItem(query: string, item: typeof NAV_ITEMS[number]): number {
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  const kw = (item.keywords || []).join(" ").toLowerCase();

  // Exact match on label
  if (label === q) return 100;
  // Label starts with query
  if (label.startsWith(q)) return 80;
  // Any keyword starts with query
  if (kw.split(" ").some((k) => k.startsWith(q))) return 60;
  // Label contains query
  if (label.includes(q)) return 40;
  // Keywords contain query
  if (kw.includes(q)) return 20;
  return 0;
}

interface CommandPaletteProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
}

export const CommandPalette = React.memo(function CommandPalette({ activeSection, onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredItems = query.trim()
    ? NAV_ITEMS
        .map((item) => ({ item, score: scoreItem(query, item) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item)
    : NAV_ITEMS;

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Register Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      // Small delay to let the dialog render
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    if (!open || filteredItems.length === 0) return;
    const listEl = listRef.current;
    if (!listEl) return;
    const selectedEl = listEl.children[selectedIndex] as HTMLElement | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, open, filteredItems.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (filteredItems.length > 0) {
            setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (filteredItems.length > 0) {
            setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
          }
          break;
        case "Enter":
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            onNavigate(filteredItems[selectedIndex].id);
            setOpen(false);
            setQuery("");
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          setQuery("");
          break;
      }
    },
    [filteredItems, selectedIndex, onNavigate]
  );

  const handleSelect = useCallback(
    (section: Section) => {
      onNavigate(section);
      setOpen(false);
      setQuery("");
    },
    [onNavigate]
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) { setQuery(""); } }}>
      <DialogContent className="p-0 gap-0 max-w-lg bg-card border-border sm:max-w-lg overflow-hidden" showCloseButton={false}>
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">Search and navigate to sections</DialogDescription>

        {/* Search Input */}
        <div className="flex items-center border-b border-border px-3">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search sections..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-sm py-3 px-2 placeholder:text-muted-foreground"
            aria-label="Search sections"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <ScrollArea className="max-h-[300px] overflow-y-auto" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p className="text-sm">No results found for &quot;{query}&quot;</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="py-1" role="listbox">
              {filteredItems.map((item, index) => {
                const isActive = activeSection === item.id;
                const isSelected = index === selectedIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(item.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "bg-muted/60 text-muted-foreground"
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="flex-1 text-left">{item.label}</span>
                    {isActive && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                        Active
                      </Badge>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3 h-3 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono">&uarr;&darr;</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono">&crarr;</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 font-mono">ESC</kbd>
            Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
});
