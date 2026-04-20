/**
 * INT-3: Stripe / Payment Notifications Stub
 *
 * This module provides types and stub functions for handling payment events
 * (subscriptions, tips, purchases) from Fanvue via Stripe webhooks.
 *
 * FUTURE INTEGRATION NOTES:
 * ─────────────────────────
 * 1. Replace `processPaymentNotification` with actual Stripe webhook signature
 *    verification (`stripe.webhooks.constructEvent`) and event processing.
 * 2. Store payment events in the database for audit trails and analytics.
 * 3. Set up the Stripe webhook endpoint at `/api/webhooks/stripe` with
 *    the `STRIPE_WEBHOOK_SECRET` environment variable.
 * 4. Use `getPaymentSummary` to power the earnings/revenue dashboard cards.
 * 5. Connect to Stripe's API for real-time event streaming if needed.
 *
 * @see https://docs.stripe.com/webhooks
 */

// ─── Types ────────────────────────────────────────────────────────────────

/** Supported payment event types */
export type PaymentEventType = "subscription" | "tip" | "purchase" | "refund" | "payout";

/** Payment event payload (mirrors Stripe event structure, simplified) */
export interface PaymentEvent {
  /** Stripe event ID (e.g. "evt_1Ox...") */
  id: string;
  /** Event type */
  type: PaymentEventType;
  /** ISO timestamp of when the event occurred */
  createdAt: string;
  /** Amount in cents (USD) */
  amount: number;
  /** Fanvue user ID of the fan */
  fanId?: string;
  /** Fanvue user ID of the creator */
  creatorId?: string;
  /** Fan display name (if available) */
  fanName?: string;
  /** Description / memo */
  description?: string;
  /** Subscription tier name (for subscription events) */
  tier?: string;
  /** Stripe subscription status (for subscription events) */
  subscriptionStatus?: "active" | "canceled" | "past_due" | "trialing" | "unpaid";
  /** Payment currency (default: "usd") */
  currency: string;
  /** Raw Stripe event JSON (for debugging) */
  raw?: unknown;
}

/** Summary of payment data for a given period */
export interface PaymentSummary {
  period: { from: string; to: string };
  totalRevenue: number;
  revenueBySource: {
    subscriptions: number;
    tips: number;
    purchases: number;
    refunds: number;
  };
  transactionCount: number;
  averageTransactionValue: number;
  topFans: Array<{
    fanId: string;
    fanName: string;
    totalSpent: number;
    transactionCount: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Process an incoming payment notification / webhook event.
 *
 * Currently a stub that logs the event. In production:
 * 1. Verify the Stripe webhook signature
 * 2. Parse the event into a `PaymentEvent`
 * 3. Store in the database
 * 4. Trigger any relevant automation workflows
 *
 * @param event - The payment event to process
 * @returns The processed event with any additional metadata
 */
export function processPaymentNotification(event: PaymentEvent): PaymentEvent {
  // STUB: Log the event for now
  console.log(
    `[payments] Received ${event.type} event: id=${event.id} ` +
      `amount=$${(event.amount / 100).toFixed(2)} ` +
      `currency=${event.currency}` +
      (event.fanId ? ` fan=${event.fanId}` : "") +
      (event.tier ? ` tier=${event.tier}` : "") +
      (event.description ? ` desc="${event.description}"` : ""),
  );

  // STUB: In production, persist to database and trigger workflows
  // await db.paymentEvent.create({ data: event });
  // await triggerWorkflow("payment_received", event);

  return event;
}

/**
 * Get a payment summary for a given time period.
 *
 * Currently returns mock data for development and dashboard prototyping.
 * In production, aggregate from stored payment events.
 *
 * @param from - Start date (ISO string). Defaults to 30 days ago.
 * @param to - End date (ISO string). Defaults to now.
 * @returns Payment summary with revenue breakdown
 */
export function getPaymentSummary(from?: string, to?: string): PaymentSummary {
  const now = new Date();
  const periodFrom = from ? new Date(from) : new Date(now.getTime() - 30 * 86400000);
  const periodTo = to ? new Date(to) : now;

  // Mock data for dashboard development
  const mockSummary: PaymentSummary = {
    period: {
      from: periodFrom.toISOString(),
      to: periodTo.toISOString(),
    },
    totalRevenue: 4_250_00, // $4,250.00 in cents
    revenueBySource: {
      subscriptions: 2_800_00, // $2,800.00
      tips: 950_00,           // $950.00
      purchases: 500_00,      // $500.00
      refunds: 0,             // $0.00
    },
    transactionCount: 142,
    averageTransactionValue: 29_93, // ~$29.93
    topFans: [
      { fanId: "fan_001", fanName: "Alex M.", totalSpent: 450_00, transactionCount: 12 },
      { fanId: "fan_002", fanName: "Jordan K.", totalSpent: 320_00, transactionCount: 8 },
      { fanId: "fan_003", fanName: "Sam R.", totalSpent: 285_00, transactionCount: 15 },
      { fanId: "fan_004", fanName: "Taylor L.", totalSpent: 200_00, transactionCount: 6 },
      { fanId: "fan_005", fanName: "Morgan P.", totalSpent: 175_00, transactionCount: 9 },
    ],
    dailyBreakdown: Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now.getTime() - i * 86400000);
      return {
        date: date.toISOString().split("T")[0],
        revenue: Math.floor(Math.random() * 15000) + 5000,
        transactions: Math.floor(Math.random() * 10) + 2,
      };
    }).reverse(),
  };

  return mockSummary;
}

/**
 * Validate a Stripe webhook signature.
 *
 * STUB: Always returns true. In production, use:
 * ```ts
 * import Stripe from 'stripe';
 * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 * const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
 * ```
 */
export function validateWebhookSignature(
  _payload: string,
  _signature: string,
): boolean {
  console.warn("[payments] Webhook signature validation is a STUB — not verified in development");
  return true;
}
