/**
 * @module payments-store
 * @description In-memory store for payment and refund tracking.
 * Designed to receive Stripe webhook events relayed through the Fanvue webhook relay system,
 * or directly from Stripe webhook endpoint. Tracks payments, refunds, chargebacks,
 * and provides alerts for suspicious activity.
 *
 * Namespaces:
 * - `payments`: Payment transactions (charges, captures)
 * - `refunds`: Refund records
 * - `chargebacks`: Chargeback/dispute records
 * - `alerts`: Generated alerts for suspicious activity
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Payment status lifecycle */
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded" | "chargeback" | "dispute";

/** Supported Stripe event types */
type StripeEventType =
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed"
  | "payment_intent.amount_capturable_updated"
  | "charge.refunded"
  | "charge.dispute.created"
  | "charge.dispute.updated"
  | "charge.dispute.closed"
  | "charge.succeeded"
  | "charge.failed"
  | "invoice.paid"
  | "invoice.payment_failed";

/** A payment transaction record */
interface Payment {
  id: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  /** Fanvue subscriber/fan ID if available */
  fanvueUserId?: string;
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Platform fee taken by Fanvue */
  fee: number;
  /** Net amount after fees */
  net: number;
  /** What the payment was for */
  description: string;
  status: PaymentStatus;
  /** Subscription tier if applicable */
  subscriptionTier?: string;
  /** Subscription ID */
  subscriptionId?: string;
  /** Customer email (stripped for privacy) */
  customerEmail?: string;
  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  /** Original event payload for audit */
  eventData?: Record<string, unknown>;
}

/** A refund record */
interface Refund {
  id: string;
  paymentId: string;
  stripeRefundId?: string;
  amount: number;
  /** Reason from Stripe */
  reason: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  createdAt: number;
}

/** A chargeback/dispute record */
interface Chargeback {
  id: string;
  paymentId: string;
  stripeDisputeId?: string;
  amount: number;
  /** Dispute reason from Stripe */
  reason: string;
  /** Current dispute status */
  status: "needs_response" | "under_review" | "won" | "lost" | "closed";
  /** Deadline to respond */
  evidenceDueBy?: number;
  createdAt: number;
  updatedAt: number;
  resolution?: string;
}

/** Generated alert for suspicious activity */
interface PaymentAlert {
  id: string;
  type: "chargeback" | "high_refund" | "failed_payment" | "subscription_cancel" | "velocity_warning";
  severity: "info" | "warn" | "critical";
  message: string;
  /** Related payment/record ID */
  relatedId?: string;
  createdAt: number;
  dismissed: boolean;
}

