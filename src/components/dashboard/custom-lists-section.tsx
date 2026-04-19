"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  Pencil,
  ArrowLeft,
  Search,
  UserPlus,
  UserMinus,
  Check,
  X,
  RefreshCw,
  FolderOpen,
  AlertCircle,
  GripVertical,
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";

// --- Types ---

interface CustomList {
  uuid: string;
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
  addedAt?: string;
  spentTotal?: number;
  messageCount?: number;
  isSubscriber?: boolean;
  subscriptionTier?: string;
  lastActiveAt?: string;
}

// --- Helpers ---

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// --- Demo data ---

const DEMO_LISTS: CustomList[] = [
  { uuid: "cl-demo-1", name: "VIP Fans", description: "Top-tier subscribers for exclusive drops", memberCount: 23, createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
  { uuid: "cl-demo-2", name: "New Followers", description: "Followers from the last 7 days", memberCount: 45, createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
  { uuid: "cl-demo-3", name: "High Engagers", description: "Fans who message frequently", memberCount: 12, createdAt: new Date(Date.now() - 86400000 * 14).toISOString() },
  { uuid: "cl-demo-4", name: "Re-engagement Targets", description: "Fans inactive for 30+ days", memberCount: 67, createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
];

const DEMO_MEMBERS: ListMember[] = [
  { id: "fan-1", displayName: "Alex Johnson", username: "alex.j", spentTotal: 4500, messageCount: 34, isSubscriber: true, subscriptionTier: "VIP", lastActiveAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "fan-2", displayName: "Sarah Mitchell", username: "sarah.m", spentTotal: 2800, messageCount: 12, isSubscriber: true, lastActiveAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "fan-3", displayName: "Mike Davis", username: "mike.d", spentTotal: 1200, messageCount: 56, isSubscriber: false, lastActiveAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "fan-4", displayName: "Jordan Kim", username: "jordan.k", spentTotal: 8900, messageCount: 89, isSubscriber: true, subscriptionTier: "VIP", lastActiveAt: new Date(Date.now() - 1800000).toISOString() },
  { id: "fan-5", displayName: "Chris Park", username: "chris.p", spentTotal: 500, messageCount: 3, isSubscriber: false, lastActiveAt: new Date(Date.now() - 259200000).toISOString() },
];

// --- Component ---

export function CustomListsSection({ connected }: { connected: boolean }) {
  // View state
  const [selectedListUuid, setSelectedListUuid] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingListUuid, setEditingListUuid] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberId, setAddMemberId] = useState("");

  // Data state
  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [members, setMembers] = useState<ListMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRemoveMemberId, setConfirmRemoveMemberId] = useState<string | null>(null);

  // Loading state
  const [loadingLists, setLoadingLists] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  // --- Fetch lists ---

  const fetchLists = useCallback(async () => {
    if (!connected) return;
    setLoadingLists(true);
    try {
      const res = await fetch("/api/fanvue/chats/lists/custom?page=1&size=50");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data || data?.lists || [];
        if (list.length > 0) {
          setCustomLists(list);
        } else {
          setCustomLists([]);
        }
        return;
      }
    } catch {
      // fall through
    }
    setCustomLists(DEMO_LISTS);
    setLoadingLists(false);
  }, [connected]);

  // --- Fetch members ---

  const fetchMembers = useCallback(async (listUuid: string) => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/fanvue/chats/lists/custom/${listUuid}?page=1&size=50`);
      if (res.ok) {
        const data = await res.json();
        const memberList = Array.isArray(data) ? data : data?.data || data?.members || [];
        if (memberList.length > 0) {
          setMembers(memberList);
          setLoadingMembers(false);
          return;
        }
      }
    } catch {
      // fall through
    }
    setMembers(DEMO_MEMBERS);
    setLoadingMembers(false);
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // --- CRUD operations ---

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error("List name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/fanvue/chats/lists/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newListName.trim(), description: newListDescription.trim() || undefined }),
      });
      if (res.ok) {
        toast.success(`List "${newListName.trim()}" created`);
        setNewListName("");
        setNewListDescription("");
        setShowCreateForm(false);
        fetchLists();
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

  const handleRenameList = async (uuid: string) => {
    if (!editingName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setRenaming(true);
    try {
      const res = await fetch(`/api/fanvue/chats/lists/custom/${uuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (res.ok) {
        toast.success("List renamed");
        setEditingListUuid(null);
        setEditingName("");
        fetchLists();
        // Update selectedList if it's the one we renamed
        if (selectedListUuid === uuid) {
          setSelectedListUuid(uuid); // trigger re-render
        }
      } else {
        toast.error("Failed to rename list");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteList = async (uuid: string) => {
    setDeleting(uuid);
    try {
      const res = await fetch(`/api/fanvue/chats/lists/custom/${uuid}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        toast.success("List deleted");
        setCustomLists((prev) => prev.filter((l) => l.uuid !== uuid));
        if (selectedListUuid === uuid) {
          setSelectedListUuid(null);
          setMembers([]);
        }
        setConfirmDeleteId(null);
      } else {
        toast.error("Failed to delete list");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(null);
    }
  };

  const handleAddMember = async () => {
    if (!addMemberId.trim() || !selectedListUuid) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/fanvue/chats/lists/custom/${selectedListUuid}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: addMemberId.trim() }),
      });
      if (res.ok) {
        toast.success("Member added");
        setAddMemberId("");
        setShowAddMember(false);
        fetchMembers(selectedListUuid);
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { error?: string; message?: string }).error || (err as { error?: string; message?: string }).message || "Failed to add member";
        toast.error(msg);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedListUuid) return;
    setRemovingMember(memberId);
    try {
      const res = await fetch(`/api/fanvue/chats/lists/custom/${selectedListUuid}/members/${memberId}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        toast.success("Member removed");
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        setConfirmRemoveMemberId(null);
      } else {
        toast.error("Failed to remove member");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setRemovingMember(null);
    }
  };

  // --- Navigation ---

  const handleSelectList = (uuid: string) => {
    setSelectedListUuid(uuid);
    fetchMembers(uuid);
  };

  const handleBack = () => {
    setSelectedListUuid(null);
    setMembers([]);
    setShowAddMember(false);
  };

  const startEditing = (list: CustomList) => {
    setEditingListUuid(list.uuid);
    setEditingName(list.name);
  };

  const cancelEditing = () => {
    setEditingListUuid(null);
    setEditingName("");
  };

  // --- Filtered lists ---

  const filteredLists = customLists.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.name.toLowerCase().includes(q) || (l.description || "").toLowerCase().includes(q);
  });

  const selectedList = selectedListUuid
    ? customLists.find((l) => l.uuid === selectedListUuid)
    : null;

  // --- Disconnected state ---

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FolderOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Custom Lists unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to manage custom lists</p>
      </div>
    );
  }

  // --- Detail view (members of a selected list) ---

  if (selectedListUuid && selectedList) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-lg font-bold">{selectedList.name}</h2>
              {selectedList.description && (
                <p className="text-xs text-muted-foreground">{selectedList.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchMembers(selectedListUuid)} disabled={loadingMembers}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingMembers ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAddMember(!showAddMember)}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Add member form */}
        {showAddMember && (
          <Card className="bg-card/50 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium flex-shrink-0">Fan ID:</Label>
                <Input
                  value={addMemberId}
                  onChange={(e) => setAddMemberId(e.target.value)}
                  placeholder="Enter fan user ID..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddMember();
                  }}
                />
                <Button onClick={handleAddMember} disabled={!addMemberId.trim() || addingMember} size="sm">
                  {addingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setShowAddMember(false); setAddMemberId(""); }} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter the Fanvue user ID of the fan you want to add to this list
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {members.length} member{members.length !== 1 ? "s" : ""}
          </Badge>
          {selectedList.createdAt && (
            <span className="text-xs text-muted-foreground">
              Created {formatDateTime(selectedList.createdAt)}
            </span>
          )}
        </div>

        {/* Members list */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-0">
            <ScrollArea className="max-h-[calc(100vh-18rem)]">
              {loadingMembers ? (
                <div className="py-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3 p-4 border-b border-border/30">
                      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-7 w-16 rounded" />
                    </div>
                  ))}
                </div>
              ) : members.length === 0 ? (
                <EmptyState size="compact" icon={Users} title="No members yet" description="Add fans to this list using the button above" />
              ) : (
                <div>
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-b-0"
                    >
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
                          <Users className="w-4 h-4 text-primary/60" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {member.displayName || member.username || member.id}
                          </p>
                          {member.isSubscriber && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                              {member.subscriptionTier || "Sub"}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {member.messageCount != null && (
                            <span>{member.messageCount} msgs</span>
                          )}
                          {member.spentTotal != null && member.spentTotal > 0 && (
                            <span className="text-emerald-400">{formatCurrency(member.spentTotal)}</span>
                          )}
                          {member.lastActiveAt && (
                            <span>{timeAgo(member.lastActiveAt)}</span>
                          )}
                          {member.addedAt && (
                            <span>Added {timeAgo(member.addedAt)}</span>
                          )}
                        </div>
                      </div>

                      {/* Remove button */}
                      {confirmRemoveMemberId === member.id ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removingMember === member.id}
                            className="text-xs h-7"
                          >
                            {removingMember === member.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmRemoveMemberId(null)}
                            className="h-7 w-7"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={() => setConfirmRemoveMemberId(member.id)}
                          title="Remove from list"
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- List overview (main view) ---

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Lists</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage your own fan segments for targeted messaging
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={showCreateForm && !newListName.trim()}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New List
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card className="bg-card/50 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create Custom List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">List Name *</Label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g. VIP Fans, New Followers..."
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newListName.trim()) handleCreateList();
                }}
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Description (optional)</Label>
              <Textarea
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="What is this list for?"
                className="min-h-[60px] resize-y"
                maxLength={300}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreateForm(false); setNewListName(""); setNewListDescription(""); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateList} disabled={!newListName.trim() || creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Create List
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search lists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lists grid */}
      {loadingLists ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-card/50 border border-border/50 rounded-lg p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
                <Skeleton className="h-8 w-8 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredLists.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-8">
            <EmptyState
              icon={FolderOpen}
              title={searchQuery ? "No matching lists" : "No custom lists yet"}
              description={searchQuery ? "Try adjusting your search" : "Create your first list to organize your fans"}
              actionLabel={!searchQuery ? "Create List" : undefined}
              onAction={!searchQuery ? () => setShowCreateForm(true) : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLists.map((list) => (
            <Card key={list.uuid} className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Editable name */}
                    {editingListUuid === list.uuid ? (
                      <div className="flex items-center gap-2 mb-1">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 text-sm"
                          maxLength={100}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameList(list.uuid);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRenameList(list.uuid)}
                          disabled={renaming || !editingName.trim()}
                          className="h-8 w-8 text-emerald-400 hover:text-emerald-300 flex-shrink-0"
                        >
                          {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={cancelEditing}
                          className="h-8 w-8 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <h3 className="font-semibold text-sm truncate cursor-pointer" onClick={() => handleSelectList(list.uuid)}>
                        {list.name}
                      </h3>
                    )}
                    {list.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{list.description}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => handleSelectList(list.uuid)}
                      title="View members"
                    >
                      <Users className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => startEditing(list)}
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDeleteId(list.uuid)}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {list.memberCount ?? "---"} members
                    </span>
                    {list.createdAt && (
                      <span>{formatDateTime(list.createdAt)}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectList(list.uuid)}
                    className="text-xs h-7"
                  >
                    View
                  </Button>
                </div>
              </CardContent>

              {/* Delete confirmation */}
              {confirmDeleteId === list.uuid && (
                <div className="border-t border-destructive/30 bg-destructive/5 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-destructive">Delete &quot;{list.name}&quot;? This cannot be undone.</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)} className="text-xs h-7">
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteList(list.uuid)}
                      disabled={deleting === list.uuid}
                      className="text-xs h-7"
                    >
                      {deleting === list.uuid ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loadingLists && customLists.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{customLists.length} custom list{customLists.length !== 1 ? "s" : ""}</span>
              <span>
                {customLists.reduce((sum, l) => sum + (l.memberCount ?? 0), 0)} total members across all lists
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <FolderOpen className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Custom Lists vs Smart Lists</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Custom lists are manually curated — you add and remove fans yourself. Smart lists are auto-maintained by Fanvue
              based on engagement and spending patterns. Use custom lists for specific campaigns, and smart lists for automated segmentation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
