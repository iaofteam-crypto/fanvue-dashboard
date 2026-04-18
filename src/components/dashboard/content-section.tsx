"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  ImageIcon,
  Video,
  Lock,
  Globe,
  Loader2,
  Eye,
  MessageSquare,
  FileText,
  Trash2,
  DollarSign,
  Upload,
  X,
  Pin,
  PinOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Post {
  id: string;
  title?: string;
  content?: string;
  type?: string;
  status?: string;
  createdAt?: string;
  likesCount?: number;
  commentsCount?: number;
  isLocked?: boolean;
  isPinned?: boolean;
  price?: number;
  media?: Array<{ type?: string; url?: string }>;
}

interface MediaFile {
  file: File;
  preview: string;
  type: "image" | "video" | "audio" | "document";
}

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/mov", "video/quicktime"];
const ACCEPTED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/aac"];
const ACCEPTED_DOC_TYPES = ["application/pdf", "application/zip"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB — chunks upload directly to S3
const MAX_FILES = 10;
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk
const MAX_PARALLEL_CHUNKS = 3;
const MAX_CHUNK_RETRIES = 3;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ContentSection({ connected }: { connected: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", type: "text", accessLevel: "all", price: "" });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPosts = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/fanvue/posts");
      if (res.ok) {
        const data = await res.json();
        const postList = Array.isArray(data) ? data : data?.data || data?.posts || [];
        setPosts(postList);
        setLoading(false);
        return;
      }
    } catch {
      toast.error("Failed to load posts");
    }
    // Demo data
    setPosts([
      { id: "1", title: "Behind the scenes", content: "Exclusive BTS content from today's shoot!", type: "photo", status: "published", likesCount: 245, commentsCount: 32, isLocked: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "2", title: "Weekly Q&A", content: "Answering your questions this week!", type: "text", status: "published", likesCount: 189, commentsCount: 56, isLocked: false, createdAt: new Date(Date.now() - 172800000).toISOString() },
      { id: "3", title: "Premium photo set", content: "Exclusive collection for subscribers only", type: "photo", status: "published", likesCount: 412, commentsCount: 28, isLocked: true, price: 9.99, createdAt: new Date(Date.now() - 259200000).toISOString() },
      { id: "4", title: "Day in my life", content: "Vlog from yesterday", type: "video", status: "published", likesCount: 567, commentsCount: 89, isLocked: false, isPinned: true, createdAt: new Date(Date.now() - 345600000).toISOString() },
      { id: "5", title: "Cooking tutorial", content: "Making my favorite pasta recipe", type: "video", status: "draft", likesCount: 0, commentsCount: 0, isLocked: false, createdAt: new Date().toISOString() },
    ]);
    setLoading(false);
  }, [connected]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // --- Media helpers ---
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid: MediaFile[] = [];

    for (const file of arr) {
      if (mediaFiles.length + valid.length >= MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files allowed`);
        break;
      }
      const allAccepted = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_AUDIO_TYPES, ...ACCEPTED_DOC_TYPES];
      if (!allAccepted.includes(file.type)) {
        toast.error(`Unsupported file type: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large: ${file.name} (${formatFileSize(file.size)}). Max ${formatFileSize(MAX_FILE_SIZE)}`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      let type: "image" | "video" | "audio" | "document" = "image";
      if (ACCEPTED_IMAGE_TYPES.includes(file.type)) type = "image";
      else if (ACCEPTED_VIDEO_TYPES.includes(file.type)) type = "video";
      else if (ACCEPTED_AUDIO_TYPES.includes(file.type)) type = "audio";
      else type = "document";
      valid.push({ file, preview, type });

      // Auto-set post type based on first media
      if (newPost.type === "text" && type === "image") {
        setNewPost((p) => ({ ...p, type: "photo" }));
      } else if (newPost.type === "text" && type === "video") {
        setNewPost((p) => ({ ...p, type: "video" }));
      } else if (newPost.type === "text" && type === "audio") {
        setNewPost((p) => ({ ...p, type: "audio" }));
      }
    }

    if (valid.length > 0) {
      setMediaFiles((prev) => [...prev, ...valid]);
    }
  }, [mediaFiles.length, newPost.type]);

  const removeFile = useCallback((index: number) => {
    setMediaFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const resetDialog = useCallback(() => {
    setNewPost({ title: "", content: "", type: "text", accessLevel: "all", price: "" });
    setMediaFiles([]);
    setUploading(false);
    setUploadProgress(0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  // --- 3-Step Chunked Media Upload (presigned URL flow) ---
  const uploadMediaFile = useCallback(async (
    file: File,
    mediaType: "image" | "video" | "audio" | "document",
    onProgress: (pct: number, status: string) => void
  ): Promise<string | null> => {
    try {
      // Step 1: Create upload session
      onProgress(0, `Starting upload: ${file.name}`);
      const sessionRes = await fetch("/api/fanvue/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, filename: file.name, mediaType }),
      });

      if (!sessionRes.ok) {
        const errText = await sessionRes.text();
        toast.error(`Failed to start upload: ${sessionRes.status}`);
        console.error("Upload session error:", errText);
        return null;
      }

      const session = await sessionRes.json() as { mediaUuid?: string; uploadId?: string };
      if (!session.mediaUuid || !session.uploadId) {
        toast.error("Upload session returned invalid data");
        return null;
      }

      const { mediaUuid, uploadId } = session;

      // Step 2: Upload chunks via presigned S3 URLs
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const parts: Array<{ PartNumber: number; ETag: string }> = [];

      // Process chunks with concurrency limit
      const uploadChunk = async (chunkIndex: number): Promise<void> => {
        const partNumber = chunkIndex + 1;
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        // Get presigned URL with retry
        let presignedUrl = "";
        for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
          try {
            const urlRes = await fetch(
              `/api/fanvue/upload?uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`
            );
            if (!urlRes.ok) {
              throw new Error(`Presigned URL request failed: ${urlRes.status}`);
            }
            const urlData = await urlRes.json() as { url?: string };
            if (!urlData.url) throw new Error("No URL in response");
            presignedUrl = urlData.url;
            break;
          } catch (err: unknown) {
            if (attempt === MAX_CHUNK_RETRIES) {
              throw err;
            }
            // Wait before retry (exponential backoff: 500ms, 1s, 2s)
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
          }
        }

        // Upload chunk directly to S3 with retry
        for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
          try {
            const s3Res = await fetch(presignedUrl, {
              method: "PUT",
              body: chunk,
              headers: { "Content-Type": "application/octet-stream" },
            });

            if (!s3Res.ok) {
              throw new Error(`S3 upload failed: ${s3Res.status}`);
            }

            const etag = s3Res.headers.get("ETag");
            if (etag) {
              // Remove surrounding quotes from ETag if present
              parts[chunkIndex] = {
                PartNumber: partNumber,
                ETag: etag.replace(/^"|"$/g, ""),
              };
            }
            break;
          } catch (err: unknown) {
            if (attempt === MAX_CHUNK_RETRIES) {
              throw err;
            }
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
          }
        }
      };

      // Upload chunks with parallelism limit
      let completedChunks = 0;
      const inFlight = new Set<Promise<void>>();

      for (let i = 0; i < totalChunks; i++) {
        // Wait if we have too many concurrent uploads
        if (inFlight.size >= MAX_PARALLEL_CHUNKS) {
          await Promise.race(inFlight);
        }

        const promise = uploadChunk(i).then(() => {
          completedChunks++;
          const pct = Math.round((completedChunks / totalChunks) * 100);
          onProgress(pct, `Uploading ${file.name}: chunk ${completedChunks}/${totalChunks}`);
        }).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          throw new Error(`Chunk ${i + 1} failed: ${msg}`);
        });

        inFlight.add(promise);
        promise.finally(() => inFlight.delete(promise));
      }

      // Wait for all remaining chunks
      await Promise.all(inFlight);

      // Step 3: Complete upload session
      onProgress(95, "Finalizing upload...");
      const completeRes = await fetch("/api/fanvue/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, parts }),
      });

      if (!completeRes.ok) {
        const errText = await completeRes.text();
        toast.error(`Failed to complete upload: ${completeRes.status}`);
        console.error("Upload complete error:", errText);
        return null;
      }

      onProgress(100, "Upload complete");
      return mediaUuid;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
      console.error("Upload error:", err);
      return null;
    }
  }, []);

  // --- Create post ---
  const handleCreatePost = async () => {
    setCreating(true);
    try {
      let mediaIds: string[] = [];

      // Upload media using 3-step presigned URL flow
      if (mediaFiles.length > 0) {
        setUploading(true);
        setUploadProgress(0);

        for (let i = 0; i < mediaFiles.length; i++) {
          const basePct = Math.round((i / mediaFiles.length) * 100);
          const mediaUuid = await uploadMediaFile(mediaFiles[i].file, mediaFiles[i].type, (chunkPct, _status) => {
            // Combine file-level and chunk-level progress
            const fileWeight = 100 / mediaFiles.length;
            const overallPct = Math.round(basePct + (chunkPct / 100) * fileWeight);
            setUploadProgress(Math.min(overallPct, 99));
          });

          if (mediaUuid) {
            mediaIds.push(mediaUuid);
          } else {
            toast.error(`Failed to upload ${mediaFiles[i].file.name}`);
          }
        }

        setUploadProgress(100);
        setUploading(false);
      }

      // Step 2: Create post with media references
      const payload: Record<string, string | number | string[]> = {
        title: newPost.title,
        content: newPost.content,
        type: newPost.type,
        accessLevel: newPost.accessLevel,
      };
      if (newPost.accessLevel === "ppv" && newPost.price) {
        payload.price = parseFloat(newPost.price);
      }
      if (mediaIds.length > 0) {
        payload.mediaIds = mediaIds;
      }

      const res = await fetch("/api/fanvue/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Post published successfully");
        setDialogOpen(false);
        resetDialog();
        fetchPosts();
      } else {
        toast.error("Failed to publish post");
      }
    } catch {
      toast.error("Failed to create post");
    } finally {
      setCreating(false);
      setUploading(false);
    }
  };

  const handleTogglePin = async (postId: string, currentlyPinned: boolean) => {
    setPinningId(postId);
    try {
      const method = currentlyPinned ? "DELETE" : "POST";
      const res = await fetch(`/api/fanvue/posts/${postId}/pin`, {
        method,
      });
      if (res.ok || res.status === 204) {
        // Optimistically update
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, isPinned: !currentlyPinned } : p))
        );
        toast.success(currentlyPinned ? "Post unpinned" : "Post pinned");
      } else {
        toast.error(`Failed to ${currentlyPinned ? "unpin" : "pin"} post`);
      }
    } catch {
      toast.error(`Network error ${currentlyPinned ? "unpinning" : "pinning"} post`);
    } finally {
      setPinningId(null);
    }
  };

  const handleDeletePost = async (postId: string) => {
    setDeletingId(postId);
    try {
      const res = await fetch(`/api/fanvue/posts/${postId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Post deleted");
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        toast.error("Failed to delete post");
      }
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setDeletingId(null);
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Content unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to manage content</p>
      </div>
    );
  }

  const typeIcon = (type?: string) => {
    switch (type) {
      case "photo": return <ImageIcon className="w-4 h-4" />;
      case "video": return <Video className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="text-muted-foreground text-sm">
            Manage your posts and create new content
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) resetDialog();
            setDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder="Post title..."
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                />
              </div>

              {/* Media Upload Zone */}
              <div className="space-y-2">
                <Label>Media</Label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : mediaFiles.length > 0
                        ? "border-border/50"
                        : "border-border hover:border-primary/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES, ...ACCEPTED_AUDIO_TYPES, ...ACCEPTED_DOC_TYPES].join(",")}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {mediaFiles.length === 0 ? (
                    <div className="space-y-2 py-2">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground/50" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Drop files here or click to upload
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Images (JPG, PNG, GIF, WebP), Videos (MP4, WebM, MOV), Audio, Documents
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          Max {formatFileSize(MAX_FILE_SIZE)} per file, up to {MAX_FILES} files
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {mediaFiles.map((mf, idx) => (
                          <div
                            key={`${mf.file.name}-${idx}`}
                            className="relative group rounded-lg overflow-hidden border border-border/50 bg-muted/30"
                          >
                            {mf.type === "image" ? (
                              <img
                                src={mf.preview}
                                alt={mf.file.name}
                                className="w-20 h-20 object-cover"
                              />
                            ) : (
                              <div className="w-20 h-20 flex items-center justify-center bg-muted">
                                <Video className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <button
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(idx);
                              }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <p className="text-[10px] text-muted-foreground px-1 pb-1 truncate max-w-[80px]">
                              {mf.file.name}
                            </p>
                          </div>
                        ))}
                        <button
                          className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                        >
                          <Plus className="w-5 h-5 text-muted-foreground" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {mediaFiles.length} file{mediaFiles.length !== 1 ? "s" : ""} selected
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  placeholder="Write your content..."
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={newPost.type}
                    onValueChange={(v) => setNewPost({ ...newPost, type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="photo">Photo</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Access</Label>
                  <Select
                    value={newPost.accessLevel}
                    onValueChange={(v) => setNewPost({ ...newPost, accessLevel: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fans</SelectItem>
                      <SelectItem value="subscribers">Subscribers Only</SelectItem>
                      <SelectItem value="ppv">Pay-Per-View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {newPost.accessLevel === "ppv" && (
                <div className="space-y-2">
                  <Label>Price (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      min="0.50"
                      step="0.50"
                      placeholder="9.99"
                      value={newPost.price}
                      onChange={(e) => setNewPost({ ...newPost, price: e.target.value })}
                      className="pl-9"
                    />
                  </div>
                </div>
              )}
              <Button
                onClick={handleCreatePost}
                disabled={
                  creating || uploading || !newPost.title.trim() ||
                  (newPost.accessLevel === "ppv" && (!newPost.price || parseFloat(newPost.price) <= 0))
                }
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading media... {uploadProgress}%
                  </>
                ) : creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish Post"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
            <p className="font-medium text-sm">No posts yet</p>
            <p className="text-xs mt-1">Create your first post to get started</p>
          </div>
        ) : [...posts]
          // Sort: pinned posts first, then by createdAt desc
          .sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          })
          .map((post) => (
          <Card key={post.id} className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    {typeIcon(post.type)}
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-semibold truncate">
                      {post.title || "Untitled"}
                    </CardTitle>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {post.isPinned && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                      <Pin className="w-2.5 h-2.5 mr-0.5" />
                      Pinned
                    </Badge>
                  )}
                  {post.isLocked && <Lock className="w-3 h-3 text-amber-400" />}
                  {!post.isLocked && <Globe className="w-3 h-3 text-muted-foreground" />}
                  {post.status === "draft" && (
                    <Badge variant="outline" className="text-xs ml-1">Draft</Badge>
                  )}
                  {post.price != null && post.price > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">${post.price}</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-6 w-6 ml-auto ${post.isPinned ? "text-primary hover:text-primary/70" : "text-muted-foreground hover:text-primary"}`}
                    onClick={(e) => { e.stopPropagation(); handleTogglePin(post.id, !!post.isPinned); }}
                    disabled={pinningId === post.id}
                    title={post.isPinned ? "Unpin post" : "Pin post"}
                  >
                    {pinningId === post.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : post.isPinned ? (
                      <PinOff className="w-3 h-3" />
                    ) : (
                      <Pin className="w-3 h-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }}
                    disabled={deletingId === post.id}
                  >
                    {deletingId === post.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                {post.content || "No content"}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {post.likesCount || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {post.commentsCount || 0}
                  </span>
                </div>
                <span>
                  {post.createdAt
                    ? new Date(post.createdAt).toLocaleDateString()
                    : "Recently"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
