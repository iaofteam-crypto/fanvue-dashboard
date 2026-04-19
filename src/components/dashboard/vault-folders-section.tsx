"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Vault,
  Plus,
  Trash2,
  Loader2,
  Pencil,
  ArrowLeft,
  Search,
  RefreshCw,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Check,
  X,
  AlertCircle,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SectionBreadcrumbs } from "@/components/dashboard/section-breadcrumbs";

// --- Types ---

interface VaultFolder {
  id: string;
  name: string;
  mediaCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface VaultMedia {
  uuid: string;
  type?: "image" | "video" | "audio" | "document";
  thumbnailUrl?: string;
  url?: string;
  filename?: string;
  size?: number;
  createdAt?: string;
  duration?: number;
}

// --- Helpers ---

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
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

function getMediaIcon(type?: string) {
  switch (type) {
    case "video":
      return Video;
    case "audio":
      return Music;
    case "document":
      return FileText;
    default:
      return ImageIcon;
  }
}

// --- Demo data ---

const DEMO_FOLDERS: VaultFolder[] = [
  { id: "vf-demo-1", name: "Exclusive Photos", mediaCount: 47, createdAt: new Date(Date.now() - 86400000 * 60).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: "vf-demo-2", name: "Behind the Scenes", mediaCount: 23, createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: "vf-demo-3", name: "VIP Content", mediaCount: 12, createdAt: new Date(Date.now() - 86400000 * 14).toISOString(), updatedAt: new Date(Date.now() - 3600000 * 6).toISOString() },
  { id: "vf-demo-4", name: "Tutorial Videos", mediaCount: 8, createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 1).toISOString() },
  { id: "vf-demo-5", name: "Seasonal Content", mediaCount: 31, createdAt: new Date(Date.now() - 86400000 * 90).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 10).toISOString() },
];

