import { NextResponse } from "next/server";
import { getAuditLogs } from "@/lib/audit-log";
import { RATE_LIMITS } from "@/lib/rate-limit";

/**
 * GET /api/security-status
 *
 * Returns a snapshot of the dashboard's security posture:
 * - webhookSecretSet: whether FANVUE_WEBHOOK_SECRET is configured
 * - auditLogCount: number of entries currently in the audit log
 * - rateLimitTiers: summary of the configured rate limit tiers
 */
export async function GET() {
  try {
    const auditLogs = getAuditLogs({ limit: 1 });

    return NextResponse.json({
      webhookSecretSet: !!process.env.FANVUE_WEBHOOK_SECRET,
      auditLogCount: getAuditLogs().length,
      rateLimitTiers: {
        public: RATE_LIMITS.public,
        authenticated: RATE_LIMITS.authenticated,
        expensive: RATE_LIMITS.expensive,
        webhook: RATE_LIMITS.webhook,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve security status" },
      { status: 500 },
    );
  }
}
