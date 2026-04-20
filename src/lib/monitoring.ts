/**
 * DEV-2: Monitoring and Alerts Stub
 *
 * Lightweight monitoring module for the Fanvue Ops Dashboard.
 * Provides error reporting, custom metrics, and health checks.
 *
 * PRODUCTION NOTES:
 * ─────────────────
 * 1. For error tracking, integrate Sentry via `@sentry/nextjs` and replace
 *    `reportError` with `Sentry.captureException`.
 * 2. For metrics, use Vercel Analytics, Datadog, or Prometheus Pushgateway.
 * 3. For uptime monitoring, consider BetterUptime or UptimeRobot.
 * 4. The `healthCheck` function tests all critical dependencies and should
 *    be wired to a `/api/health` endpoint for load balancer checks.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  context: Record<string, unknown>;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface MetricPoint {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: string;
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  checks: Array<{
    name: string;
    status: "healthy" | "degraded" | "unhealthy";
    latencyMs: number;
    message?: string;
  }>;
  timestamp: string;
  version: string;
  uptime: number;
}

// ─── In-Memory Stores (for development) ───────────────────────────────────

const recentErrors: ErrorReport[] = [];
const MAX_ERRORS = 100;

const recentMetrics: MetricPoint[] = [];
const MAX_METRICS = 1000;

const startTime = Date.now();

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Report an error with additional context.
 *
 * Logs the error to the console and stores it in memory (up to 100 entries).
 * In production, replace with Sentry or similar error tracking service.
 *
 * @param error - The error to report (Error instance or any value)
 * @param context - Additional context for debugging
 * @param severity - Error severity level (default: "medium")
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   reportError(err, { endpoint: '/api/sync', userId: 'abc123' }, 'high');
 * }
 * ```
 */
export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
  severity: ErrorReport["severity"] = "medium",
): ErrorReport {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const report: ErrorReport = {
    id: crypto.randomUUID(),
    message,
    stack,
    context,
    timestamp: new Date().toISOString(),
    severity,
  };

  // Store in memory (FIFO)
  recentErrors.unshift(report);
  if (recentErrors.length > MAX_ERRORS) {
    recentErrors.length = MAX_ERRORS;
  }

  // Log with appropriate level
  const logFn =
    severity === "critical" || severity === "high"
      ? console.error
      : severity === "medium"
        ? console.warn
        : console.info;

  logFn(
    `[monitoring] Error reported | severity=${severity} | id=${report.id} | ${message}`,
    context,
  );

  // STUB: In production, send to Sentry
  // Sentry.captureException(error, { extra: context, level: severity });

  return report;
}

/**
 * Record a custom metric point.
 *
 * Useful for tracking response times, queue sizes, cache hit rates, etc.
 * In production, send to Datadog, Prometheus, or Vercel Analytics.
 *
 * @param name - Metric name (e.g. "api.response_time", "cache.hit_rate")
 * @param value - Numeric value
 * @param tags - Key-value tags for filtering/aggregation
 *
 * @example
 * ```ts
 * reportMetric("api.response_time", 123, { endpoint: "/api/sync", method: "GET" });
 * reportMetric("fanvue.api_calls", 1, { endpoint: "me", scope: "read:self" });
 * ```
 */
export function reportMetric(
  name: string,
  value: number,
  tags: Record<string, string> = {},
): MetricPoint {
  const point: MetricPoint = {
    name,
    value,
    tags,
    timestamp: new Date().toISOString(),
  };

  // Store in memory (FIFO)
  recentMetrics.unshift(point);
  if (recentMetrics.length > MAX_METRICS) {
    recentMetrics.length = MAX_METRICS;
  }

  console.log(
    `[monitoring] Metric: ${name}=${value} | tags=${JSON.stringify(tags)}`,
  );

  // STUB: In production, send to metrics backend
  // metrics.gauge(name, value, tags);

  return point;
}

/**
 * Run a health check against all critical dependencies.
 *
 * Tests connectivity to:
 * - Vercel KV (if configured)
 * - Fanvue API (if connected)
 * - Internal in-memory store
 *
 * @returns A health check result with individual check statuses
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult["checks"] = [];

  // 1. In-memory store check
  const memStart = Date.now();
  try {
    // Simple write/read test on the in-memory store
    const { db } = await import("@/lib/db");
    await db.syncLog.create({ type: "health_check", status: "running" });
    const logs = await db.syncLog.findMany({ take: 1 });
    const memLatency = Date.now() - memStart;
    checks.push({
      name: "in-memory-store",
      status: "healthy",
      latencyMs: memLatency,
      message: `Found ${logs.length} sync logs`,
    });
  } catch (err) {
    checks.push({
      name: "in-memory-store",
      status: "unhealthy",
      latencyMs: Date.now() - memStart,
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }

  // 2. Vercel KV check
  const kvStart = Date.now();
  if (process.env.KV_REST_API_URL) {
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set("__health_check", "ok", { ex: 10 });
      const val = await kv.get("__health_check");
      const kvLatency = Date.now() - kvStart;
      checks.push({
        name: "vercel-kv",
        status: val === "ok" ? "healthy" : "degraded",
        latencyMs: kvLatency,
        message: val === "ok" ? "Read/write OK" : "Read returned unexpected value",
      });
    } catch (err) {
      checks.push({
        name: "vercel-kv",
        status: "degraded",
        latencyMs: Date.now() - kvStart,
        message: err instanceof Error ? err.message : "KV check failed",
      });
    }
  } else {
    checks.push({
      name: "vercel-kv",
      status: "healthy",
      latencyMs: 0,
      message: "Not configured (in-memory only mode)",
    });
  }

  // 3. Fanvue API check
  const fanvueStart = Date.now();
  try {
    const { db } = await import("@/lib/db");
    const token = await db.oAuthToken.findUnique({ where: { id: "fanvue_primary" } });
    if (token) {
      const resp = await fetch("https://api.fanvue.com/v1/me", {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "X-Fanvue-API-Version": "2025-06-26",
        },
      });
      const fanvueLatency = Date.now() - fanvueStart;
      checks.push({
        name: "fanvue-api",
        status: resp.ok ? "healthy" : "degraded",
        latencyMs: fanvueLatency,
        message: resp.ok ? `API responded (${resp.status})` : `API returned ${resp.status}`,
      });
    } else {
      checks.push({
        name: "fanvue-api",
        status: "healthy",
        latencyMs: 0,
        message: "Not connected (expected if not yet authorized)",
      });
    }
  } catch {
    checks.push({
      name: "fanvue-api",
      status: "degraded",
      latencyMs: Date.now() - fanvueStart,
      message: "Connection check failed",
    });
  }

  // Determine overall status
  const hasUnhealthy = checks.some((c) => c.status === "unhealthy");
  const hasDegraded = checks.some((c) => c.status === "degraded");
  const overallStatus: HealthCheckResult["status"] = hasUnhealthy
    ? "unhealthy"
    : hasDegraded
      ? "degraded"
      : "healthy";

  return {
    status: overallStatus,
    checks,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };
}

/**
 * Get the most recent error reports.
 *
 * @param limit - Maximum number of errors to return (default: 20)
 */
export function getRecentErrors(limit = 20): ErrorReport[] {
  return recentErrors.slice(0, limit);
}

/**
 * Get the most recent metric points.
 *
 * @param name - Optional metric name to filter by
 * @param limit - Maximum number of metrics to return (default: 50)
 */
export function getRecentMetrics(name?: string, limit = 50): MetricPoint[] {
  let results = recentMetrics;
  if (name) {
    results = results.filter((m) => m.name === name);
  }
  return results.slice(0, limit);
}
