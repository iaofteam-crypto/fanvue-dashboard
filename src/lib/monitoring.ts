/**
 * Monitoring and Alerts
 *
 * Lightweight monitoring module for the Fanvue Ops Dashboard.
 * Provides error reporting, custom metrics, health checks, alerting, and querying.
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
  unit?: string;
  tags?: Record<string, string>;
  type: "api_request" | "dependency_check" | "custom";
  route?: string;
  statusCode?: number;
  dependency?: string;
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

export interface Alert {
  id: string;
  ruleId: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "acknowledged" | "resolved";
  message: string;
  source: string;
  triggeredAt: string;
  resolvedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  metric: string;
  condition: "gt" | "lt" | "eq" | "gte" | "lte";
  threshold: number;
  windowMinutes: number;
  cooldownMinutes: number;
  enabled: boolean;
}

/** Query parameters for `queryMetrics` */
export interface MetricsQuery {
  type?: "api_request" | "dependency_check" | "custom";
  route?: string;
  statusCode?: number;
  dependency?: string;
  name?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
  aggregate?: "none" | "by_route" | "by_status" | "by_minute";
}

/** Result from `queryMetrics` */
export interface MetricsQueryResult {
  metrics: MetricPoint[];
  total: number;
  returned: number;
  aggregates?: Record<string, Record<string, unknown>>;
}

/** Input for `recordCustomMetric` */
export interface CustomMetricInput {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

/** Options for `getAlerts` */
export interface GetAlertsOptions {
  activeOnly?: boolean;
  limit?: number;
}

// ─── In-Memory Stores (for development) ───────────────────────────────────

const recentErrors: ErrorReport[] = [];
const MAX_ERRORS = 100;

const recentMetrics: MetricPoint[] = [];
const MAX_METRICS = 1000;

const activeAlerts: Alert[] = [];
const MAX_ALERTS = 200;

const startTime = Date.now();

// ─── Default Alert Rules ──────────────────────────────────────────────────

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: "error-rate-high",
    name: "High Error Rate",
    description: "Triggers when error rate exceeds 10% in the last 5 minutes",
    severity: "high",
    metric: "error_rate_percent",
    condition: "gt",
    threshold: 10,
    windowMinutes: 5,
    cooldownMinutes: 15,
    enabled: true,
  },
  {
    id: "response-time-slow",
    name: "Slow Response Time",
    description: "Triggers when average response time exceeds 5 seconds",
    severity: "medium",
    metric: "avg_response_time_ms",
    condition: "gt",
    threshold: 5000,
    windowMinutes: 5,
    cooldownMinutes: 15,
    enabled: true,
  },
  {
    id: "memory-usage-high",
    name: "High Memory Usage",
    description: "Triggers when estimated memory usage exceeds threshold",
    severity: "critical",
    metric: "memory_usage_mb",
    condition: "gt",
    threshold: 256,
    windowMinutes: 1,
    cooldownMinutes: 30,
    enabled: true,
  },
  {
    id: "fanvue-api-unhealthy",
    name: "Fanvue API Unhealthy",
    description: "Triggers when Fanvue API health check fails",
    severity: "high",
    metric: "fanvue_api_status",
    condition: "eq",
    threshold: 0,
    windowMinutes: 1,
    cooldownMinutes: 10,
    enabled: true,
  },
  {
    id: "rate-limit-blocked",
    name: "Rate Limit Blocking",
    description: "Triggers when multiple rate limit blocks are detected",
    severity: "medium",
    metric: "rate_limit_blocks",
    condition: "gt",
    threshold: 5,
    windowMinutes: 5,
    cooldownMinutes: 15,
    enabled: true,
  },
];

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Report an error with additional context.
 *
 * @param error - The error to report (Error instance or any value).
 * @param context - Additional context for debugging.
 * @param severity - Error severity level (default: "medium").
 * @returns The created {@link ErrorReport}.
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

  recentErrors.unshift(report);
  if (recentErrors.length > MAX_ERRORS) {
    recentErrors.length = MAX_ERRORS;
  }

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

  return report;
}

/**
 * Record a custom metric point.
 *
 * @param name - Metric name (e.g. "api.response_time").
 * @param value - Numeric value.
 * @param tags - Key-value tags for filtering/aggregation.
 * @returns The created {@link MetricPoint}.
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
    type: "custom",
    timestamp: new Date().toISOString(),
  };

  recentMetrics.unshift(point);
  if (recentMetrics.length > MAX_METRICS) {
    recentMetrics.length = MAX_METRICS;
  }

  console.log(
    `[monitoring] Metric: ${name}=${value} | tags=${JSON.stringify(tags)}`,
  );

  return point;
}

/**
 * Record a custom metric with optional unit and tags.
 *
 * This is the newer API that supports the `unit` field.
 *
 * @param input - The metric input with name, value, and optional unit/tags.
 * @returns The created {@link MetricPoint}.
 */
export function recordCustomMetric(input: CustomMetricInput): MetricPoint {
  const point: MetricPoint = {
    name: input.name,
    value: input.value,
    unit: input.unit,
    tags: input.tags,
    type: "custom",
    timestamp: new Date().toISOString(),
  };

  recentMetrics.unshift(point);
  if (recentMetrics.length > MAX_METRICS) {
    recentMetrics.length = MAX_METRICS;
  }

  console.log(
    `[monitoring] Custom metric: ${input.name}=${input.value}${input.unit ? ` ${input.unit}` : ""} | tags=${JSON.stringify(input.tags ?? {})}`,
  );

  return point;
}

