import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingCycle, PlanId } from "@/types";

/**
 * Dodo Payments, the merchant of record that sells DraftBid AI's plans. This
 * module only talks to Dodo's REST API and checks webhook signatures; what a
 * payment means for an account lives in lib/billing.ts.
 *
 * Configuration (all server-side):
 *   DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_WEBHOOK_KEY,
 *   DODO_PAYMENTS_ENVIRONMENT = "test_mode" (default) or "live_mode",
 *   and one product ID per thing sold (see PRODUCT_ENV).
 */

export type DodoProduct =
  | { kind: "plan"; planId: PlanId; cycle: BillingCycle | null }
  | { kind: "extra_proposal"; planId: PlanId };

/** The environment variable holding each product's Dodo ID. */
export const PRODUCT_ENV = {
  single_bid: "DODO_PRODUCT_SINGLE_BID",
  starter_monthly: "DODO_PRODUCT_STARTER_MONTHLY",
  starter_annual: "DODO_PRODUCT_STARTER_ANNUAL",
  pro_monthly: "DODO_PRODUCT_PRO_MONTHLY",
  pro_annual: "DODO_PRODUCT_PRO_ANNUAL",
  extra_starter: "DODO_PRODUCT_EXTRA_PROPOSAL_STARTER",
  extra_pro: "DODO_PRODUCT_EXTRA_PROPOSAL_PRO",
} as const;

const PRODUCTS: Record<keyof typeof PRODUCT_ENV, DodoProduct> = {
  single_bid: { kind: "plan", planId: "single_bid", cycle: null },
  starter_monthly: { kind: "plan", planId: "starter", cycle: "monthly" },
  starter_annual: { kind: "plan", planId: "starter", cycle: "annual" },
  pro_monthly: { kind: "plan", planId: "pro", cycle: "monthly" },
  pro_annual: { kind: "plan", planId: "pro", cycle: "annual" },
  extra_starter: { kind: "extra_proposal", planId: "starter" },
  extra_pro: { kind: "extra_proposal", planId: "pro" },
};

const env = (name: string) => process.env[name]?.trim() || null;

/** True once the API key, webhook key and every product ID are set; until then the billing page keeps the request-by-email flow. */
export function dodoConfigured() {
  return Boolean(env("DODO_PAYMENTS_API_KEY") && env("DODO_PAYMENTS_WEBHOOK_KEY")) &&
    Object.values(PRODUCT_ENV).every((name) => env(name));
}

/** The Dodo product ID for a plan and billing cycle, or for an extra proposal on a plan. */
export function productIdFor(item: DodoProduct): string | null {
  const key = (Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]).find((candidate) => {
    const product = PRODUCTS[candidate];
    if (product.kind !== item.kind || product.planId !== item.planId) return false;
    return product.kind === "extra_proposal" || product.cycle === (item as { cycle: BillingCycle | null }).cycle;
  });
  return key ? env(PRODUCT_ENV[key]) : null;
}

/** What a Dodo product ID sells, or null for a product this app does not know. */
export function productFromId(productId: string | null | undefined): DodoProduct | null {
  if (!productId) return null;
  const key = (Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]).find((candidate) => env(PRODUCT_ENV[candidate]) === productId);
  return key ? PRODUCTS[key] : null;
}

export class DodoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function apiBase() {
  return env("DODO_PAYMENTS_ENVIRONMENT") === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com";
}

async function dodoRequest<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const key = env("DODO_PAYMENTS_API_KEY");
  if (!key) throw new DodoError("Dodo Payments is not configured.", 503);
  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok) {
    // Dodo's error body names the problem (code and message); it never contains card data.
    throw new DodoError(`Dodo Payments ${method} ${path.split("?")[0]} failed with ${response.status}: ${text.slice(0, 300)}`, response.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type CheckoutRequest = {
  productId: string;
  customer: { customerId: string } | { email: string; name?: string | null };
  returnUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  discountCode?: string | null;
};

/** Creates a hosted checkout session; returns the URL to send the customer to. */
export async function createCheckoutSession(input: CheckoutRequest) {
  const session = await dodoRequest<{ session_id: string; checkout_url?: string | null }>("POST", "/checkouts", {
    product_cart: [{ product_id: input.productId, quantity: 1 }],
    customer: "customerId" in input.customer
      ? { customer_id: input.customer.customerId }
      : { email: input.customer.email, ...(input.customer.name ? { name: input.customer.name } : {}) },
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    metadata: input.metadata,
    ...(input.discountCode ? { discount_codes: [input.discountCode] } : {}),
    // The account is matched by this email, so the customer cannot change it at checkout.
    feature_flags: { allow_customer_editing_email: false },
  });
  if (!session.checkout_url) throw new DodoError("Dodo Payments returned no checkout link.", 502);
  return { sessionId: session.session_id, url: session.checkout_url };
}

/**
 * Moves a subscription to another product. "immediately" (upgrades) credits
 * the unused part of the current period against the new one, and keeps the
 * old plan if that charge fails; "next_billing_date" (downgrades) charges
 * nothing now and switches at renewal.
 */
export async function changeSubscriptionPlan(
  subscriptionId: string,
  productId: string,
  when: "immediately" | "next_billing_date",
  metadata: Record<string, string>,
) {
  return dodoRequest<{ payment_id?: string | null; payment_link?: string | null }>(
    "POST",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan`,
    {
      product_id: productId,
      quantity: 1,
      proration_billing_mode: "prorated_immediately",
      effective_at: when,
      ...(when === "immediately" ? { on_payment_failure: "prevent_change" } : {}),
      metadata,
    },
  );
}

/** A one-time link to Dodo's customer portal: invoices, payment method, cancellation. */
export async function createPortalLink(customerId: string, returnUrl: string) {
  const query = new URLSearchParams({ return_url: returnUrl });
  const session = await dodoRequest<{ link: string }>(
    "POST",
    `/customers/${encodeURIComponent(customerId)}/customer-portal/session?${query}`,
  );
  return session.link;
}

/**
 * A single-use flat discount (in US cents) for the first billing cycle of the
 * given subscription products, valid until `expiresAt`.
 */
export async function createOneTimeDiscount(input: {
  amountCents: number;
  productIds: string[];
  expiresAt: Date;
  name: string;
  metadata: Record<string, string>;
}) {
  const discount = await dodoRequest<{ code: string }>("POST", "/discounts", {
    type: "flat",
    amount: input.amountCents,
    currency_options: [{ currency: "USD", is_default: true, max_amount_possible: input.amountCents }],
    usage_limit: 1,
    per_customer_usage_limit: 1,
    subscription_cycles: 1,
    restricted_to: input.productIds,
    expires_at: input.expiresAt.toISOString(),
    name: input.name,
    metadata: input.metadata,
  });
  return discount.code;
}

/** Webhooks older than this are refused, so a captured delivery cannot be replayed later. */
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/**
 * Checks a webhook against the Standard Webhooks scheme Dodo uses: an
 * HMAC-SHA256 of "{webhook-id}.{webhook-timestamp}.{raw body}", keyed with the
 * base64 secret after "whsec_", in a "v1,<base64>" entry of webhook-signature.
 */
export function verifyWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret = env("DODO_PAYMENTS_WEBHOOK_KEY"),
  now = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
