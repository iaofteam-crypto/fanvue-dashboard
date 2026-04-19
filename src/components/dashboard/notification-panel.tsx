"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Bell,
  BellOff,
  MessageSquare,
  Eye,
  UserPlus,
  Crown,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  data: Record<string, string>;
}

interface WebhookEvent {
  id: string;
  type: string;
  receivedAt: string;
  payload: Record<string, unknown>;
}

interface WebhookResponse {
  events: WebhookEvent[];
  total: number;
  returned: number;
}

interface NotificationPanelProps {
  connected: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000;
const READ_STORAGE_KEY = "fanvue_read_notifications";
const SOUND_STORAGE_KEY = "fanvue_notification_sound";

const TOAST_EVENT_TYPES = new Set([
  "message-received",
  "new-subscriber",
  "tip-received",
]);

const SOUND_EVENT_TYPES = new Set(["new-subscriber", "tip-received"]);

// ─── Event Type Config ────────────────────────────────────────────────────────

type EventTypeConfig = {
  icon: typeof Bell;
  colorClass: string;
  bgClass: string;
};

const EVENT_TYPE_CONFIG: Record<string, EventTypeConfig> = {
  "message-received": {
    icon: MessageSquare,
    colorClass: "text-sky-500",
    bgClass: "bg-sky-500/10",
  },
  "message-read": {
    icon: Eye,
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
  },
  "new-follower": {
    icon: UserPlus,
    colorClass: "text-violet-500",
    bgClass: "bg-violet-500/10",
  },
  "new-subscriber": {
    icon: Crown,
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
  },
  "tip-received": {
    icon: DollarSign,
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a string value from a nested payload, with fallback */
function extractString(
  payload: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

/** Safely extract a nested object from payload */
function extractObject(
  payload: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const value = payload[key];
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Format a date as relative time string */
function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

/** Convert a webhook event to a notification item */
function eventToNotification(event: WebhookEvent): NotificationItem {
  const { type, payload, id, receivedAt } = event;
  const data: Record<string, string> = {};

  let title = "New Event";
  let description = "Unknown event received";

  switch (type) {
    case "message-received": {
      const senderObj = extractObject(payload, "sender") ?? payload;
      const senderName =
        extractString(senderObj, "displayName", "name", "username") ||
        "Someone";
      const message = extractString(payload, "text", "content", "body") || "";
      data.senderName = senderName;
      title = `New Message from ${senderName}`;
      description = message.length > 80 ? `${message.slice(0, 80)}…` : message || "New message received";
      break;
    }
    case "message-read": {
      const readerObj = extractObject(payload, "reader") ?? payload;
      const readerName =
        extractString(readerObj, "displayName", "name", "username") ||
        "Someone";
      data.readerName = readerName;
      title = `Message Read by ${readerName}`;
      description = "Your message was read";
      break;
    }
    case "new-follower": {
      const followerObj = extractObject(payload, "follower") ?? payload;
      const followerName =
        extractString(followerObj, "displayName", "name") || "Someone";
      const username =
        extractString(followerObj, "username", "handle") || followerName.toLowerCase();
      data.followerName = followerName;
      data.username = username;
      title = `New Follower: ${followerName}`;
      description = `@${username} started following you`;
      break;
    }
    case "new-subscriber": {
      const subObj = extractObject(payload, "subscriber") ?? payload;
      const subscriberName =
        extractString(subObj, "displayName", "name") || "Someone";
      const tier =
        extractString(payload, "tier", "tierName", "planName") || "Standard";
      data.subscriberName = subscriberName;
      data.tier = tier;
      title = `New Subscriber: ${subscriberName}!`;
      description = `Tier: ${tier} — Welcome!`;
      break;
    }
    case "tip-received": {
      const tipObj = extractObject(payload, "tip") ?? payload;
      const amount =
        extractString(tipObj, "amount", "value") ||
        extractString(payload, "amount", "value") ||
        "0";
      const tipperObj = extractObject(payload, "tipper") ?? payload;
      const tipperName =
        extractString(tipperObj, "displayName", "name") ||
        extractString(payload, "tipperName", "from") ||
        "Someone";
      data.amount = amount;
      data.tipperName = tipperName;
      title = `Tip Received: $${amount}!`;
      description = `From ${tipperName}`;
      break;
    }
  }

  return {
    id,
    type,
    title,
    description,
    timestamp: receivedAt,
    read: false,
    data,
  };
}

/** Play a short beep using Web Audio API */
function playNotificationBeep(): void {
  try {
    if (typeof window === "undefined" || !window.AudioContext) return;

    // Respect user preference
    const soundPref = localStorage.getItem(SOUND_STORAGE_KEY);
    if (soundPref === "false") return;

    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);

    // Clean up after sound finishes
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 200);
  } catch {
    // Silently fail — audio is non-critical
  }
}

/** Generate 5 deterministic demo notifications spread over last 2 hours */
function generateDemoNotifications(): NotificationItem[] {
  const now = Date.now();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  return [
    {
      id: "demo-tip-001",
      type: "tip-received",
      title: "Tip Received: $25!",
      description: "From Alex Morgan",
      timestamp: new Date(now - 3 * 60 * 1000).toISOString(),
      read: false,
      data: { amount: "25", tipperName: "Alex Morgan" },
    },
    {
      id: "demo-msg-001",
      type: "message-received",
      title: "New Message from Jordan Lee",
      description:
        "Hey! I just wanted to say I love your latest content. Can't wait for the next post!",
      timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
      read: false,
      data: { senderName: "Jordan Lee" },
    },
    {
      id: "demo-sub-001",
      type: "new-subscriber",
      title: "New Subscriber: Sam Wilson!",
      description: "Tier: Premium — Welcome!",
      timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
      read: false,
      data: { subscriberName: "Sam Wilson", tier: "Premium" },
    },
    {
      id: "demo-follow-001",
      type: "new-follower",
      title: "New Follower: Casey Brooks",
      description: "@caseybrooks started following you",
      timestamp: new Date(now - 60 * 60 * 1000).toISOString(),
      read: false,
      data: { followerName: "Casey Brooks", username: "caseybrooks" },
    },
    {
      id: "demo-read-001",
      type: "message-read",
      title: "Message Read by Taylor Swift",
      description: "Your message was read",
      timestamp: new Date(now - 90 * 60 * 1000).toISOString(),
      read: false,
      data: { readerName: "Taylor Swift" },
    },
  ];
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadReadIds(): Set<string> {
  try {
    if (typeof window === "undefined") return new Set();
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v: unknown): v is string => typeof v === "string"));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Silently fail — storage is non-critical
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const NotificationPanel = React.memo(function NotificationPanel({ connected }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<string>("");
  const seenEventIds = useRef<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  // Derived unread count
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  // Load read IDs from localStorage on mount
  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  // Generate demo notifications on initial load if connected
  useEffect(() => {
    if (connected && !demoLoaded) {
      const demos = generateDemoNotifications();
      setNotifications(demos);
      setDemoLoaded(true);
      setLastPollTime(demos[0].timestamp);

      // Mark demo IDs as seen so they don't trigger toasts
      demos.forEach((d) => seenEventIds.current.add(d.id));

      // Mark already-read demos
      const existingRead = loadReadIds();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read: existingRead.has(n.id),
        }))
      );
      setReadIds(existingRead);
    }
  }, [connected, demoLoaded]);

