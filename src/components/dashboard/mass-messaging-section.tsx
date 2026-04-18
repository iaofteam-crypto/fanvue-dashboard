"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

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

interface MassMessageRecord {
  id: string;
  text?: string;
  recipientCount: number;
  status?: "sending" | "sent" | "failed" | "scheduled";
  createdAt: string;
  mediaCount?: number;
  price?: number | null;
}

interface ListMember {
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  memberSince?: string;
}

// --- Constants ---

const SMART_LIST_IDS: Array<{ id: string; name: string; description: string }> = [
  { id: "all_fans", name: "All Fans", description: "Everyone who follows you" },
  { id: "subscribers", name: "Active Subscribers", description: "Users with active subscriptions" },
  { id: "expired_subscribers", name: "Expired Subscribers", description: "Users whose subscriptions expired" },
  { id: "top_spenders", name: "Top Spenders", description: "Highest spending fans" },
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

// --- Component ---

export function MassMessagingSection({ connected }: { connected: boolean }) {
  // Composer state
  const [messageText, setMessageText] = useState("");
  const [mediaUuids, setMediaUuids] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState("");
  const [ppvPrice, setPpvPrice] = useState("");
  const [selectedSmartLists, setSelectedSmartLists] = useState<Set<string>>(new Set());
  const [selectedCustomLists, setSelectedCustomLists] = useState<Set<string>>(new Set());
  const [excludeSmartLists, setExcludeSmartLists] = useState<Set<string>>(new Set());
  const [excludeCustomLists, setExcludeCustomLists] = useState<Set<string>>(new Set());

  // API state
  const [smartLists, setSmartLists] = useState<SmartList[]>([]);
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [massMessages, setMassMessages] = useState<MassMessageRecord[]>([]);
  const [listMembers, setListMembers] = useState<ListMember[]>([]);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [listMembersExpanded, setListMembersExpanded] = useState(false);

  // Loading states
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showConfirmSend, setShowConfirmSend] = useState(false);

  // Active tab: "compose" | "history"
  const [activeTab, setActiveTab] = useState<"compose" | "history">("compose");

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
        if (list.length > 0) {
          setSmartLists(list);
        } else {
          // Use hardcoded smart list IDs from API docs
          setSmartLists(
            SMART_LIST_IDS.map((sl) => ({
              id: sl.id,
              name: sl.name,
              description: sl.description,
            }))
          );
        }
      } else {
        setSmartLists(
          SMART_LIST_IDS.map((sl) => ({
            id: sl.id,
            name: sl.name,
            description: sl.description,
          }))
        );
      }

      if (customRes.status === "fulfilled" && customRes.value.ok) {
        const data = await customRes.value.json();
        const list = Array.isArray(data) ? data : data?.data || data?.lists || [];
        setCustomLists(list);
      }
    } catch {
      setSmartLists(
        SMART_LIST_IDS.map((sl) => ({
          id: sl.id,
          name: sl.name,
          description: sl.description,
        }))
      );
    } finally {
      setLoadingLists(false);
    }
  }, [connected]);

  // --- Fetch mass message history ---

  const fetchHistory = useCallback(async () => {
    if (!connected) return;
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/fanvue/chat-messages/mass");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data || data?.messages || [];
        setMassMessages(list);
      }
    } catch {
      // Demo data
      setMassMessages([
        { id: "demo-1", text: "Welcome to our exclusive content! New drop this Friday", recipientCount: 342, status: "sent", createdAt: new Date(Date.now() - 86400000).toISOString() },
        { id: "demo-2", text: "Special offer: 20% off for new subscribers this week!", recipientCount: 89, status: "sent", createdAt: new Date(Date.now() - 172800000).toISOString(), mediaCount: 1 },
        { id: "demo-3", text: "Thanks for being a top supporter! Here is a sneak peek...", recipientCount: 15, status: "sent", createdAt: new Date(Date.now() - 604800000).toISOString(), price: 500 },
      ]);
    } finally {
      setLoadingHistory(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchLists();
    fetchHistory();
  }, [fetchLists, fetchHistory]);

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

  const toggleExcludeSmart = (id: string) => {
    setExcludeSmartLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExcludeCustom = (uuid: string) => {
    setExcludeCustomLists((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  // --- Add media UUID ---

  const addMediaUuid = () => {
    const trimmed = mediaInput.trim();
    if (!trimmed) return;
    if (mediaUuids.includes(trimmed)) {
      toast.error("This media UUID is already added");
      return;
    }
    if (mediaUuids.length >= 10) {
      toast.error("Maximum 10 media attachments allowed");
      return;
    }
    setMediaUuids((prev) => [...prev, trimmed]);
    setMediaInput("");
  };

  const removeMediaUuid = (uuid: string) => {
    setMediaUuids((prev) => prev.filter((u) => u !== uuid));
  };

  // --- Preview members ---

  const fetchListMembers = async (listId: string, isSmart: boolean) => {
    setLoadingMembers(true);
    setListMembersExpanded(true);
    try {
      const endpoint = isSmart
        ? `/api/fanvue/chats/lists/smart/${listId}?page=1&size=20`
        : `/api/fanvue/chats/lists/custom/${listId}?page=1&size=20`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const members = Array.isArray(data) ? data : data?.data || data?.members || [];
        setListMembers(members);
      }
    } catch {
      setListMembers([]);
      toast.error("Could not load list members");
    } finally {
      setLoadingMembers(false);
    }
  };

  // --- Validation ---

  const canSend =
    messageText.trim().length > 0 &&
    (selectedSmartLists.size > 0 || selectedCustomLists.size > 0);

  const priceCents = ppvPrice ? parseInt(ppvPrice, 10) * 100 : 0;
  const hasPrice = priceCents > 0;
  const priceValid = !hasPrice || (priceCents >= 200 && mediaUuids.length > 0);

  // --- Send mass message ---

  const handleSend = async () => {
    if (!canSend || !priceValid) return;
    setSending(true);
    try {
      const body: Record<string, unknown> = {
        text: messageText.trim(),
        includedLists: {
          smartListUuids: Array.from(selectedSmartLists),
          customListUuids: Array.from(selectedCustomLists),
        },
      };

      if (mediaUuids.length > 0) {
        body.mediaUuids = mediaUuids;
      }

      if (hasPrice) {
        body.price = priceCents;
      }

      if (excludeSmartLists.size > 0 || excludeCustomLists.size > 0) {
        body.excludedLists = {
          smartListUuids: Array.from(excludeSmartLists),
          customListUuids: Array.from(excludeCustomLists),
        };
      }

      const res = await fetch("/api/fanvue/chats/mass-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Mass message sent to ${(data as { recipientCount?: number }).recipientCount ?? "all"} recipients`);
        // Reset form
        setMessageText("");
        setMediaUuids([]);
        setPpvPrice("");
        setSelectedSmartLists(new Set());
        setSelectedCustomLists(new Set());
        setExcludeSmartLists(new Set());
        setExcludeCustomLists(new Set());
        setShowConfirmSend(false);
        // Refresh history
        fetchHistory();
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg =
          (errorData as { error?: string; message?: string }).error ||
          (errorData as { error?: string; message?: string }).message ||
          `Failed to send (${res.status})`;
        toast.error(errorMsg);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error sending mass message";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  // --- Delete mass message ---

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/fanvue/chat-messages/mass/${id}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        toast.success("Mass message deleted");
        setMassMessages((prev) => prev.filter((m) => m.id !== id));
      } else {
        toast.error("Failed to delete mass message");
      }
    } catch {
      toast.error("Network error deleting mass message");
    } finally {
      setDeletingId(null);
    }
  };

  // --- Status badge ---

  const StatusBadge = ({ status }: { status?: string }) => {
    switch (status) {
      case "sending":
        return (
          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Sending
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Sent
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Scheduled
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Delivered
          </Badge>
        );
    }
  };

  // --- Disconnected state ---

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Megaphone className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Mass Messaging unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to send mass messages</p>
      </div>
    );
  }

  // --- Compose view ---

  const renderCompose = () => (
    <div className="space-y-6">
      {/* List Selection */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Recipient Lists
            {loadingLists && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Smart Lists */}
          <div>
            <p className="text-sm font-medium mb-2">Smart Lists</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {smartLists.map((list) => {
                const isSelected = selectedSmartLists.has(list.id);
                const isExcluded = excludeSmartLists.has(list.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => toggleSmartList(list.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border transition-colors text-left ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{list.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {list.description || list.id}
                      </p>
                    </div>
                    {list.memberCount != null && (
                      <span className="text-xs text-muted-foreground">{list.memberCount}</span>
                    )}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExcludeSmart(list.id);
                        }}
                        className="text-xs px-1.5 py-0.5 rounded border"
                        title={isExcluded ? "Remove from exclusion" : "Exclude from this list"}
                      >
                        {isExcluded ? (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                            <X className="w-2.5 h-2.5 mr-0.5" />
                            Excl
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground hover:text-foreground text-[10px]">
                            Excl?
                          </span>
                        )}
                      </button>
                    )}
                    {isSelected && !isExcluded && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchListMembers(list.id, true);
                        }}
                        className="text-xs text-primary hover:underline"
                        title="Preview members"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Lists */}
          {customLists.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Custom Lists</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {customLists.map((list) => {
                  const isSelected = selectedCustomLists.has(list.uuid);
                  const isExcluded = excludeCustomLists.has(list.uuid);
                  return (
                    <button
                      key={list.uuid}
                      onClick={() => toggleCustomList(list.uuid)}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border transition-colors text-left ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{list.name}</p>
                        {list.memberCount != null && (
                          <p className="text-xs text-muted-foreground">{list.memberCount} members</p>
                        )}
                      </div>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchListMembers(list.uuid, false);
                          }}
                          className="text-xs text-primary hover:underline"
                          title="Preview members"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedSmartLists.size === 0 && selectedCustomLists.size === 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              Select at least one list to send a mass message
            </p>
          )}

          {/* List Members Preview */}
          {listMembersExpanded && (
            <div className="border border-border/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground">Members Preview</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setListMembersExpanded(false)}
                  className="h-6 text-xs"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              {loadingMembers ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : listMembers.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {listMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Users className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <span className="truncate">
                        {member.displayName || member.username || member.id}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No members loaded</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Composer */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Write your mass message here..."
            className="min-h-[120px] resize-y"
            maxLength={5000}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Supports text, emojis, and media attachments</span>
            <span>{messageText.length}/5000</span>
          </div>

          {/* Media Attachments */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Media Attachments (optional)</Label>
            <div className="flex gap-2">
              <Input
                value={mediaInput}
                onChange={(e) => setMediaInput(e.target.value)}
                placeholder="Paste media UUID..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMediaUuid();
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addMediaUuid}
                disabled={!mediaInput.trim() || mediaUuids.length >= 10}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {mediaUuids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {mediaUuids.map((uuid) => (
                  <Badge
                    key={uuid}
                    variant="secondary"
                    className="text-xs flex items-center gap-1 pr-1"
                  >
                    <span className="max-w-[120px] truncate">{uuid}</span>
                    <button
                      onClick={() => removeMediaUuid(uuid)}
                      className="hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Upload media first in the Content section, then paste the UUID here
            </p>
          </div>

          <Separator />

          {/* PPV Pricing */}
          <div>
            <Label className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Pay-Per-View Price (optional)
            </Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  value={ppvPrice}
                  onChange={(e) => setPpvPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-28 pl-7"
                  min="2"
                  step="0.01"
                />
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Minimum $2.00 (200 cents)</p>
                <p>Requires at least one media attachment</p>
              </div>
            </div>
            {hasPrice && mediaUuids.length === 0 && (
              <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Add media to enable PPV pricing
              </p>
            )}
            {hasPrice && priceCents < 200 && (
              <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Minimum PPV price is $2.00
              </p>
            )}
          </div>

          {/* Exclusion Lists */}
          {(excludeSmartLists.size > 0 || excludeCustomLists.size > 0) && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5 text-amber-400">
                  <X className="w-3.5 h-3.5" />
                  Excluded ({excludeSmartLists.size + excludeCustomLists.size})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(excludeSmartLists).map((id) => (
                    <Badge
                      key={`excl-smart-${id}`}
                      variant="outline"
                      className="text-xs border-amber-500/30 text-amber-400"
                    >
                      {id}
                      <button onClick={() => toggleExcludeSmart(id)} className="ml-1 hover:text-amber-300">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {Array.from(excludeCustomLists).map((uuid) => {
                    const cl = customLists.find((c) => c.uuid === uuid);
                    return (
                      <Badge
                        key={`excl-custom-${uuid}`}
                        variant="outline"
                        className="text-xs border-amber-500/30 text-amber-400"
                      >
                        {cl?.name || uuid}
                        <button onClick={() => toggleExcludeCustom(uuid)} className="ml-1 hover:text-amber-300">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Preview & Send */}
          {canSend && (
            <>
              <Separator />
              <div className="border border-border/50 rounded-lg p-4">
                <button
                  onClick={() => setPreviewExpanded(!previewExpanded)}
                  className="w-full flex items-center justify-between text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Message Preview
                  </span>
                  {previewExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {previewExpanded && (
                  <div className="mt-3 space-y-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm whitespace-pre-wrap">{messageText}</p>
                      {mediaUuids.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {mediaUuids.length} media attachment{mediaUuids.length !== 1 ? "s" : ""}
                        </p>
                      )}
                      {hasPrice && priceValid && (
                        <p className="text-xs text-primary mt-1">
                          PPV Price: {formatCurrency(priceCents)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {selectedSmartLists.size + selectedCustomLists.size} list
                          {selectedSmartLists.size + selectedCustomLists.size !== 1 ? "s" : ""} selected
                        </span>
                      </div>
                      {excludeSmartLists.size + excludeCustomLists.size > 0 && (
                        <span className="text-xs text-amber-400">
                          - {excludeSmartLists.size + excludeCustomLists.size} excluded
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between">
                  {!priceValid && (
                    <p className="text-xs text-amber-400">Fix validation errors above to send</p>
                  )}
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowConfirmSend(true)}
                      disabled={!priceValid || sending}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send Mass Message
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // --- History view ---

  const renderHistory = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {massMessages.length} mass message{massMessages.length !== 1 ? "s" : ""} sent
        </p>
        <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loadingHistory}>
          {loadingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {loadingHistory ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : massMessages.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="font-medium text-sm">No mass messages yet</p>
            <p className="text-xs mt-1">Send your first mass message from the Compose tab</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setActiveTab("compose")}
            >
              <Send className="w-4 h-4 mr-2" />
              Compose
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {massMessages.map((msg) => (
            <Card key={msg.id} className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={msg.status} />
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(msg.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm truncate">{msg.text || "(media only)"}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {msg.recipientCount} recipients
                      </span>
                      {msg.mediaCount != null && msg.mediaCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {msg.mediaCount} media
                        </span>
                      )}
                      {msg.price != null && msg.price > 0 && (
                        <span className="flex items-center gap-1 text-primary">
                          <DollarSign className="w-3 h-3" />
                          {formatCurrency(msg.price)}
                        </span>
                      )}
                      <span className="hidden sm:inline">
                        {formatDateTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => handleDelete(msg.id)}
                    disabled={deletingId === msg.id}
                  >
                    {deletingId === msg.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // --- Confirm send dialog (inline) ---

  const renderConfirmDialog = () => {
    if (!showConfirmSend) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card className="w-full max-w-md mx-4 bg-background border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Confirm Send
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                You are about to send a mass message to {selectedSmartLists.size + selectedCustomLists.size} list(s).
              </p>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="whitespace-pre-wrap">{messageText}</p>
                {mediaUuids.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    + {mediaUuids.length} media attachment{mediaUuids.length !== 1 ? "s" : ""}
                  </p>
                )}
                {hasPrice && (
                  <p className="text-xs text-primary mt-1">PPV: {formatCurrency(priceCents)}</p>
                )}
              </div>
              <ul className="space-y-1 text-muted-foreground">
                {Array.from(selectedSmartLists).map((id) => {
                  const sl = smartLists.find((s) => s.id === id);
                  return (
                    <li key={id} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                      {sl?.name || id}
                    </li>
                  );
                })}
                {Array.from(selectedCustomLists).map((uuid) => {
                  const cl = customLists.find((c) => c.uuid === uuid);
                  return (
                    <li key={uuid} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                      {cl?.name || uuid}
                    </li>
                  );
                })}
              </ul>
              {excludeSmartLists.size + excludeCustomLists.size > 0 && (
                <p className="text-xs text-amber-400">
                  Excluding {excludeSmartLists.size + excludeCustomLists.size} list(s)
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirmSend(false)} disabled={sending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Confirm Send
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // --- Main render ---

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mass Messaging</h1>
          <p className="text-muted-foreground text-sm">
            Send messages to multiple fans at once using smart and custom lists
          </p>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("compose")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "compose"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Send className="w-3.5 h-3.5 inline mr-1.5" />
          Compose
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          History
          {massMessages.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
              {massMessages.length}
            </Badge>
          )}
        </button>
      </div>

      {activeTab === "compose" ? renderCompose() : renderHistory()}
      {renderConfirmDialog()}
    </div>
  );
}