/**
 * Query collected metrics with filtering and optional aggregation.
 *
 * @param query - Filter and aggregation parameters.
 * @returns A {@link MetricsQueryResult} with matching metrics and optional aggregates.
 */
export function queryMetrics(query: MetricsQuery): MetricsQueryResult {
  let results = recentMetrics;

  // Filter by type
  if (query.type) {
    results = results.filter((m) => m.type === query.type);
  }

  // Filter by route
  if (query.route) {
    results = results.filter((m) => m.route === query.route);
  }

  // Filter by status code
  if (query.statusCode !== undefined) {
    results = results.filter((m) => m.statusCode === query.statusCode);
  }

  // Filter by dependency
  if (query.dependency) {
    results = results.filter((m) => m.dependency === query.dependency);
  }

  // Filter by name
  if (query.name) {
    results = results.filter((m) => m.name === query.name);
  }

  // Filter by since timestamp
  if (query.since) {
    const sinceDate = new Date(query.since).getTime();
    if (!isNaN(sinceDate)) {
      results = results.filter(
        (m) => new Date(m.timestamp).getTime() >= sinceDate,
      );
    }
  }

  // Filter by until timestamp
  if (query.until) {
    const untilDate = new Date(query.until).getTime();
    if (!isNaN(untilDate)) {
      results = results.filter(
        (m) => new Date(m.timestamp).getTime() <= untilDate,
      );
    }
  }

  const total = results.length;

  // Apply offset
  const offset = query.offset ?? 0;
  if (offset > 0) {
    results = results.slice(offset);
  }

  // Apply limit
  const limit = query.limit ?? 100;
  const metrics = results.slice(0, limit);

  // Compute aggregates if requested
  let aggregates: Record<string, Record<string, unknown>> | undefined;
  if (query.aggregate && query.aggregate !== "none") {
    aggregates = computeAggregates(results, query.aggregate);
  }

  return { metrics, total, returned: metrics.length, aggregates };
}

/**
 * Clear all collected metrics.
 *
 * @returns The number of metrics that were cleared.
 */
export function clearMetrics(): number {
  const count = recentMetrics.length;
  recentMetrics.length = 0;
  console.log(`[monitoring] Cleared ${count} metric entries`);
  return count;
}

/**
 * Get the current size of the metrics store.
 *
 * @returns The number of metrics currently stored.
 */
export function getMetricsStoreSize(): number {
  return recentMetrics.length;
}

/**
 * Get alerts with optional filtering.
 *
 * @param options - Filter options (activeOnly, limit).
 * @returns An array of matching {@link Alert} objects.
 */
export function getAlerts(options: GetAlertsOptions = {}): Alert[] {
  let results = activeAlerts;

  if (options.activeOnly) {
    results = results.filter((a) => a.status === "active");
  }

  const limit = options.limit ?? 100;
  return results.slice(0, limit);
}

/**
 * Get configured alert rules.
 *
 * @returns An array of all configured {@link AlertRule} objects.
 */
export function getAlertRules(): AlertRule[] {
  return [...DEFAULT_ALERT_RULES];
}

/**
 * Clear all alerts.
 *
 * @returns The number of alerts that were cleared.
 */
export function clearAlerts(): number {
  const count = activeAlerts.length;
  activeAlerts.length = 0;
  console.log(`[monitoring] Cleared ${count} alert entries`);
  return count;
}

/**
 * Run a health check against all critical dependencies.
 *
 * @returns A health check result with individual check statuses.
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult["checks"] = [];

  // 1. In-memory store check
  const memStart = Date.now();
  try {
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
 * @param limit - Maximum number of errors to return (default: 20).
 */
export function getRecentErrors(limit = 20): ErrorReport[] {
  return recentErrors.slice(0, limit);
}

/**
 * Get the most recent metric points.
 *
 * @param name - Optional metric name to filter by.
 * @param limit - Maximum number of metrics to return (default: 50).
 */
export function getRecentMetrics(name?: string, limit = 50): MetricPoint[] {
  let results = recentMetrics;
  if (name) {
    results = results.filter((m) => m.name === name);
  }
  return results.slice(0, limit);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────

/**
 * Compute aggregates from a set of metric points.
 */
function computeAggregates(
  metrics: MetricPoint[],
  aggregate: "by_route" | "by_status" | "by_minute",
): Record<string, Record<string, unknown>> {
  const buckets: Record<string, { count: number; sum: number; min: number; max: number }> = {};

  for (const m of metrics) {
    let key: string;

    switch (aggregate) {
      case "by_route":
        key = m.route ?? "(no-route)";
        break;
      case "by_status":
        key = String(m.statusCode ?? "(no-status)");
        break;
      case "by_minute": {
        const date = new Date(m.timestamp);
        // Truncate to minute: YYYY-MM-DDTHH:MM
        key = date.toISOString().slice(0, 16);
        break;
      }
    }

    if (!buckets[key]) {
      buckets[key] = { count: 0, sum: 0, min: m.value, max: m.value };
    }
    const bucket = buckets[key];
    bucket.count += 1;
    bucket.sum += m.value;
    if (m.value < bucket.min) bucket.min = m.value;
    if (m.value > bucket.max) bucket.max = m.value;
  }

  const result: Record<string, Record<string, unknown>> = {};
  for (const [key, bucket] of Object.entries(buckets)) {
    result[key] = {
      count: bucket.count,
      sum: bucket.sum,
      avg: bucket.count > 0 ? Math.round((bucket.sum / bucket.count) * 100) / 100 : 0,
      min: bucket.min,
      max: bucket.max,
    };
  }

  return result;
}
