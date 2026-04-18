"use client";

import { useState, useEffect, useCallback } from "react";
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
  price?: number;
  media?: Array<{ type?: string; url?: string }>;
}

export function ContentSection({ connected }: { connected: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", type: "text", accessLevel: "all" });

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
      // ignore
    }
    // Demo data
    setPosts([
      { id: "1", title: "Behind the scenes 📸", content: "Exclusive BTS content from today's shoot!", type: "photo", status: "published", likesCount: 245, commentsCount: 32, isLocked: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "2", title: "Weekly Q&A", content: "Answering your questions this week!", type: "text", status: "published", likesCount: 189, commentsCount: 56, isLocked: false, createdAt: new Date(Date.now() - 172800000).toISOString() },
      { id: "3", title: "Premium photo set 🎨", content: "Exclusive collection for subscribers only", type: "photo", status: "published", likesCount: 412, commentsCount: 28, isLocked: true, price: 9.99, createdAt: new Date(Date.now() - 259200000).toISOString() },
      { id: "4", title: "Day in my life", content: "Vlog from yesterday", type: "video", status: "published", likesCount: 567, commentsCount: 89, isLocked: false, createdAt: new Date(Date.now() - 345600000).toISOString() },
      { id: "5", title: "Cooking tutorial", content: "Making my favorite pasta recipe", type: "video", status: "draft", likesCount: 0, commentsCount: 0, isLocked: false, createdAt: new Date().toISOString() },
    ]);
    setLoading(false);
  }, [connected]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCreatePost = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/fanvue/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPost.title,
          content: newPost.content,
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        setNewPost({ title: "", content: "", type: "text", accessLevel: "all" });
        fetchPosts();
      }
    } catch {
      toast.error("Failed to create post");
    } finally {
      setCreating(false);
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
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
              <Button
                onClick={handleCreatePost}
                disabled={creating || !newPost.title.trim()}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {creating ? (
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
        ) : posts.map((post) => (
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
                  {post.isLocked && <Lock className="w-3 h-3 text-amber-400" />}
                  {!post.isLocked && <Globe className="w-3 h-3 text-muted-foreground" />}
                  {post.status === "draft" && (
                    <Badge variant="outline" className="text-xs ml-1">Draft</Badge>
                  )}
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
