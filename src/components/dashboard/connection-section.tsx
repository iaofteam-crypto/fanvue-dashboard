"use client";

import { useState } from "react";
import {
  Link2,
  Unlink,
  Shield,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Key,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ConnectionSection({
  connected,
  onConnect,
  onDisconnect,
}: {
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setTimeout(() => setSyncing(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Connection</h1>
        <p className="text-muted-foreground text-sm">
          Manage your Fanvue account connection and API settings
        </p>
      </div>

      {/* Connection Status */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Fanvue Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium text-sm">
                  {connected ? "Connected" : "Not Connected"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connected
                    ? "Your Fanvue account is linked and data is syncing"
                    : "Connect to access your Fanvue data"}
                </p>
              </div>
            </div>
            <Badge
              className={
                connected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-muted text-muted-foreground"
              }
            >
              {connected ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="flex gap-2">
            {connected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  Sync Now
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDisconnect}
                >
                  <Unlink className="w-4 h-4 mr-1.5" />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={onConnect}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Link2 className="w-4 h-4 mr-1.5" />
                Connect Fanvue
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* OAuth Details */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="w-4 h-4" />
            OAuth Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Grant Type", value: "Authorization Code + PKCE" },
            { label: "Scopes", value: "openid, offline_access, read:self, read:insights, read:fan, read:chat, read:media, read:post, write:chat, write:media, write:post" },
            { label: "Token Storage", value: "Encrypted database (httpOnly cookies)" },
            { label: "Auto-Refresh", value: "Enabled (5 min before expiry)" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-2 border-b border-border/30 last:border-0"
            >
              <span className="text-xs text-muted-foreground sm:w-32 flex-shrink-0">
                {item.label}
              </span>
              <span className="text-sm font-mono break-all">{item.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sync Schedule */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Sync Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { task: "Fanvue Data Sync", schedule: "Every hour", icon: Zap },
            { task: "Repository Sync", schedule: "Every 30 minutes", icon: RefreshCw },
          ].map((item) => (
            <div
              key={item.task}
              className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
            >
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{item.task}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {item.schedule}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* External Links */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { label: "Fanvue Creator Dashboard", url: "https://www.fanvue.com" },
              { label: "GitHub Repository", url: "https://github.com/iaofteam-crypto/fanvue_ops" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline py-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {link.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
