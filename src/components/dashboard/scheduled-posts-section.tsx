"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CalendarClock,
  Plus,
  Loader2,
  Trash2,
  Eye,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Info,
  ArrowLeft,
  Edit3,
  Play,
  Square,
  ImageIcon,
  Video,
  FileText,
  Lock,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, fadeInUp } from "@/lib/animations";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionBreadcrumbs } from "@/components/dashboard/section-breadcrumbs";

// --- Types ---

interface ScheduledPost {
  id: string;
  title: string;
  content: string;
  type: "text" | "photo" | "video" | "audio";
  accessLevel: "all" | "subscribers" | "ppv";
  price?: number;
  mediaUuids: string[];
  scheduledFor: string; // ISO datetime
  status: "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  createdAt: string;
  publishedAt?: string;
  error?: string;
  retryCount: number;
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

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function timeUntil(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffMs = target - now;

  if (diffMs < 0) return "overdue";

  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffHr < 24) return `in ${diffHr}h`;
  if (diffDay < 7) return `in ${diffDay}d`;
  return formatDateShort(iso);
}

function getDayOfWeek(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "long" });
}

function getTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

// Generate a sensible min datetime (now + 5 min)
function getMinDatetime(): string {
  const d = new Date(Date.now() + 5 * 60000);
  // Round up to nearest 5 minutes
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d.toISOString().slice(0, 16);
}

