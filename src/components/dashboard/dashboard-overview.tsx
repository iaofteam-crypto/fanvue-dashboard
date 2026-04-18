"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  DollarSign,
  MessageSquare,
  FileText,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DashboardStats {
  subscribers: number;
  earnings: number;
  messages: number;
  posts: number;
  subscriberChange: number;
  earningsChange: number;
}

export function DashboardOverview({ connected }: { connected: boolean }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string>("Never");

  const fetchStats = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const [earningsRes, subscribersRes, chatsRes, postsRes] = await Promise.allSettled([
        fetch("/api/fanvue/insights/earnings-summary"),
        fetch("/api/fanvue/insights/subscribers"),
        fetch("/api/fanvue/chats"),
        fetch("/api/fanvue/posts"),
      ]);

      const earnings = earningsRes.status === "fulfilled" ? await earningsRes.value.json() : null;
      const subscribers = subscribersRes.status === "fulfilled" ? await subscribersRes.value.json() : null;
      const chats = chatsRes.status === "fulfilled" ? await chatsRes.value.json() : null;
      const posts = postsRes.status === "fulfilled" ? await postsRes.value.json() : null;

      setStats({
        subscribers: subscribers?.total || subscribers?.count || 0,
        earnings: earnings?.total || earnings?.totalEarnings || 0,
        messages: chats?.total || chats?.data?.length || chats?.length || 0,
        posts: posts?.total || posts?.data?.length || posts?.length || 0,
        subscriberChange: subscribers?.growth || 0,
        earningsChange: earnings?.growth || 0,
      });

      setLastSync(new Date().toLocaleTimeString());
    } catch {
      // Use demo data if API fails
      setStats({
        subscribers: 1247,
        earnings: 3842.5,
        messages: 89,
        posts: 156,
        subscriberChange: 12.5,
        earningsChange: 8.3,
      });
      setLastSync("Demo data");
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Activity className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Connect Your Fanvue Account</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Link your Fanvue account to view real-time analytics, manage messages, track earnings, and optimize your creator operations.
        </p>
        <Button
          size="lg"
          onClick={() => (window.location.href = "/api/fanvue/authorize")}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8"
        >
          <DollarSign className="w-5 h-5 mr-2" />
          Connect Fanvue
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Secure OAuth2 PKCE authentication — your credentials never leave our servers
        </p>
      </div>
    );
  }

  const statCards = [
    {
      title: "Subscribers",
      value: stats?.subscribers.toLocaleString() || "—",
      change: stats?.subscriberChange,
      icon: Users,
      color: "text-emerald-400",
    },
    {
      title: "Earnings",
      value: stats?.earnings ? `$${stats.earnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
      change: stats?.earningsChange,
      icon: DollarSign,
      color: "text-emerald-400",
    },
    {
      title: "Messages",
      value: stats?.messages.toLocaleString() || "—",
      icon: MessageSquare,
      color: "text-sky-400",
    },
    {
      title: "Posts",
      value: stats?.posts.toLocaleString() || "—",
      icon: FileText,
      color: "text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview of your Fanvue creator operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs">
            Last sync: {lastSync}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              {card.change !== undefined && card.change !== 0 && (
                <div className="flex items-center text-xs mt-1">
                  {card.change > 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-400 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400 mr-1" />
                  )}
                  <span className={card.change > 0 ? "text-emerald-400" : "text-red-400"}>
                    {card.change > 0 ? "+" : ""}
                    {card.change}%
                  </span>
                  <span className="text-muted-foreground ml-1">vs last period</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { icon: MessageSquare, text: "New message from fan", time: "2 min ago", color: "text-sky-400" },
              { icon: Users, text: "New subscriber joined", time: "15 min ago", color: "text-emerald-400" },
              { icon: DollarSign, text: "Tip received — $25.00", time: "1 hour ago", color: "text-amber-400" },
              { icon: FileText, text: "Post published successfully", time: "3 hours ago", color: "text-violet-400" },
              { icon: Users, text: "Subscriber milestone reached: 1,200+", time: "Yesterday", color: "text-emerald-400" },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <activity.icon className={`w-4 h-4 ${activity.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{activity.text}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