/** Payment statistics */
interface PaymentStats {
  totalRevenue: number;
  totalFees: number;
  totalNet: number;
  totalPayments: number;
  totalRefunds: number;
  totalRefundAmount: number;
  totalChargebacks: number;
  totalChargebackAmount: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  chargebackRate: number;
  refundRate: number;
  averagePayment: number;
  currency: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const MAX_PAYMENTS = 1000;
const MAX_REFUNDS = 500;
const MAX_CHARGEBACKS = 200;
const MAX_ALERTS = 100;

const payments: Map<string, Payment> = new Map();
const refunds: Refund[] = [];
const chargebacks: Chargeback[] = [];
const alerts: PaymentAlert[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generate an alert if suspicious activity detected
 * @param alertType - Type of alert
 * @param severity - Alert severity
 * @param message - Alert message
 * @param relatedId - Related payment ID
 */
function generateAlert(
  alertType: PaymentAlert["type"],
  severity: PaymentAlert["severity"],
  message: string,
  relatedId?: string
): PaymentAlert {
  const alert: PaymentAlert = {
    id: generateId(),
    type: alertType,
    severity,
    message,
    relatedId,
    createdAt: Date.now(),
    dismissed: false,
  };

  alerts.unshift(alert);
  if (alerts.length > MAX_ALERTS) alerts.length = MAX_ALERTS;
  return alert;
}

// ─── Stripe Webhook Processing ──────────────────────────────────────────────

/**
 * Process a Stripe webhook event and update the payment store
 * @param eventType - The Stripe event type
 * @param data - The event data payload
 * @returns Processing result with created/updated records
 */
export function processStripeEvent(
  eventType: string,
  data: Record<string, unknown>
): { processed: boolean; alerts: PaymentAlert[] } {
  const generatedAlerts: PaymentAlert[] = [];

  try {
    switch (eventType) {
      case "payment_intent.succeeded": {
        const raw = (data as Record<string, Record<string, unknown>>).data;
        const pi = raw?.object as Record<string, unknown> | undefined;
        if (!pi) break;

        const existingPayment = Array.from(payments.values()).find(
          (p) => p.stripePaymentIntentId === (pi.id as string)
        );

        if (existingPayment) {
          existingPayment.status = "succeeded";
          existingPayment.updatedAt = Date.now();
          existingPayment.stripeChargeId = (pi.latest_charge as string) ?? existingPayment.stripeChargeId;
        } else {
          const payment: Payment = {
            id: generateId(),
            stripePaymentIntentId: pi.id as string,
            amount: Number(pi.amount ?? 0) / 100, // Stripe amounts are in cents
            currency: (pi.currency as string) ?? "usd",
            fee: 0,
            net: Number(pi.amount ?? 0) / 100,
            description: (pi.description as string) ?? "Payment",
            status: "succeeded",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            eventData: data,
          };
          payments.set(payment.id, payment);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = (data as Record<string, Record<string, unknown>>).data?.object as Record<string, unknown> | undefined;
        if (!pi) break;

        const existingPayment = Array.from(payments.values()).find(
          (p) => p.stripePaymentIntentId === (pi.id as string)
        );

        if (existingPayment) {
          existingPayment.status = "failed";
          existingPayment.updatedAt = Date.now();
        } else {
          const payment: Payment = {
            id: generateId(),
            stripePaymentIntentId: pi.id as string,
            amount: Number(pi.amount ?? 0) / 100,
            currency: (pi.currency as string) ?? "usd",
            fee: 0,
            net: 0,
            description: (pi.description as string) ?? "Failed payment",
            status: "failed",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            eventData: data,
          };
          payments.set(payment.id, payment);
        }

        generatedAlerts.push(generateAlert("failed_payment", "warn",
          `Payment failed: $${Number(pi.amount ?? 0) / 100} ${(pi.currency as string) ?? "usd"}`,
          pi.id as string
        ));
        break;
      }

      case "charge.succeeded": {
        const charge = (data as Record<string, Record<string, unknown>>).data?.object as Record<string, unknown> | undefined;
        if (!charge) break;

        // Update fee/net for existing payment
        if (charge.payment_intent) {
          const existingPayment = Array.from(payments.values()).find(
            (p) => p.stripePaymentIntentId === (charge.payment_intent as string)
          );
          if (existingPayment) {
            existingPayment.fee = Number(charge.application_fee_amount ?? 0) / 100;
            existingPayment.net = existingPayment.amount - existingPayment.fee;
            existingPayment.stripeChargeId = charge.id as string;
            existingPayment.updatedAt = Date.now();
          }
        }

        // Extract metadata for subscriber linking
        const metadata = charge.metadata as Record<string, unknown> | undefined;
        if (metadata?.fanvue_user_id) {
          const existingPayment = Array.from(payments.values()).find(
            (p) => p.stripeChargeId === (charge.id as string)
          );
          if (existingPayment) {
            existingPayment.fanvueUserId = metadata.fanvue_user_id as string;
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = (data as Record<string, Record<string, unknown>>).data?.object as Record<string, unknown> | undefined;
        if (!charge) break;

        const refundAmount = Number(charge.amount_refunded ?? 0) / 100;
        const refundReason = (charge.refund_reason as string) ?? "customer_request";

        // Create refund record
        refunds.unshift({
          id: generateId(),
          paymentId: charge.id as string,
          amount: refundAmount,
          reason: refundReason,
          status: "succeeded",
          createdAt: Date.now(),
        });
        if (refunds.length > MAX_REFUNDS) refunds.length = MAX_REFUNDS;

        // Update payment status
        const totalRefunded = refunds
          .filter((r) => r.paymentId === (charge.id as string))
          .reduce((sum, r) => sum + r.amount, 0);

        const existingPayment = Array.from(payments.values()).find(
          (p) => p.stripeChargeId === (charge.id as string)
        );
        if (existingPayment) {
          existingPayment.status = totalRefunded >= existingPayment.amount ? "refunded" : "partially_refunded";
          existingPayment.updatedAt = Date.now();
        }

        // Alert for high-value refunds
        if (refundAmount >= 50) {
          generatedAlerts.push(generateAlert("high_refund", "warn",
            `High-value refund: $${refundAmount.toFixed(2)} — ${refundReason}`,
            charge.id as string
          ));
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = (data as Record<string, Record<string, unknown>>).data?.object as Record<string, unknown> | undefined;
        if (!dispute) break;

        const chargeback: Chargeback = {
          id: generateId(),
          paymentId: dispute.charge as string,
          stripeDisputeId: dispute.id as string,
          amount: Number(dispute.amount ?? 0) / 100,
          reason: (dispute.reason as string) ?? "unknown",
          status: "needs_response",
          evidenceDueBy: (dispute as Record<string, Record<string, unknown>>).evidence_details?.due_by as number | undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        chargebacks.unshift(chargeback);
        if (chargebacks.length > MAX_CHARGEBACKS) chargebacks.length = MAX_CHARGEBACKS;

        // Update payment status
        const existingPayment = Array.from(payments.values()).find(
          (p) => p.stripeChargeId === (dispute.charge as string)
        );
        if (existingPayment) {
          existingPayment.status = "chargeback";
          existingPayment.updatedAt = Date.now();
        }

        generatedAlerts.push(generateAlert("chargeback", "critical",
          `Chargeback dispute: $${chargeback.amount.toFixed(2)} — ${chargeback.reason}. Evidence due: ${chargeback.evidenceDueBy ? new Date(chargeback.evidenceDueBy).toLocaleDateString() : "N/A"}`,
          dispute.id as string
        ));
        break;
      }

      case "charge.dispute.updated": {
        const dispute = (data as Record<string, Record<string, unknown>>).data?.object as Record<string, unknown> | undefined;
        if (!dispute) break;

        const existingCb = chargebacks.find(
          (cb) => cb.stripeDisputeId === (dispute.id as string)
        );
        if (existingCb) {
          existingCb.status = (dispute.status as Chargeback["status"]) ?? existingCb.status;
          existingCb.updatedAt = Date.now();
        }
        break;
      }

      case "charge.dispute.closed": {
        const dispute = (data as Record<string, Record<string, unknown>>).data?.object as Record<string, unknown> | undefined;
        if (!dispute) break;

        const existingCb = chargebacks.find(
          (cb) => cb.stripeDisputeId === (dispute.id as string)
        );
        if (existingCb) {
          existingCb.status = "closed";
          existingCb.resolution = dispute.dispute_outcome as string | undefined;
          existingCb.updatedAt = Date.now();
        }
        break;
      }

      case "invoice.paid": {
        const invoice = (data as Record<string, Record<string, unknown>>).data?.object as Record<string, unknown> | undefined;
        if (!invoice) break;

        const existingPayment = Array.from(payments.values()).find(
          (p) => p.subscriptionId === (invoice.subscription as string) && p.status === "pending"
        );
        if (existingPayment) {
          existingPayment.status = "succeeded";
          existingPayment.updatedAt = Date.now();
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = (data as Record<string, Record<string, unknown>>).data?.object as Record<string, unknown> | undefined;
        if (!invoice) break;

        generatedAlerts.push(generateAlert("failed_payment", "warn",
          `Subscription payment failed for invoice ${(invoice.number as string) ?? "unknown"}`,
          invoice.id as string
        ));
        break;
      }
    }
  } catch (err: unknown) {
    // Log but don't throw — webhook must always return 200
    const message = err instanceof Error ? err.message : "Unknown error processing event";
    generatedAlerts.push(generateAlert("failed_payment", "warn",
      `Error processing ${eventType}: ${message}`
    ));
  }

  return { processed: true, alerts: generatedAlerts };
}

// ─── Query Functions ────────────────────────────────────────────────────────────

/**
 * List all payments with optional filtering
 */
export function listPayments(options?: {
  status?: PaymentStatus;
  since?: number;
  until?: number;
  limit?: number;
}): Payment[] {
  let results = Array.from(payments.values()).sort((a, b) => b.createdAt - a.createdAt);

  if (options?.status) {
    results = results.filter((p) => p.status === options.status);
  }
  if (options?.since != null) {
    results = results.filter((p) => p.createdAt >= (options.since as number));
  }
  if (options?.until != null) {
    results = results.filter((p) => p.createdAt <= (options.until as number));
  }

  const limit = options?.limit ?? 50;
  return results.slice(0, limit);
}

/**
 * Get payment statistics
 */
export function getPaymentStats(): PaymentStats {
  const allPayments = Array.from(payments.values());
  const totalRefundAmt = refunds.reduce((sum, r) => sum + r.amount, 0);
  const totalCbAmt = chargebacks.reduce((sum, cb) => sum + cb.amount, 0);
  const successful = allPayments.filter((p) => p.status === "succeeded").length;
  const failed = allPayments.filter((p) => p.status === "failed").length;
  const pending = allPayments.filter((p) => p.status === "pending").length;
  const refunded = allPayments.filter((p) => p.status === "refunded" || p.status === "partially_refunded").length;

  const totalRevenue = allPayments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalFees = allPayments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.fee, 0);

  const cbPayments = allPayments.filter((p) => p.status === "chargeback").length;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    totalNet: Math.round((totalRevenue - totalFees) * 100) / 100,
    totalPayments: allPayments.length,
    totalRefunds: refunds.length,
    totalRefundAmount: Math.round(totalRefundAmt * 100) / 100,
    totalChargebacks: chargebacks.length,
    totalChargebackAmount: Math.round(totalCbAmt * 100) / 100,
    successfulPayments: successful,
    failedPayments: failed,
    pendingPayments: pending,
    chargebackRate: successful > 0 ? cbPayments / successful : 0,
    refundRate: successful > 0 ? refunded / successful : 0,
    averagePayment: successful > 0 ? totalRevenue / successful : 0,
    currency: "usd",
  };
}

/**
 * List recent chargebacks
 */
export function listChargebacks(options?: { limit?: number }): Chargeback[] {
  return chargebacks.slice(0, options?.limit ?? 20);
}

/**
 * List recent refunds
 */
export function listRefunds(options?: { limit?: number }): Refund[] {
  return refunds.slice(0, options?.limit ?? 20);
}

/**
 * List alerts, optionally undismissed only
 */
export function listAlerts(options?: { undismissedOnly?: boolean; limit?: number }): PaymentAlert[] {
  let results = [...alerts];
  if (options?.undismissedOnly) {
    results = results.filter((a) => !a.dismissed);
  }
  return results.slice(0, options?.limit ?? 50);
}

/**
 * Dismiss an alert
 */
export function dismissAlert(id: string): boolean {
  const alert = alerts.find((a) => a.id === id);
  if (alert) {
    alert.dismissed = true;
    return true;
  }
  return false;
}

/**
 * Get store size info
 */
export function getPaymentsStoreStats(): {
  payments: number;
  refunds: number;
  chargebacks: number;
  alerts: number;
} {
  return {
    payments: payments.size,
    refunds: refunds.length,
    chargebacks: chargebacks.length,
    alerts: alerts.length,
  };
}