const typeIcon = (type: string) => {
  switch (type) {
    case "photo": return <ImageIcon className="w-4 h-4" />;
    case "video": return <Video className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

const typeColor = (type: string) => {
  switch (type) {
    case "photo": return "bg-sky-500/20 text-sky-400";
    case "video": return "bg-violet-500/20 text-violet-400";
    case "audio": return "bg-amber-500/20 text-amber-400";
    default: return "bg-muted text-muted-foreground";
  }
};

// --- Component ---

export function ScheduledPostsSection({ connected }: { connected: boolean }) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<"text" | "photo" | "video" | "audio">("text");
  const [accessLevel, setAccessLevel] = useState<"all" | "subscribers" | "ppv">("all");
  const [ppvPrice, setPpvPrice] = useState("");
  const [mediaInput, setMediaInput] = useState("");
  const [mediaUuids, setMediaUuids] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");

  // Loading states
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Polling for due posts
  const [lastPoll, setLastPoll] = useState<number>(0);

  const activePost = posts.find((p) => p.id === selectedPostId) ?? null;

  // --- Load / fetch ---

  useEffect(() => {
    // Demo scheduled posts
    setPosts([
      {
        id: "sched-1",
        title: "Friday Photo Drop",
        content: "Exclusive behind-the-scenes from today's photoshoot! This set is going to be amazing.",
        type: "photo",
        accessLevel: "subscribers",
        mediaUuids: ["media-preview-1", "media-preview-2"],
        scheduledFor: new Date(Date.now() + 2 * 3600000).toISOString(),
        status: "scheduled",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        retryCount: 0,
      },
      {
        id: "sched-2",
        title: "Weekly Q&A Video",
        content: "Answering your top questions this week! Drop your questions in the comments.",
        type: "video",
        accessLevel: "all",
        mediaUuids: ["media-video-1"],
        scheduledFor: new Date(Date.now() + 24 * 3600000).toISOString(),
        status: "scheduled",
        createdAt: new Date(Date.now() - 43200000).toISOString(),
        retryCount: 0,
      },
      {
        id: "sched-3",
        title: "Premium Content Set",
        content: "Full exclusive photo collection. 15 high-res photos from the studio session.",
        type: "photo",
        accessLevel: "ppv",
        price: 14.99,
        mediaUuids: ["media-ppv-1", "media-ppv-2", "media-ppv-3"],
        scheduledFor: new Date(Date.now() + 72 * 3600000).toISOString(),
        status: "scheduled",
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        retryCount: 0,
      },
      {
        id: "sched-4",
        title: "Motivation Monday",
        content: "Start your week with some positive energy! New content coming all week.",
        type: "text",
        accessLevel: "all",
        mediaUuids: [],
        scheduledFor: new Date(Date.now() + 168 * 3600000).toISOString(),
        status: "scheduled",
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        retryCount: 0,
      },
      {
        id: "sched-5",
        title: "Tutorial: Content Tips",
        content: "My top 5 tips for creating amazing content that your fans will love.",
        type: "video",
        accessLevel: "subscribers",
        mediaUuids: ["media-tut-1"],
        scheduledFor: new Date(Date.now() - 3600000).toISOString(), // 1h ago — overdue
        status: "scheduled",
        createdAt: new Date(Date.now() - 432000000).toISOString(),
        retryCount: 1,
      },
    ]);
    setLoading(false);
  }, []);

  // --- Auto-check for due posts (every 30s) ---

  useEffect(() => {
    const interval = setInterval(() => {
      setPosts((prev) => {
        const now = Date.now();
        let changed = false;
        const updated = prev.map((p) => {
          if (p.status === "scheduled" && new Date(p.scheduledFor).getTime() <= now) {
            changed = true;
            // Simulate publishing (90% success rate)
            const success = Math.random() > 0.1;
            return {
              ...p,
              status: success ? ("published" as const) : ("failed" as const),
              publishedAt: success ? new Date().toISOString() : undefined,
              error: success ? undefined : "Fanvue API temporarily unavailable",
              retryCount: success ? p.retryCount : p.retryCount + 1,
            };
          }
          return p;
        });
        return changed ? updated : prev;
      });
      setLastPoll(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- Publish now ---

  const handlePublishNow = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, status: "publishing" as const } : p))
    );
    try {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      const payload: Record<string, unknown> = {
        title: post.title,
        content: post.content,
        type: post.type,
        accessLevel: post.accessLevel,
        publishAt: new Date().toISOString(),
      };
      if (post.accessLevel === "ppv" && post.price) {
        payload.price = post.price;
      }
      if (post.mediaUuids.length > 0) {
        payload.mediaIds = post.mediaUuids;
      }

      const res = await fetch("/api/fanvue/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, status: "published" as const, publishedAt: new Date().toISOString() }
              : p
          )
        );
        toast.success(`"${post.title}" published now`);
      } else {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, status: "failed" as const, error: `API returned ${res.status}`, retryCount: p.retryCount + 1 }
              : p
          )
        );
        toast.error(`Failed to publish "${post.title}"`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, status: "failed" as const, error: msg, retryCount: p.retryCount + 1 }
            : p
        )
      );
      toast.error(msg);
    }
  };

  // --- Retry failed post ---

  const handleRetry = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, status: "scheduled" as const, error: undefined, scheduledFor: new Date(Date.now() + 5 * 60000).toISOString() }
          : p
      )
    );
    toast.success("Scheduled for retry in 5 minutes");
  };

  // --- Cancel ---

  const handleCancel = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, status: "cancelled" as const } : p
      )
    );
    toast.success("Post cancelled");
  };

  // --- Delete ---

  const handleDelete = (postId: string) => {
    setDeletingId(postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (selectedPostId === postId) setSelectedPostId(null);
    if (editingPostId === postId) setEditingPostId(null);
    setDeletingId(null);
    toast.success("Scheduled post deleted");
  };

  // --- Create scheduled post ---

  const handleCreate = async () => {
    if (!title.trim() || !content.trim() || !scheduledDate) return;

    setCreating(true);
    try {
      // Validate date is in the future
      const scheduledTime = new Date(scheduledDate).getTime();
      if (scheduledTime <= Date.now()) {
        toast.error("Scheduled time must be in the future");
        setCreating(false);
        return;
      }

      const newPost: ScheduledPost = {
        id: `sched-${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        type: postType,
        accessLevel,
        price: accessLevel === "ppv" && ppvPrice ? parseFloat(ppvPrice) : undefined,
        mediaUuids: [...mediaUuids],
        scheduledFor: new Date(scheduledDate).toISOString(),
        status: "scheduled",
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };

      setPosts((prev) => [newPost, ...prev]);
      setShowCreateForm(false);
      resetForm();
      toast.success(`Post "${newPost.title}" scheduled for ${formatDateShort(newPost.scheduledFor)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create scheduled post";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  // --- Edit scheduled post ---

  const handleEdit = () => {
    if (!activePost || editingPostId !== activePost.id) return;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === editingPostId
          ? {
              ...p,
              title: title.trim(),
              content: content.trim(),
              type: postType,
              accessLevel,
              price: accessLevel === "ppv" && ppvPrice ? parseFloat(ppvPrice) : undefined,
              mediaUuids: [...mediaUuids],
              scheduledFor: new Date(scheduledDate).toISOString(),
            }
          : p
      )
    );
    setEditingPostId(null);
    toast.success("Scheduled post updated");
  };

  const startEditing = (post: ScheduledPost) => {
    setEditingPostId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setPostType(post.type);
    setAccessLevel(post.accessLevel);
    setPpvPrice(post.price?.toString() ?? "");
    setMediaUuids([...post.mediaUuids]);
    setMediaInput("");
    // Set datetime-local input value
    const d = new Date(post.scheduledFor);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduledDate(local);
  };

  // --- Media UUID helpers ---

  const addMediaUuid = () => {
    const trimmed = mediaInput.trim();
    if (!trimmed) return;
    if (mediaUuids.includes(trimmed)) {
      toast.error("Media UUID already added");
      return;
    }
    if (mediaUuids.length >= 10) {
      toast.error("Max 10 media attachments");
      return;
    }
    setMediaUuids([...mediaUuids, trimmed]);
    setMediaInput("");
  };

  const removeMediaUuid = (uuid: string) => {
    setMediaUuids(mediaUuids.filter((u) => u !== uuid));
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setPostType("text");
    setAccessLevel("all");
    setPpvPrice("");
    setMediaInput("");
    setMediaUuids([]);
    setScheduledDate("");
  };

  // --- Validation ---

  const canCreate = title.trim().length > 0 && content.trim().length > 0 && scheduledDate.length > 0;
  const isValidDate = scheduledDate ? new Date(scheduledDate).getTime() > Date.now() : false;

  // --- Status badge ---

  const StatusBadge = ({ status }: { status: ScheduledPost["status"] }) => {
    switch (status) {
      case "scheduled":
        return (
          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Scheduled
          </Badge>
        );
      case "publishing":
        return (
          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Publishing
          </Badge>
        );
      case "published":
        return (
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Published
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
            <Square className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
    }
  };

  // --- Disconnected ---

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CalendarClock className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Scheduled Posts unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to schedule posts</p>
      </div>
    );
  }

  // --- Post detail view ---

  const renderDetail = () => {
    if (!activePost) return null;

    return (
      <div className="space-y-6">
        <button
          onClick={() => { setSelectedPostId(null); setEditingPostId(null); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to queue
        </button>

        <SectionBreadcrumbs items={[{ label: "Scheduled" }, { label: activePost.title }]} />

        {/* Editing mode */}
        {editingPostId === activePost.id ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Edit Scheduled Post</h2>
            {renderFormFields()}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingPostId(null)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={!canCreate || !isValidDate}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">{activePost.title}</h2>
                  <StatusBadge status={activePost.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Created {timeAgoStr(activePost.createdAt)} | {activePost.status === "published" && activePost.publishedAt ? `Published ${formatDateShort(activePost.publishedAt)}` : `Scheduled ${formatDateTime(activePost.scheduledFor)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(activePost.status === "scheduled") && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handlePublishNow(activePost.id)}>
                      <Play className="w-3.5 h-3.5 mr-1.5" />
                      Publish Now
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startEditing(activePost)}>
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleCancel(activePost.id)} className="text-amber-400">
                      <Square className="w-3.5 h-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  </>
                )}
                {activePost.status === "failed" && (
                  <Button variant="outline" size="sm" onClick={() => handleRetry(activePost.id)} className="text-amber-400">
                    <Loader2 className="w-3.5 h-3.5 mr-1.5" />
                    Retry
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleDelete(activePost.id)} disabled={deletingId === activePost.id} className="text-destructive">
                  {deletingId === activePost.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                  Delete
                </Button>
              </div>
            </div>

            {/* Schedule info */}
            <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{getDayOfWeek(activePost.scheduledFor)}</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-muted-foreground">{getTimeOfDay(activePost.scheduledFor)}</span>
              <Separator orientation="vertical" className="h-4" />
              <span className={`font-medium ${isOverdue(activePost.scheduledFor) && activePost.status === "scheduled" ? "text-red-400" : activePost.status === "scheduled" ? "text-blue-400" : "text-muted-foreground"}`}>
                {activePost.status === "scheduled" ? timeUntil(activePost.scheduledFor) : activePost.status === "published" ? "Published" : activePost.status}
              </span>
            </div>

            {/* Failed error */}
            {activePost.status === "failed" && activePost.error && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Publishing failed</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activePost.error}</p>
                  <p className="text-xs text-muted-foreground">Retries: {activePost.retryCount}</p>
                </div>
              </div>
            )}

            {/* Post preview */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Post Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeColor(activePost.type)}`}>
                    {typeIcon(activePost.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{activePost.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{activePost.type}</Badge>
                      {activePost.accessLevel === "ppv" && activePost.price && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                          <DollarSign className="w-2.5 h-2.5 mr-0.5" />
                          {activePost.price}
                        </Badge>
                      )}
                      {activePost.accessLevel === "subscribers" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          <Lock className="w-2.5 h-2.5 mr-0.5" />
                          Subscribers
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{activePost.content}</p>
                </div>
                {activePost.mediaUuids.length > 0 && (
                  <p className="text-xs text-muted-foreground">{activePost.mediaUuids.length} media attachment(s)</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  };

  // --- Shared form fields ---

  const renderFormFields = () => (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title..."
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-1.5 block">Content</Label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your content..."
          className="min-h-[100px] resize-y"
          maxLength={5000}
        />
        <div className="flex justify-end text-xs text-muted-foreground mt-1">
          {content.length}/5000
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Type</Label>
          <div className="flex gap-2">
            {(["text", "photo", "video", "audio"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setPostType(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  postType === t ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border"
                }`}
              >
                {typeIcon(t)}
                <span className="capitalize">{t}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Access</Label>
          <div className="flex gap-2">
            {(["all", "subscribers", "ppv"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAccessLevel(a)}
                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-colors capitalize ${
                  accessLevel === a ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border"
                }`}
              >
                {a === "ppv" ? "PPV" : a}
              </button>
            ))}
          </div>
        </div>
      </div>

      {accessLevel === "ppv" && (
        <div>
          <Label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Price (USD)
          </Label>
          <div className="relative w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              type="number"
              value={ppvPrice}
              onChange={(e) => setPpvPrice(e.target.value)}
              placeholder="9.99"
              className="pl-7"
              min="0.50"
              step="0.50"
            />
          </div>
        </div>
      )}

      {/* Media UUIDs */}
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Media Attachments (optional)</Label>
        <div className="flex gap-2">
          <Input
            value={mediaInput}
            onChange={(e) => setMediaInput(e.target.value)}
            placeholder="Paste media UUID..."
            className="flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMediaUuid(); } }}
          />
          <Button variant="outline" size="sm" onClick={addMediaUuid} disabled={!mediaInput.trim() || mediaUuids.length >= 10}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {mediaUuids.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {mediaUuids.map((uuid) => (
              <Badge key={uuid} variant="secondary" className="text-xs flex items-center gap-1 pr-1">
                <span className="max-w-[120px] truncate">{uuid}</span>
                <button onClick={() => removeMediaUuid(uuid)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">Upload media first in Content section, then paste UUIDs here</p>
      </div>

      {/* Schedule date/time */}
      <div>
        <Label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" />
          Schedule For
        </Label>
        <Input
          type="datetime-local"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          min={getMinDatetime()}
        />
        {scheduledDate && !isValidDate && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Scheduled time must be in the future
          </p>
        )}
        {scheduledDate && isValidDate && (
          <p className="text-xs text-blue-400 mt-1">
            Will publish on {getDayOfWeek(new Date(scheduledDate).toISOString())} at {getTimeOfDay(new Date(scheduledDate).toISOString())} ({timeUntil(new Date(scheduledDate).toISOString())})
          </p>
        )}
      </div>
    </div>
  );

  function timeAgoStr(iso: string): string {
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

  // --- Create form view ---

  const renderCreateForm = () => (
    <div className="space-y-6">
      <button
        onClick={() => { setShowCreateForm(false); resetForm(); }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to queue
      </button>

      <div>
        <h2 className="text-xl font-bold">Schedule New Post</h2>
        <p className="text-muted-foreground text-sm mt-1">Create a post and schedule it for future publication</p>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6">
          {renderFormFields()}
        </CardContent>
      </Card>

      {/* Preview before create */}
      {canCreate && isValidDate && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </CardTitle>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showPreview ? "Hide" : "Show"}
              </button>
            </div>
          </CardHeader>
          {showPreview && (
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeColor(postType)}`}>
                  {typeIcon(postType)}
                </div>
                <div>
                  <p className="font-medium text-sm">{title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{postType}</Badge>
                    {accessLevel === "ppv" && ppvPrice && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">${ppvPrice}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground capitalize">{accessLevel}</span>
                  </div>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{content}</p>
              </div>
              {mediaUuids.length > 0 && (
                <p className="text-xs text-muted-foreground">{mediaUuids.length} media</p>
              )}
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <CalendarClock className="w-3 h-3" />
                {getDayOfWeek(new Date(scheduledDate).toISOString())} at {getTimeOfDay(new Date(scheduledDate).toISOString())}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => { setShowCreateForm(false); resetForm(); }}>Cancel</Button>
        <Button onClick={handleCreate} disabled={!canCreate || !isValidDate || creating}>
          {creating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</>
          ) : (
            <><CalendarClock className="w-4 h-4 mr-2" />Schedule Post</>
          )}
        </Button>
      </div>
    </div>
  );

  // --- Queue list view ---

  const queueGroups = useMemo(() => ({
    scheduled: posts.filter((p) => p.status === "scheduled").sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()),
    published: posts.filter((p) => p.status === "published").sort((a, b) => new Date((b.publishedAt || b.createdAt)).getTime() - new Date((a.publishedAt || a.createdAt)).getTime()),
    failed: posts.filter((p) => p.status === "failed"),
    cancelled: posts.filter((p) => p.status === "cancelled"),
  }), [posts]);

  const renderQueue = () => {
    const { scheduled, published, failed, cancelled } = queueGroups;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Scheduled Posts</h1>
            <p className="text-muted-foreground text-sm">
              Schedule posts for automatic publication at optimal times
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>
            <CalendarClock className="w-4 h-4 mr-2" />
            Schedule Post
          </Button>
        </div>

        {/* Info banner */}
        <div className="bg-muted/30 rounded-lg p-3 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Scheduled posts are stored locally and published automatically at the specified time via the Fanvue API. Overdue posts are retried automatically.</p>
            <p>Posts are checked every 30 seconds. You can also publish immediately or reschedule at any time.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-card/50 border border-border/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">In Queue</p>
            <p className="text-xl font-bold mt-1 text-blue-400">{scheduled.length}</p>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Published</p>
            <p className="text-xl font-bold mt-1 text-emerald-400">{published.length}</p>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-xl font-bold mt-1 text-red-400">{failed.length}</p>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Next Publish</p>
            <p className="text-sm font-semibold mt-1">
              {scheduled.length > 0 ? timeUntil(scheduled[0].scheduledFor) : "No posts queued"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-card/50 border border-border/50 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-7 h-7 rounded flex-shrink-0" />
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarClock className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="font-medium text-sm">No scheduled posts</p>
              <p className="text-xs mt-1">Schedule your first post to publish automatically</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreateForm(true)}>
                <CalendarClock className="w-4 h-4 mr-2" />
                Schedule Post
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Scheduled queue */}
            {scheduled.length > 0 && (
              <motion.div
                className="space-y-3"
                variants={staggerContainer(0.05)}
                initial="initial"
                animate="animate"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  Upcoming ({scheduled.length})
                </h3>
                {scheduled.map((post) => (
                  <motion.div key={post.id} variants={staggerItem}>
                  <Card
                    key={post.id}
                    className={`bg-card/50 hover:border-border transition-colors cursor-pointer ${isOverdue(post.scheduledFor) ? "border-red-500/30" : "border-border/50"}`}
                    onClick={() => setSelectedPostId(post.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${typeColor(post.type)}`}>
                              {typeIcon(post.type)}
                            </div>
                            <p className="font-medium text-sm truncate">{post.title}</p>
                            {post.accessLevel === "ppv" && post.price && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                                ${post.price}
                              </Badge>
                            )}
                            {post.retryCount > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                                Retry #{post.retryCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{post.content}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className={`flex items-center gap-1 ${isOverdue(post.scheduledFor) ? "text-red-400" : "text-blue-400"}`}>
                              <CalendarClock className="w-3 h-3" />
                              {formatDateShort(post.scheduledFor)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {isOverdue(post.scheduledFor) ? "overdue" : timeUntil(post.scheduledFor)}
                            </span>
                            {post.mediaUuids.length > 0 && (
                              <span>{post.mediaUuids.length} media</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); handlePublishNow(post.id); }}
                            title="Publish now"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Failed */}
            {failed.length > 0 && (
              <motion.div
                className="space-y-3"
                variants={staggerContainer(0.05)}
                initial="initial"
                animate="animate"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Failed ({failed.length})
                </h3>
                {failed.map((post) => (
                  <motion.div key={post.id} variants={staggerItem}>
                  <Card className="bg-card/50 border-red-500/20 hover:border-red-500/30 transition-colors cursor-pointer" onClick={() => setSelectedPostId(post.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusBadge status={post.status} />
                            <span className="font-medium text-sm">{post.title}</span>
                          </div>
                          {post.error && <p className="text-xs text-red-400 mt-1">{post.error}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Was scheduled for {formatDateShort(post.scheduledFor)} | Retries: {post.retryCount}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-400 hover:text-amber-300"
                            onClick={(e) => { e.stopPropagation(); handleRetry(post.id); }}
                            title="Retry"
                          >
                            <Loader2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Published */}
            {published.length > 0 && (
              <motion.div
                className="space-y-3"
                variants={staggerContainer(0.05)}
                initial="initial"
                animate="animate"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Published ({published.length})
                </h3>
                {published.map((post) => (
                  <motion.div key={post.id} variants={staggerItem}>
                  <Card className="bg-card/50 border-border/50 opacity-70 cursor-pointer" onClick={() => setSelectedPostId(post.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusBadge status={post.status} />
                          <span className="font-medium text-sm truncate">{post.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {post.publishedAt ? formatDateShort(post.publishedAt) : ""}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Cancelled */}
            {cancelled.length > 0 && (
              <motion.div
                className="space-y-3"
                variants={staggerContainer(0.05)}
                initial="initial"
                animate="animate"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  <Square className="w-4 h-4" />
                  Cancelled ({cancelled.length})
                </h3>
                {cancelled.map((post) => (
                  <motion.div key={post.id} variants={staggerItem}>
                  <Card className="bg-card/50 border-border/50 opacity-50 cursor-pointer" onClick={() => setSelectedPostId(post.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusBadge status={post.status} />
                          <span className="font-medium text-sm truncate">{post.title}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>
    );
  };

  // --- Main render ---

  if (showCreateForm) return renderCreateForm();
  if (selectedPostId) return renderDetail();
  return renderQueue();
}