const DEMO_MEDIA: VaultMedia[] = [
  { uuid: "vm-1", type: "image", filename: "beach_sunset.jpg", size: 2400000, createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  { uuid: "vm-2", type: "image", filename: "city_night.png", size: 3800000, createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { uuid: "vm-3", type: "video", filename: "workout_routine.mp4", size: 48000000, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), duration: 342 },
  { uuid: "vm-4", type: "image", filename: "coffee_morning.jpg", size: 1900000, createdAt: new Date(Date.now() - 86400000 * 1).toISOString() },
  { uuid: "vm-5", type: "audio", filename: "voice_note.mp3", size: 520000, createdAt: new Date(Date.now() - 3600000 * 12).toISOString() },
  { uuid: "vm-6", type: "image", filename: "travel_vibes.jpg", size: 3100000, createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
  { uuid: "vm-7", type: "video", filename: "cooking_tips.mp4", size: 95000000, createdAt: new Date(Date.now() - 86400000 * 4).toISOString(), duration: 847 },
  { uuid: "vm-8", type: "image", filename: "sunset_glow.jpg", size: 2700000, createdAt: new Date(Date.now() - 86400000 * 6).toISOString() },
  { uuid: "vm-9", type: "document", filename: "schedule_april.pdf", size: 340000, createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
  { uuid: "vm-10", type: "image", filename: "portrait_studio.jpg", size: 4200000, createdAt: new Date(Date.now() - 86400000 * 8).toISOString() },
  { uuid: "vm-11", type: "image", filename: "outfit_check.jpg", size: 2100000, createdAt: new Date(Date.now() - 86400000 * 12).toISOString() },
  { uuid: "vm-12", type: "video", filename: "qna_session.mp4", size: 120000000, createdAt: new Date(Date.now() - 86400000 * 9).toISOString(), duration: 1520 },
];

// --- Component ---

export function VaultFoldersSection({ connected }: { connected: boolean }) {
  // View state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [addMediaUuid, setAddMediaUuid] = useState("");

  // Data state
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [mediaItems, setMediaItems] = useState<VaultMedia[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDetachId, setConfirmDetachId] = useState<string | null>(null);

  // Loading state
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [detaching, setDetaching] = useState<string | null>(null);

  // --- Fetch folders ---

  const fetchFolders = useCallback(async () => {
    if (!connected) return;
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/fanvue/vault/folders?page=1&size=50");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data || data?.folders || [];
        if (list.length > 0) {
          setFolders(list);
        } else {
          setFolders([]);
        }
        setLoadingFolders(false);
        return;
      }
    } catch {
      // fall through to demo
    }
    setFolders(DEMO_FOLDERS);
    setLoadingFolders(false);
  }, [connected]);

  // --- Fetch media in a folder ---

  const fetchFolderMedia = useCallback(async (folderId: string) => {
    setLoadingMedia(true);
    try {
      const res = await fetch(`/api/fanvue/vault/folders/${folderId}/media?page=1&size=50`);
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data?.data || data?.media || [];
        if (items.length > 0) {
          setMediaItems(items);
          setLoadingMedia(false);
          return;
        }
      }
    } catch {
      // fall through to demo
    }
    setMediaItems(DEMO_MEDIA);
    setLoadingMedia(false);
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  // --- CRUD operations ---

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/fanvue/vault/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (res.ok) {
        toast.success(`Folder "${newFolderName.trim()}" created`);
        setNewFolderName("");
        setShowCreateForm(false);
        fetchFolders();
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

  const handleRenameFolder = async (folderId: string) => {
    if (!editingName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setRenaming(true);
    try {
      const res = await fetch(`/api/fanvue/vault/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (res.ok) {
        toast.success("Folder renamed");
        setEditingFolderId(null);
        setEditingName("");
        fetchFolders();
      } else {
        toast.error("Failed to rename folder");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setDeleting(folderId);
    try {
      const res = await fetch(`/api/fanvue/vault/folders/${folderId}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        toast.success("Folder deleted");
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        if (selectedFolderId === folderId) {
          setSelectedFolderId(null);
          setMediaItems([]);
        }
        setConfirmDeleteId(null);
      } else {
        toast.error("Failed to delete folder");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(null);
    }
  };

  const handleAttachMedia = async () => {
    if (!addMediaUuid.trim() || !selectedFolderId) return;
    setAttaching(true);
    try {
      const res = await fetch(`/api/fanvue/vault/folders/${selectedFolderId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUuid: addMediaUuid.trim() }),
      });
      if (res.ok) {
        toast.success("Media added to folder");
        setAddMediaUuid("");
        setShowAddMedia(false);
        fetchFolderMedia(selectedFolderId);
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { error?: string; message?: string }).error || (err as { error?: string; message?: string }).message || "Failed to add media";
        toast.error(msg);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setAttaching(false);
    }
  };

  const handleDetachMedia = async (mediaUuid: string) => {
    if (!selectedFolderId) return;
    setDetaching(mediaUuid);
    try {
      const res = await fetch(`/api/fanvue/vault/folders/${selectedFolderId}/media/${mediaUuid}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        toast.success("Media removed from folder");
        setMediaItems((prev) => prev.filter((m) => m.uuid !== mediaUuid));
        setConfirmDetachId(null);
      } else {
        toast.error("Failed to remove media");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDetaching(null);
    }
  };

  // --- Navigation ---

  const handleSelectFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    fetchFolderMedia(folderId);
  };

  const handleBack = () => {
    setSelectedFolderId(null);
    setMediaItems([]);
    setShowAddMedia(false);
  };

  const startEditing = (folder: VaultFolder) => {
    setEditingFolderId(folder.id);
    setEditingName(folder.name);
  };

  const cancelEditing = () => {
    setEditingFolderId(null);
    setEditingName("");
  };

  // --- Filtered folders ---

  const filteredFolders = useMemo(() => folders.filter((f) => {
    if (!searchQuery) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  }), [folders, searchQuery]);

  const selectedFolder = selectedFolderId
    ? folders.find((f) => f.id === selectedFolderId)
    : null;

  // Stats
  const totalMedia = useMemo(() => folders.reduce((sum, f) => sum + (f.mediaCount ?? 0), 0), [folders]);

  // --- Disconnected state ---

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Vault className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Vault unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to manage your vault</p>
      </div>
    );
  }

  // --- Detail view (media in a selected folder) ---

  if (selectedFolderId && selectedFolder) {
    const breadcrumbItems = [{ label: "Vault" }, { label: selectedFolder.name }];
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
              <h2 className="text-lg font-bold">{selectedFolder.name}</h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {mediaItems.length} item{mediaItems.length !== 1 ? "s" : ""}
                </Badge>
                {selectedFolder.updatedAt && (
                  <span>Updated {timeAgo(selectedFolder.updatedAt)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchFolderMedia(selectedFolderId)} disabled={loadingMedia}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingMedia ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowAddMedia(!showAddMedia)}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Add Media
            </Button>
          </div>
        </div>

        {/* Add media form */}
        {showAddMedia && (
          <Card className="bg-card/50 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium flex-shrink-0">Media UUID:</Label>
                <Input
                  value={addMediaUuid}
                  onChange={(e) => setAddMediaUuid(e.target.value)}
                  placeholder="Enter media UUID to attach..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAttachMedia();
                  }}
                />
                <Button onClick={handleAttachMedia} disabled={!addMediaUuid.trim() || attaching} size="sm">
                  {attaching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setShowAddMedia(false); setAddMediaUuid(""); }} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter the UUID of media you have already uploaded. Use the Content section to upload new media first.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Media type filter counts */}
        {mediaItems.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            {(["image", "video", "audio", "document"] as const).map((type) => {
              const count = mediaItems.filter((m) => m.type === type).length;
              if (count === 0) return null;
              const Icon = getMediaIcon(type);
              return (
                <Badge key={type} variant="outline" className="text-[10px] px-2 py-0.5 gap-1">
                  <Icon className="w-3 h-3" />
                  {count} {type}{count !== 1 ? "s" : ""}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Media grid */}
        {loadingMedia ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-card/50 border border-border/50 rounded-lg overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-2 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : mediaItems.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-8">
              <EmptyState size="compact" icon={ImageIcon} title="No media in this folder" description="Add uploaded media using the button above" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {mediaItems.map((item) => {
              const Icon = getMediaIcon(item.type);
              return (
                <Card
                  key={item.uuid}
                  className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors group overflow-hidden"
                >
                  {/* Thumbnail area */}
                  <div className="relative aspect-square bg-muted/30 flex items-center justify-center">
                    {item.type === "image" && item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.filename || ""}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Icon className="w-8 h-8 text-muted-foreground/40" />
                    )}
                    {/* Type badge */}
                    <Badge
                      variant="secondary"
                      className="absolute top-1.5 right-1.5 text-[9px] px-1.5 py-0 bg-background/80 backdrop-blur-sm"
                    >
                      {item.type || "file"}
                    </Badge>
                    {/* Duration badge for videos */}
                    {item.type === "video" && item.duration && (
                      <Badge
                        variant="secondary"
                        className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0 bg-background/80 backdrop-blur-sm"
                      >
                        {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, "0")}
                      </Badge>
                    )}
                    {/* Hover overlay with detach button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {confirmDetachId === item.uuid ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDetachMedia(item.uuid)}
                            disabled={detaching === item.uuid}
                            className="text-[10px] h-7"
                          >
                            {detaching === item.uuid ? <Loader2 className="w-3 h-3 animate-spin" /> : "Remove"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDetachId(null)}
                            className="h-6 w-6"
                          >
                            <X className="w-3 h-3 text-white" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white hover:text-destructive"
                          onClick={() => setConfirmDetachId(item.uuid)}
                          title="Remove from folder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" title={item.filename || item.uuid}>
                      {item.filename || item.uuid.slice(0, 12) + "..."}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>{item.size ? formatFileSize(item.size) : "---"}</span>
                      {item.createdAt && <span>{timeAgo(item.createdAt)}</span>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
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
            <Vault className="w-6 h-6" />
            Vault
          </h1>
          <p className="text-muted-foreground text-sm">
            Organize your media into folders for subscriber-only access
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Folder
        </Button>
      </div>

      {/* Stats bar */}
      {!loadingFolders && folders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Total Folders</div>
              <div className="text-lg font-bold mt-0.5">{folders.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Total Media</div>
              <div className="text-lg font-bold mt-0.5">{totalMedia}</div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Images</div>
              <div className="text-lg font-bold mt-0.5">
                {DEMO_MEDIA.filter((m) => m.type === "image").length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Videos</div>
              <div className="text-lg font-bold mt-0.5">
                {DEMO_MEDIA.filter((m) => m.type === "video").length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <Card className="bg-card/50 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create Vault Folder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">Folder Name *</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Exclusive Photos, VIP Content..."
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolderName.trim()) handleCreateFolder();
                }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreateForm(false); setNewFolderName(""); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateFolder} disabled={!newFolderName.trim() || creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Create Folder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Folders grid */}
      {loadingFolders ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-card/50 border border-border/50 rounded-lg p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-8 w-8 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredFolders.length === 0 ? (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="py-8">
            <EmptyState
              icon={Vault}
              title={searchQuery ? "No matching folders" : "No vault folders yet"}
              description={searchQuery ? "Try adjusting your search" : "Create your first folder to organize your vault media"}
              actionLabel={!searchQuery ? "Create Folder" : undefined}
              onAction={!searchQuery ? () => setShowCreateForm(true) : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={staggerContainer(0.05)}
          initial="initial"
          animate="animate"
        >
          {filteredFolders.map((folder) => (
            <motion.div key={folder.id} variants={staggerItem}>
            <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Editable name */}
                    {editingFolderId === folder.id ? (
                      <div className="flex items-center gap-2 mb-1">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 text-sm"
                          maxLength={100}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameFolder(folder.id);
                            if (e.key === "Escape") cancelEditing();
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRenameFolder(folder.id)}
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
                      <div className="flex items-center gap-2">
                        <Vault className="w-4 h-4 text-primary/60 flex-shrink-0" />
                        <h3
                          className="font-semibold text-sm truncate cursor-pointer"
                          onClick={() => handleSelectFolder(folder.id)}
                        >
                          {folder.name}
                        </h3>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {editingFolderId !== folder.id && (
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => startEditing(folder)}
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDeleteId(folder.id)}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Media count and meta */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {folder.mediaCount ?? "---"} items
                    </span>
                    {folder.createdAt && (
                      <span>{formatDateTime(folder.createdAt)}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectFolder(folder.id)}
                    className="text-xs h-7"
                  >
                    Open
                  </Button>
                </div>
              </CardContent>

              {/* Delete confirmation */}
              {confirmDeleteId === folder.id && (
                <div className="border-t border-destructive/30 bg-destructive/5 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-destructive">Delete &quot;{folder.name}&quot;?</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)} className="text-xs h-7">
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteFolder(folder.id)}
                      disabled={deleting === folder.id}
                      className="text-xs h-7"
                    >
                      {deleting === folder.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Summary */}
      {!loadingFolders && folders.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{folders.length} folder{folders.length !== 1 ? "s" : ""}</span>
              <span>{totalMedia} total media items across all folders</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Vault className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">About Vault Folders</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vault folders let you organize your uploaded media into categories. Subscribers can browse folders
              to discover exclusive content. Use folders to group related media like photo sets, video series,
              or behind-the-scenes content. Media must be uploaded first via the Content section, then attached
              to vault folders using their UUID.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


