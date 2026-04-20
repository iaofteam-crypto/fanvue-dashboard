"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Webhook,
  Lock,
  Activity,
  FileCheck,
  ScrollText,
  Gauge,
  Eye,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";

interface SecurityStatus {
  webhookSecretSet: boolean;
  auditLogCount: number;
  rateLimitTiers: {
    public: { maxRequests: number; windowMs: number };
    authenticated: { maxRequests: number; windowMs: number };
    expensive: { maxRequests: number; windowMs: number };
    webhook: { maxRequests: number; windowMs: number };
  };
}

interface IntegrationsSectionProps {
  connected: boolean;
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <Badge
      className={
        active
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-red-500/10 text-red-400 border-red-500/20"
      }
    >
      {active ? (
        <CheckCircle2 className="w-3 h-3 mr-1" />
      ) : (
        <XCircle className="w-3 h-3 mr-1" />
      )}
      {label}
    </Badge>
  );
}

export function IntegrationsSection({ connected }: IntegrationsSectionProps) {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/security-status");
        if (res.ok) {
          const data = await res.json();
          setSecurityStatus(data);
        }
      } catch {
        // Silently fail — show defaults
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  if (!connected) {
    return (
      <EmptyState
        icon={Shield}
        title="Security & Integrations"
        description="Connect your Fanvue account to view API key status, security configuration, and integration health."
        variant="info"
      />
    );
  }

  const webhookSecretSet = securityStatus?.webhookSecretSet ?? false;
  const auditLogCount = securityStatus?.auditLogCount ?? 0;
  const tiers = securityStatus?.rateLimitTiers ?? null;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Security &amp; Integrations
        </h1>
        <p className="text-muted-foreground text-sm">
          API key status, webhook configuration, and security posture overview
        </p>
      </div>

      {/* Integration Status Card */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Integration Status
          </CardTitle>
          <CardDescription>
            Current status of all external integrations and security services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fanvue API Connection */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Fanvue API Connection</p>
                <p className="text-xs text-muted-foreground">
                  OAuth 2.0 with PKCE flow
                </p>
              </div>
            </div>
            <StatusBadge active={connected} label={connected ? "Connected" : "Disconnected"} />
          </div>

          {/* Webhook Configuration */}
          <div className="flex items-center justify-between py-2 border-t border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-sky-500/10 flex items-center justify-center">
                <Webhook className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Webhook Configuration</p>
                <p className="text-xs text-muted-foreground">
                  HMAC-SHA256 signature verification
                </p>
              </div>
            </div>
            {loading ? (
              <Badge variant="outline" className="text-xs">Checking...</Badge>
            ) : (
              <StatusBadge
                active={webhookSecretSet}
                label={webhookSecretSet ? "Secret Set" : "Not Set"}
              />
            )}
          </div>

          {/* Security Headers (CSP) */}
          <div className="flex items-center justify-between py-2 border-t border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <Lock className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Security Headers (CSP)</p>
                <p className="text-xs text-muted-foreground">
                  Content-Security-Policy, X-Frame-Options, Referrer-Policy
                </p>
              </div>
            </div>
            <StatusBadge active={true} label="Active" />
          </div>
        </CardContent>
      </Card>

      {/* Security Settings Card */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Security Settings
          </CardTitle>
          <CardDescription>
            Rate limiting, input validation, and audit logging configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rate Limit Tiers */}
          <div className="py-2">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium text-sm">Rate Limit Tiers</p>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-md bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : tiers ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(tiers).map(([tier, config]) => (
                  <div
                    key={tier}
                    className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs font-medium capitalize">{tier.replace("-", " ")}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {config.maxRequests} req / {config.windowMs / 1000}s
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Unable to load rate limit configuration.</p>
            )}
          </div>

          {/* CSP Policy Summary */}
          <div className="flex items-center justify-between py-2 border-t border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center">
                <Eye className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-sm">CSP Policy</p>
                <p className="text-xs text-muted-foreground">
                  default-src 'self' &middot; frame-ancestors 'none' &middot; nosniff
                </p>
              </div>
            </div>
            <StatusBadge active={true} label="Enforced" />
          </div>

          {/* Input Validation */}
          <div className="flex items-center justify-between py-2 border-t border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center">
                <FileCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Input Validation</p>
                <p className="text-xs text-muted-foreground">
                  Zod schemas, CSRF origin verification, error sanitization
                </p>
              </div>
            </div>
            <StatusBadge active={true} label="Active" />
          </div>

          {/* Audit Log */}
          <div className="flex items-center justify-between py-2 border-t border-border/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                <ScrollText className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Audit Log</p>
                <p className="text-xs text-muted-foreground">
                  {loading ? "Loading..." : `${auditLogCount} entries recorded (in-memory, max 500)`}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-8" asChild>
              <a href="#connection">
                View Logs
                <ArrowRight className="w-3 h-3 ml-1" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
