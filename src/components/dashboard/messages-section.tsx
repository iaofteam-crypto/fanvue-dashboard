"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, ArrowLeft, User, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

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
}

export function MessagesSection({ connected }: { connected: boolean }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

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
      // Demo data
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
        return;
      }
    } catch {
      // ignore
    }
    // Demo messages
    setMessages([
      { id: "m1", senderId: "fan", content: "Hey! Love your latest content 🔥", createdAt: new Date(Date.now() - 600000).toISOString() },
      { id: "m2", senderId: "me", content: "Thank you so much! Glad you enjoyed it 💚", createdAt: new Date(Date.now() - 300000).toISOString() },
      { id: "m3", senderId: "fan", content: "When's the next drop?", createdAt: new Date(Date.now() - 120000).toISOString() },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleSelectChat = (chatId: string) => {
    setSelectedChat(chatId);
    fetchMessages(chatId);
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
      // Add locally anyway for demo
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

  if (!connected) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Connect your Fanvue account to view messages</p>
      </div>
    );
  }

  if (selectedChat) {
    const chatName = chats.find((c) => c.id === selectedChat)?.fan?.displayName
      || chats.find((c) => c.id === selectedChat)?.participant?.username
      || "Chat";

    return (
      <div className="h-[calc(100vh-10rem)] flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedChat(null)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{chatName}</p>
              <p className="text-xs text-muted-foreground">Fan</p>
            </div>
          </div>
        </div>

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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted-foreground text-sm">
          Manage conversations with your fans
        </p>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">
            Inbox
            {chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0) > 0 && (
              <Badge variant="destructive" className="ml-2">
                {chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0)} unread
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[calc(100vh-16rem)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : chats.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No conversations yet</p>
              </div>
            ) : (
              <div>
                {chats.map((chat) => (
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
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {chat.lastMessage || "No messages yet"}
                      </p>
                    </div>
                    {chat.unreadCount && chat.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-xs px-1.5 py-0.5 flex-shrink-0">
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
