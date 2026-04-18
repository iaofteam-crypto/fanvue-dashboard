"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  FileText,
  Search,
  ListTodo,
  Bot,
  FolderOpen,
  Link2,
  Moon,
  Sun,
  Menu,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "next-themes";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

// ✅ FIX A1: Code splitting — lazy-load all sections except dashboard
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";

const AnalyticsSection = dynamic(
  () => import("@/components/dashboard/analytics-section").then((m) => ({ default: m.AnalyticsSection })),
  { loading: () => <SectionSkeleton />, ssr: false }
);

const MessagesSection = dynamic(
  () => import("@/components/dashboard/messages-section").then((m) => ({ default: m.MessagesSection })),
  { loading: () => <SectionSkeleton />, ssr: false }
);

const ContentSection = dynamic(
  () => import("@/components/dashboard/content-section").then((m) => ({ default: m.ContentSection })),
  { loading: () => <SectionSkeleton />, ssr: false }
);

const DiscoveriesSection = dynamic(
  () => import("@/components/dashboard/discoveries-section").then((m) => ({ default: m.DiscoveriesSection })),
  { loading: () => <SectionSkeleton />, ssr: false }
);

const TasksSection = dynamic(
  () => import("@/components/dashboard/tasks-section").then((m) => ({ default: m.TasksSection })),
  { loading: () => <SectionSkeleton />, ssr: false }
);

const AelianaChatSection = dynamic(
  () => import("@/components/dashboard/aeliana-chat").then((m) => ({ default: m.AelianaChatSection })),
  { loading: () => <SectionSkeleton />, ssr: false }
);

const RepoBrowserSection = dynamic(
  () => import("@/components/dashboard/repo-browser").then((m) => ({ default: m.RepoBrowserSection })),
  { loading: () => <SectionSkeleton />, ssr: false }
);

const ConnectionSection = dynamic(
  () => import("@/components/dashboard/connection-section").then((m) => ({ default: m.ConnectionSection })),
  { loading: () => <SectionSkeleton />, ssr: false }
);

// Skeleton loader for dynamically loaded sections
function SectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-lg" />
    </div>
  );
}

type Section =
  | "dashboard"
  | "analytics"
  | "messages"
  | "content"
  | "discoveries"
  | "tasks"
  | "aeliana"
  | "repo"
  | "connection";

const NAV_ITEMS: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "content", label: "Content", icon: FileText },
  { id: "discoveries", label: "Discoveries", icon: Search },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "aeliana", label: "AELIANA AI", icon: Bot },
  { id: "repo", label: "Repo Browser", icon: FolderOpen },
  { id: "connection", label: "Connection", icon: Link2 },
];

// Mobile bottom nav — primary 5 items
const MOBILE_NAV_IDS: Section[] = ["dashboard", "messages", "content", "aeliana", "connection"];

// Move SidebarContent outside the parent component
function SidebarNav({
  activeSection,
  connected,
  theme,
  onNavigate,
  onToggleTheme,
}: {
  activeSection: Section;
  connected: boolean;
  theme: string | undefined;
  onNavigate: (section: Section) => void;
  onToggleTheme: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm">Fanvue Ops</h1>
            <p className="text-xs text-muted-foreground">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeSection === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border/50 space-y-1">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-emerald-400" : "bg-muted-foreground"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {connected ? "Fanvue Connected" : "Not Connected"}
          </span>
        </div>
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
          <span>
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </div>
    </div>
  );
}

// Connection store for external state sync
let connectionListeners: Array<() => void> = [];
let currentConnectionState = false;

function subscribeToConnection(listener: () => void) {
  connectionListeners.push(listener);
  return () => {
    connectionListeners = connectionListeners.filter((l) => l !== listener);
  };
}

function getConnectionSnapshot() {
  return currentConnectionState;
}

function getServerConnectionSnapshot() {
  return false;
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  // Use sync external store for connection state
  const connected = useSyncExternalStore(
    subscribeToConnection,
    getConnectionSnapshot,
    getServerConnectionSnapshot
  );

  // Check URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      currentConnectionState = true;
      connectionListeners.forEach((l) => l());
      window.history.replaceState({}, "", "/");
    }
    if (params.get("error")) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // Check connection and start polling
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/auth/status");
        if (res.ok) {
          const data = await res.json();
          if (currentConnectionState !== data.connected) {
            currentConnectionState = data.connected;
            connectionListeners.forEach((l) => l());
          }
        }
      } catch {
        if (currentConnectionState !== false) {
          currentConnectionState = false;
          connectionListeners.forEach((l) => l());
        }
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = () => {
    window.location.href = "/api/fanvue/authorize";
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/auth/disconnect", { method: "POST" });
    } catch {
      // ignore
    }
    currentConnectionState = false;
    connectionListeners.forEach((l) => l());
  };

  const navigateTo = (section: Section) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardOverview connected={connected} />;
      case "analytics":
        return <AnalyticsSection connected={connected} />;
      case "messages":
        return <MessagesSection connected={connected} />;
      case "content":
        return <ContentSection connected={connected} />;
      case "discoveries":
        return <DiscoveriesSection />;
      case "tasks":
        return <TasksSection />;
      case "aeliana":
        return <AelianaChatSection />;
      case "repo":
        return <RepoBrowserSection />;
      case "connection":
        return (
          <ConnectionSection
            connected={connected}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        );
      default:
        return <DashboardOverview connected={connected} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 border-r border-border/50 bg-card/30 flex-shrink-0 hidden md:flex">
          <SidebarNav
            activeSection={activeSection}
            connected={connected}
            theme={theme}
            onNavigate={navigateTo}
            onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          />
        </aside>
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0 bg-card/95">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav
              activeSection={activeSection}
              connected={connected}
              theme={theme}
              onNavigate={navigateTo}
              onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 flex-shrink-0 bg-card/30">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="h-9 w-9"
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <h2 className="font-semibold text-sm">
              {NAV_ITEMS.find((n) => n.id === activeSection)?.label || "Dashboard"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <Badge
                variant="outline"
                className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
                Connected
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConnect}
                className="text-xs h-8"
              >
                <Link2 className="w-3 h-3 mr-1" />
                Connect
              </Button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8">
            {renderContent()}
          </div>
        </div>

        {/* Mobile Bottom Nav */}
        {isMobile && (
          <nav className="border-t border-border/50 bg-card/95 backdrop-blur-sm md:hidden flex-shrink-0">
            <div className="flex items-center justify-around px-2 py-1">
              {MOBILE_NAV_IDS.map((sectionId) => {
                const item = NAV_ITEMS.find((n) => n.id === sectionId);
                if (!item) return null;
                return (
                <button
                  key={item.id}
                  onClick={() => navigateTo(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors relative ${
                    activeSection === item.id
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="w-4.5 h-4.5" />
                  <span className="text-[10px]">{item.label}</span>
                </button>
                );
              })}
            </div>
          </nav>
        )}
      </main>
    </div>
  );
}
