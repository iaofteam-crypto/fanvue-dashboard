"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, Zap, BarChart3, Palette } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const MODE_OPTIONS = [
  { id: "ops", label: "Operations", icon: Zap, description: "Daily operations & tasks" },
  { id: "analyst", label: "Analyst", icon: BarChart3, description: "Data analysis & insights" },
  { id: "creative", label: "Creative", icon: Palette, description: "Content strategy & ideas" },
  { id: "ceo", label: "CEO", icon: Sparkles, description: "Strategic planning" },
] as const;

type AelianaMode = (typeof MODE_OPTIONS)[number]["id"];

export function AelianaChatSection() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm AELIANA, your AI Chief Operations Officer. I can help you analyze your Fanvue data, optimize your content strategy, manage fan relationships, and grow your revenue. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AelianaMode>("ops");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages
            .concat(userMessage)
            .map((m) => ({ role: m.role, content: m.content })),
          mode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const assistantMessage: Message = {
          id: `msg_${Date.now()}_response`,
          role: "assistant",
          content: data.message || "I couldn't generate a response. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const assistantMessage: Message = {
          id: `msg_${Date.now()}_error`,
          role: "assistant",
          content: "Sorry, I encountered an error processing your request. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch {
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_fallback`,
        role: "assistant",
        content: "I'm currently in demo mode. In production, I'll connect to your real Fanvue data to provide personalized insights and recommendations. Try asking me about content strategy, fan engagement, or revenue optimization!",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setLoading(false);
    }
  };

  const currentModeConfig = MODE_OPTIONS.find((m) => m.id === mode)!;

  return (
    <div className="space-y-4 h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AELIANA</h1>
          <p className="text-muted-foreground text-sm">
            Your AI Chief Operations Officer
          </p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2 flex-wrap">
        {MODE_OPTIONS.map((m) => (
          <Button
            key={m.id}
            variant={mode === m.id ? "default" : "outline"}
            size="sm"
            onClick={() => setMode(m.id)}
            className={
              mode === m.id
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : ""
            }
          >
            <m.icon className="w-3.5 h-3.5 mr-1.5" />
            {m.label}
          </Button>
        ))}
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col bg-card/50 border-border/50 min-h-0">
        <CardHeader className="py-3 border-b border-border/30">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            {currentModeConfig.label} Mode
            <Badge variant="outline" className="text-xs ml-auto">
              {currentModeConfig.description}
            </Badge>
          </CardTitle>
        </CardHeader>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </p>
                  <p
                    className={`text-xs mt-1.5 ${
                      msg.role === "user"
                        ? "text-primary-foreground/60"
                        : "text-muted-foreground"
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      AELIANA is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border/50">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask AELIANA anything (${currentModeConfig.label} mode)...`}
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              size="icon"
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex-shrink-0"
            >
              {loading ? (
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