  // Poll for new webhook events
  useEffect(() => {
    if (!connected) return;

    const fetchEvents = async () => {
      try {
        const sinceParam = lastPollTime
          ? `?since=${encodeURIComponent(lastPollTime)}`
          : "";
        const res = await fetch(`/api/webhooks/fanvue${sinceParam}`);

        if (!res.ok) return;

        const data = (await res.json()) as WebhookResponse;
        const newEvents = data.events;

        if (newEvents.length === 0) return;

        // Convert events to notification items
        const newNotifications = newEvents.map(eventToNotification);

        // Update last poll time to the newest event
        const newestTime = newEvents[0].receivedAt;
        setLastPollTime(newestTime);

        // Process each new event
        for (let i = 0; i < newNotifications.length; i++) {
          const notif = newNotifications[i];
          const isNew = !seenEventIds.current.has(notif.id);

          if (isNew) {
            seenEventIds.current.add(notif.id);

            // Show toast for important events only
            if (TOAST_EVENT_TYPES.has(notif.type)) {
              toast(notif.title, {
                description: notif.description,
                duration: 4000,
              });
            }

            // Play sound for subscriber/tip events
            if (SOUND_EVENT_TYPES.has(notif.type)) {
              playNotificationBeep();
            }
          }
        }

        // Append new notifications (prepend — newest first)
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const unique = newNotifications.filter((n) => !existingIds.has(n.id));
          return [...unique, ...prev];
        });
      } catch {
        // Silently fail — polling is non-critical
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [connected, lastPollTime]);

  // Close panel on click outside
  useEffect(() => {
    if (!panelOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelOpen]);

  // Mark a single notification as read
  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      const newReadIds = new Set(readIds);
      newReadIds.add(id);
      setReadIds(newReadIds);
      saveReadIds(newReadIds);
    },
    [readIds]
  );

  // Mark all as read
  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    saveReadIds(allIds);
  }, [notifications]);

  // Toggle panel
  const togglePanel = () => setPanelOpen((prev) => !prev);

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePanel}
        className="relative h-9 w-9"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {panelOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] bg-popover border border-border rounded-xl shadow-lg z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({unreadCount} unread)
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                aria-label="Mark all notifications as read"
              >
                Mark all read
              </Button>
            )}
          </div>

          {/* Notification List */}
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BellOff className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 max-h-[380px]">
              <div className="divide-y divide-border/30">
                {notifications.map((notif) => {
                  const config = EVENT_TYPE_CONFIG[notif.type];
                  const Icon = config?.icon ?? Bell;

                  return (
                    <button
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                        !notif.read ? "bg-primary/[0.03]" : ""
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config?.bgClass ?? "bg-muted"} ${config?.colorClass ?? "text-muted-foreground"}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-1.5">
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm leading-tight truncate ${
                                !notif.read ? "font-semibold" : "font-medium text-foreground/80"
                              }`}
                            >
                              {notif.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {notif.description}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {formatTimeAgo(new Date(notif.timestamp))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Powered by Fanvue Webhooks
            </p>
          </div>
        </div>
      )}
    </div>
  );
});
