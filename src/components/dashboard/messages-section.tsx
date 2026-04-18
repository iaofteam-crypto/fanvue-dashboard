"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, ArrowLeft, User, Loader2, MessageSquare, Search, ImageIcon, Film, Music, FileText, Clock, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Chat {
  id: string;
  fan?: { id: string; username?: string; displayName?: string; avatarUrl?: string };
  lastMessage?: string;
  unreadCount?: number;
  updatedAt?: string;
  participant?: { username?: string; displayName?: string };
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: { id: string; username?: string };
  mediaUuids?: string[];
}

interface ChatMediaItem {
  uuid: string;
  type: "image" | "video" | "audio" | "document";
  mimeType?: string;
  url?: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  width?: number;
  height?: number;
  createdAt?: string;
  senderId?: string;
  senderName?: string;
  messageId?: string;
}

type MediaTypeFilter = "all" | "image" | "video" | "audio" | "document";

// ─── Demo Data ──────────────────────────────────────────────────────────────

const DEMO_CHAT_MEDIA: Record<string, ChatMediaItem[]> = {
  "1": [
    { uuid: "media_1a", type: "image", mimeType: "image/jpeg", url: "/placeholder.jpg", fileName: "photo_1.jpg", fileSize: 2400000, width: 1200, height: 800, createdAt: "2026-04-18T10:00:00Z", senderId: "fan", senderName: "Alex Johnson", messageId: "m1" },
    { uuid: "media_1b", type: "image", mimeType: "image/png", url: "/placeholder.jpg", fileName: "selfie.png", fileSize: 3100000, width: 1080, height: 1080, createdAt: "2026-04-18T09:30:00Z", senderId: "fan", senderName: "Alex Johnson", messageId: "m1" },
    { uuid: "media_1c", type: "video", mimeType: "video/mp4", url: "/placeholder.mp4", fileName: "clip_1.mp4", fileSize: 15000000, duration: 45, createdAt: "2026-04-17T20:00:00Z", senderId: "me", senderName: "You", messageId: "m2" },
    { uuid: "media_1d", type: "image", mimeType: "image/jpeg", url: "/placeholder.jpg", fileName: "photo_2.jpg", fileSize: 1800000, width: 900, height: 1200, createdAt: "2026-04-17T15:00:00Z", senderId: "fan", senderName: "Alex Johnson", messageId: "m3" },
    { uuid: "media_1e", type: "audio", mimeType: "audio/mpeg", url: "/placeholder.mp3", fileName: "voice_note.mp3", fileSize: 850000, duration: 32, createdAt: "2026-04-17T12:00:00Z", senderId: "fan", senderName: "Alex Johnson", messageId: "m3" },
    { uuid: "media_1f", type: "document", mimeType: "application/pdf", url: "/placeholder.pdf", fileName: "schedule.pdf", fileSize: 420000, createdAt: "2026-04-16T18:00:00Z", senderId: "me", senderName: "You", messageId: "m2" },
  ],
  "2": [
    { uuid: "media_2a", type: "image", mimeType: "image/jpeg", url: "/placeholder.jpg", fileName: "sarah_photo.jpg", fileSize: 2800000, width: 1000, height: 1000, createdAt: "2026-04-18T08:00:00Z", senderId: "fan", senderName: "Sarah M.", messageId: "m4" },
    { uuid: "media_2b", type: "video", mimeType: "video/mp4", url: "/placeholder.mp4", fileName: "reaction.mp4", fileSize: 8000000, duration: 12, createdAt: "2026-04-17T22:00:00Z", senderId: "fan", senderName: "Sarah M.", messageId: "m4" },
  ],
  "3": [
    { uuid: "media_3a", type: "image", mimeType: "image/jpeg", url: "/placeholder.jpg", fileName: "mike_pic.jpg", fileSize: 1900000, width: 1200, height: 675, createdAt: "2026-04-18T06:00:00Z", senderId: "fan", senderName: "Mike D.", messageId: "m5" },
  ],
  "4": [
    { uuid: "media_4a", type: "image", mimeType: "image/png", url: "/placeholder.jpg", fileName: "jordan_art.png", fileSize: 5200000, width: 2000, height: 2000, createdAt: "2026-04-17T14:00:00Z", senderId: "fan", senderName: "Jordan K.", messageId: "m6" },
    { uuid: "media_4b", type: "image", mimeType: "image/jpeg", url: "/placeholder.jpg", fileName: "fan_photo.jpg", fileSize: 2100000, width: 800, height: 1000, createdAt: "2026-04-16T10:00:00Z", senderId: "fan", senderName: "Jordan K.", messageId: "m6" },
    { uuid: "media_4c", type: "image", mimeType: "image/jpeg", url: "/placeholder.jpg", fileName: "sunset.jpg", fileSize: 3500000, width: 1920, height: 1080, createdAt: "2026-04-15T20:00:00Z", senderId: "me", senderName: "You", messageId: "m7" },
  ],
  "5": [
    { uuid: "media_5a", type: "video", mimeType: "video/mp4", url: "/placeholder.mp4", fileName: "story.mp4", fileSize: 25000000, duration: 90, createdAt: "2026-04-18T03:00:00Z", senderId: "me", senderName: "You", messageId: "m8" },
    { uuid: "media_5b", type: "image", mimeType: "image/jpeg", url: "/placeholder.jpg", fileName: "preview.jpg", fileSize: 1400000, width: 1080, height: 1920, createdAt: "2026-04-17T23:00:00Z", senderId: "fan", senderName: "Chris P.", messageId: "m9" },
    { uuid: "media_5c", type: "audio", mimeType: "audio/mpeg", url: "/placeholder.mp3", fileName: "voice_msg.mp3", fileSize: 1200000, duration: 58, createdAt: "2026-04-17T20:00:00Z", senderId: "fan", senderName: "Chris P.", messageId: "m9" },
    { uuid: "media_5d", type: "document", mimeType: "application/pdf", url: "/placeholder.pdf", fileName: "content_plan.pdf", fileSize: 780000, createdAt: "2026-04-16T16:00:00Z", senderId: "me", senderName: "You", messageId: "m8" },
    { uuid: "media_5e", type: "image", mimeType: "image/jpeg", url: "/placeholder.jpg", fileName: "bts_1.jpg", fileSize: 2600000, width: 1440, height: 1080, createdAt: "2026-04-16T14:00:00Z", senderId: "me", senderName: "You", messageId: "m8" },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getMediaTypeIcon(type: string) {
  switch (type) {
    case "image": return ImageIcon;
    case "video": return Film;
    case "audio": return Music;
    case "document": return FileText;
    default: return FileText;
  }
}

function getMediaTypeColor(type: string): string {
  switch (type) {
    case "image": return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    case "video": return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    case "audio": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "document": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    default: return "bg-muted text-muted-foreground border-border/50";
  }
}

function getMediaGradient(type: string): string {
  switch (type) {
    case "image": return "from-sky-500/20 to-sky-600/5";
    case "video": return "from-violet-500/20 to-violet-600/5";
    case "audio": return "from-amber-500/20 to-amber-600/5";
    case "document": return "from-emerald-500/20 to-emerald-600/5";
    default: return "from-muted to-muted/50";
  }
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return "Unknown";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MessagesSection({ connected }: { connected: boolean }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  // Chat Media state
  const [showMedia, setShowMedia] = useState(false);
  const [chatMedia, setChatMedia] = useState<ChatMediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>("all");
  const [mediaSearch, setMediaSearch] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<ChatMediaItem | null>(null);

  const fetchChats = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const res = await fetch("/api/fanvue/chats");
      if (res.ok) {
        const data = await res.json();
        const chatList = Array.isArray(data) ? data : data?.data || data?.chats || [];
        setChats(chatList);
      }
    } catch {
      toast.error("Failed to load conversations");
      setChats([
        { id: "1", fan: { id: "f1", displayName: "Alex Johnson" }, lastMessage: "Hey! Love your latest content 🔥", unreadCount: 2 },
        { id: "2", fan: { id: "f2", displayName: "Sarah M." }, lastMessage: "Thanks for the reply!", unreadCount: 0 },
        { id: "3", fan: { id: "f3", displayName: "Mike D." }, lastMessage: "When's the next drop?", unreadCount: 1 },
        { id: "4", fan: { id: "f4", displayName: "Jordan K." }, lastMessage: "You're amazing! 💕", unreadCount: 0 },
        { id: "5", fan: { id: "f5", displayName: "Chris P." }, lastMessage: "Can't wait for more content", unreadCount: 3 },
      ]);
    } finally {
      setLoading(false);
    }
  }, [connected]);

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fanvue/chats/${chatId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgList = Array.isArray(data) ? data : data?.data || data?.messages || [];
        setMessages(msgList);
        setLoading(false);
        return;
      }
    } catch {
      toast.error("Failed to load messages");
    }
    setMessages([
      { id: "m1", senderId: "fan", content: "Hey! Love your latest content 🔥", createdAt: new Date(Date.now() - 600000).toISOString() },
      { id: "m2", senderId: "me", content: "Thank you so much! Glad you enjoyed it 💚", createdAt: new Date(Date.now() - 300000).toISOString() },
      { id: "m3", senderId: "fan", content: "When's the next drop?", createdAt: new Date(Date.now() - 120000).toISOString() },
    ]);
    setLoading(false);
  }, []);

  // ─── Fetch Chat Media ─────────────────────────────────────────────────────

  const fetchChatMedia = useCallback(async (chatId: string) => {
    setLoadingMedia(true);
    try {
      const res = await fetch(`/api/fanvue/chats/${chatId}/media`);
      if (res.ok) {
        const data = await res.json();
        const mediaList = Array.isArray(data)
          ? data as ChatMediaItem[]
          : data?.data || data?.media || [];
        if (mediaList.length > 0) {
          setChatMedia(mediaList as ChatMediaItem[]);
          setLoadingMedia(false);
          return;
        }
      }
    } catch {
      toast.error("Failed to load chat media");
    }
    // Demo fallback
    setChatMedia(DEMO_CHAT_MEDIA[chatId] || []);
    setLoadingMedia(false);
  }, []);

  // ─── Resolve Media UUIDs for a specific message ───────────────────────────

  const resolveMessageMedia = useCallback(async (messageId: string) => {
    try {
      const res = await fetch(`/api/fanvue/chat-messages/${messageId}/media`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data?.data || data?.media || [];
      }
    } catch {
      // silent fallback
    }
    return [];
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChat(chatId);
    setShowMedia(false);
    setChatMedia([]);
    setSelectedMedia(null);
    setMediaTypeFilter("all");
    setMediaSearch("");
    fetchMessages(chatId);
  };

  const handleToggleMedia = () => {
    if (!selectedChat) return;
    const newShowMedia = !showMedia;
    setShowMedia(newShowMedia);
    setSelectedMedia(null);
    if (newShowMedia && chatMedia.length === 0) {
      fetchChatMedia(selectedChat);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    setSending(true);
    try {
      const res = await fetch(`/api/fanvue/chats/${selectedChat}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: `m_${Date.now()}`,
            senderId: "me",
            content: newMessage,
            createdAt: new Date().toISOString(),
          },
        ]);
        setNewMessage("");
      }
    } catch {
      toast.error("Failed to send message");
      setMessages((prev) => [
        ...prev,
        {
          id: `m_${Date.now()}`,
          senderId: "me",
          content: newMessage,
          createdAt: new Date().toISOString(),
        },
      ]);
      setNewMessage("");
    } finally {
      setSending(false);
    }
  };

  // ─── Filtered media ───────────────────────────────────────────────────────

  const filteredMedia = chatMedia.filter((item) => {
    const matchesType = mediaTypeFilter === "all" || item.type === mediaTypeFilter;
    const matchesSearch = !mediaSearch
      || (item.fileName || "").toLowerCase().includes(mediaSearch.toLowerCase())
      || (item.senderName || "").toLowerCase().includes(mediaSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const mediaCounts = {
    all: chatMedia.length,
    image: chatMedia.filter((m) => m.type === "image").length,
    video: chatMedia.filter((m) => m.type === "video").length,
    audio: chatMedia.filter((m) => m.type === "audio").length,
    document: chatMedia.filter((m) => m.type === "document").length,
  };

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
        <p className="font-medium text-sm">Messages unavailable</p>
        <p className="text-xs mt-1">Connect your Fanvue account to view messages</p>
      </div>
    );
  }

  const filteredChats = chats.filter((chat) => {
    const name = chat.fan?.displayName || chat.participant?.username || `Chat ${chat.id}`;
    const matchesSearch = !searchQuery || name.toLowerCase().includes(searchQuery.toLowerCase()) || (chat.lastMessage || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesUnread = !filterUnreadOnly || (chat.unreadCount && chat.unreadCount > 0);
    return matchesSearch && matchesUnread;
  });

  // ─── Chat Detail View (Messages + Media) ──────────────────────────────────

  if (selectedChat) {
    const chatName = chats.find((c) => c.id === selectedChat)?.fan?.displayName
      || chats.find((c) => c.id === selectedChat)?.participant?.username
      || "Chat";

    return (
      <div className="h-[calc(100vh-10rem)] flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedChat(null);
              setShowMedia(false);
              setChatMedia([]);
              setSelectedMedia(null);
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{chatName}</p>
              <p className="text-xs text-muted-foreground">Fan</p>
            </div>
          </div>
          {/* Messages / Media toggle */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
            <Button
              variant={!showMedia ? "default" : "ghost"}
              size="sm"
              onClick={() => { setShowMedia(false); setSelectedMedia(null); }}
              className="text-xs h-7 px-3"
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Messages
            </Button>
            <Button
              variant={showMedia ? "default" : "ghost"}
              size="sm"
              onClick={handleToggleMedia}
              className="text-xs h-7 px-3"
            >
              <ImageIcon className="w-3 h-3 mr-1" />
              Media
              {chatMedia.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4 min-w-4">
                  {chatMedia.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {showMedia ? (
          /* ─── Media Gallery View ─────────────────────────────────────────── */
          <Card className="flex-1 flex flex-col bg-card/50 border-border/50 min-h-0">
            {selectedMedia ? (
              /* Media Detail View */
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-3 p-4 border-b border-border/50">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedMedia(null)} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedMedia.fileName || `Media ${selectedMedia.uuid}`}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getMediaTypeColor(selectedMedia.type)}`}>
                        {selectedMedia.type}
                      </Badge>
                      {selectedMedia.fileSize && (
                        <span className="text-xs text-muted-foreground">{formatFileSize(selectedMedia.fileSize)}</span>
                      )}
                      {selectedMedia.duration && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {formatDuration(selectedMedia.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedMedia.width && selectedMedia.height && (
                    <span className="text-xs text-muted-foreground">
                      {selectedMedia.width} x {selectedMedia.height}
                    </span>
                  )}
                </div>
                {/* Media Preview Placeholder */}
                <div className="flex-1 flex items-center justify-center p-6">
                  <div className={`w-full max-w-2xl aspect-video rounded-xl bg-gradient-to-br ${getMediaGradient(selectedMedia.type)} border border-border/50 flex flex-col items-center justify-center gap-3`}>
                    {(() => {
                      const IconComp = getMediaTypeIcon(selectedMedia.type);
                      return <IconComp className="w-12 h-12 text-muted-foreground/40" />;
                    })()}
                    <p className="text-sm text-muted-foreground">{selectedMedia.fileName || selectedMedia.uuid}</p>
                    {selectedMedia.mimeType && (
                      <p className="text-xs text-muted-foreground/70">{selectedMedia.mimeType}</p>
                    )}
                  </div>
                </div>
                {/* Media Metadata */}
                <div className="p-4 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Sender</p>
                    <p className="text-sm font-medium">{selectedMedia.senderName || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Shared</p>
                    <p className="text-sm font-medium">{relativeTime(selectedMedia.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Size</p>
                    <p className="text-sm font-medium">{selectedMedia.fileSize ? formatFileSize(selectedMedia.fileSize) : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">UUID</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{selectedMedia.uuid}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Media Grid */
              <>
                {/* Media Filter Bar */}
                <div className="p-3 border-b border-border/50 flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[150px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search media..."
                      value={mediaSearch}
                      onChange={(e) => setMediaSearch(e.target.value)}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  <div className="flex gap-1">
                    {([
                      { key: "all" as const, icon: Filter, label: "All" },
                      { key: "image" as const, icon: ImageIcon, label: "Images" },
                      { key: "video" as const, icon: Film, label: "Video" },
                      { key: "audio" as const, icon: Music, label: "Audio" },
                      { key: "document" as const, icon: FileText, label: "Docs" },
                    ]).map((f) => (
                      <Button
                        key={f.key}
                        variant={mediaTypeFilter === f.key ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setMediaTypeFilter(f.key)}
                        className="text-xs h-7 px-2 gap-1"
                      >
                        <f.icon className="w-3 h-3" />
                        {mediaCounts[f.key]}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Media Grid Content */}
                <ScrollArea className="flex-1 p-3">
                  {loadingMedia ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mr-2" />
                      <span className="text-sm text-muted-foreground">Loading media...</span>
                    </div>
                  ) : filteredMedia.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="font-medium text-sm">
                        {mediaSearch || mediaTypeFilter !== "all" ? "No matching media" : "No shared media"}
                      </p>
                      <p className="text-xs mt-1">
                        {mediaSearch || mediaTypeFilter !== "all"
                          ? "Try adjusting your search or filter"
                          : "Media shared in this conversation will appear here"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {filteredMedia.map((item) => {
                        const IconComp = getMediaTypeIcon(item.type);
                        return (
                          <button
                            key={item.uuid}
                            onClick={() => setSelectedMedia(item)}
                            className="group relative aspect-square rounded-xl bg-gradient-to-br border border-border/50 hover:border-primary/50 transition-all overflow-hidden"
                            style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }}
                          >
                            {/* Background gradient */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${getMediaGradient(item.type)}`} />
                            
                            {/* Icon */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                              <IconComp className="w-8 h-8 text-muted-foreground/50 group-hover:text-muted-foreground/70 transition-colors" />
                              <p className="text-[10px] text-muted-foreground truncate px-2 max-w-full">
                                {item.fileName || item.uuid}
                              </p>
                            </div>

                            {/* Type Badge */}
                            <Badge
                              variant="outline"
                              className={`absolute top-1.5 left-1.5 text-[9px] px-1 py-0 ${getMediaTypeColor(item.type)}`}
                            >
                              {item.type}
                            </Badge>

                            {/* Duration badge for video/audio */}
                            {item.duration && (
                              <Badge variant="secondary" className="absolute bottom-1.5 right-1.5 text-[9px] px-1 py-0 bg-black/60 text-white border-0">
                                {formatDuration(item.duration)}
                              </Badge>
                            )}

                            {/* Size badge */}
                            {item.fileSize && (
                              <span className="absolute bottom-1.5 left-1.5 text-[9px] text-muted-foreground/70 bg-black/40 px-1 py-0 rounded">
                                {formatFileSize(item.fileSize)}
                              </span>
                            )}

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Media Summary Footer */}
                {!loadingMedia && chatMedia.length > 0 && (
                  <div className="p-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {filteredMedia.length} of {chatMedia.length} media items
                    </span>
                    <div className="flex items-center gap-3">
                      {mediaCounts.image > 0 && (
                        <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3 text-sky-400" /> {mediaCounts.image}</span>
                      )}
                      {mediaCounts.video > 0 && (
                        <span className="flex items-center gap-1"><Film className="w-3 h-3 text-violet-400" /> {mediaCounts.video}</span>
                      )}
                      {mediaCounts.audio > 0 && (
                        <span className="flex items-center gap-1"><Music className="w-3 h-3 text-amber-400" /> {mediaCounts.audio}</span>
                      )}
                      {mediaCounts.document > 0 && (
                        <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-emerald-400" /> {mediaCounts.document}</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        ) : (
          /* ─── Messages View (original) ────────────────────────────────────── */
          <Card className="flex-1 flex flex-col bg-card/50 border-border/50">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderId === "me" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        msg.senderId === "me"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-xs mt-1 ${msg.senderId === "me" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-border/50">
              <div className="flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="min-h-[44px] max-h-[120px] resize-none"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sending || !newMessage.trim()}
                  size="icon"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ─── Chat List View ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-muted-foreground text-sm">
            Manage conversations with your fans
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={filterUnreadOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
          className="flex-shrink-0"
        >
          Unread only
          {chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0) > 0 && (
            <Badge variant={filterUnreadOnly ? "secondary" : "destructive"} className="ml-2">
              {chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
            </Badge>
          )}
        </Button>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">
            Inbox
            <span className="text-muted-foreground font-normal ml-2">
              {filteredChats.length} of {chats.length} conversations
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(100vh-16rem)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="font-medium text-sm">No matching conversations</p>
                <p className="text-xs mt-1">Try adjusting your search or filter</p>
              </div>
            ) : (
              <div>
                {filteredChats.map((chat) => {
                  const mediaCount = DEMO_CHAT_MEDIA[chat.id]?.length || 0;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => handleSelectChat(chat.id)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b border-border/30 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">
                            {chat.fan?.displayName || chat.participant?.username || `Chat ${chat.id}`}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {chat.updatedAt
                              ? new Date(chat.updatedAt).toLocaleDateString()
                              : "Recently"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {chat.lastMessage || "No messages yet"}
                          </p>
                          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                            {mediaCount > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-sky-500/10 text-sky-400 border-sky-500/20">
                                <ImageIcon className="w-2.5 h-2.5 mr-0.5" />
                                {mediaCount}
                              </Badge>
                            )}
                            {chat.unreadCount && chat.unreadCount > 0 && (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
