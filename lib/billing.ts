import { prisma } from "@/lib/db";
import {
  changeSubscriptionPlan,
  createCheckoutSession,
  createOneTimeDiscount,
  createPortalLink,
  dodoConfigured,
  productFromId,
  productIdFor,
} from "@/lib/dodo";
import { getProposalAllowance } from "@/lib/entitlements";
import { recordFirst } from "@/lib/funnel";
import { Prisma, SubscriptionStatus, type SubscriptionTier } from "@/lib/generated/prisma";
import { CURRENT_PLAN_VERSION, isSellablePlan, PLANS, resolvePlan } from "@/lib/plans";
import { safeErrorSummary } from "@/lib/safe-log";
import { SITE_URL } from "@/lib/site";
import type { BillingCycle, PlanId } from "@/types";

/**
 * What paying through Dodo Payments means for an account: starting checkout,
 * changing plan, the customer portal, and applying Dodo's webhooks to the
 * Subscription row that the rest of the app reads.
 */

export type BillingResult = { ok: true; url: string } | { ok: true; message: string } | { ok: false; error: string };

const NOT_LIVE = "Online checkout is not available yet. Email us from this page and we will set up your plan.";
const DAY_MS = 24 * 60 * 60 * 1000;

type Account = Prisma.UserGetPayload<{ include: { subscription: true } }>;

async function loadAccount(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, include: { subscription: true } });
}

/** A paid Dodo subscription that is still running (including one waiting on a failed payment). */
function hasRunningSubscription(account: Account) {
  const sub = account.subscription;
  return Boolean(
    sub?.dodoSubscriptionId &&
      sub.status !== SubscriptionStatus.canceled &&
      resolvePlan(sub).billing.kind === "subscription",
  );
}

/** The single-bid pass's price as a discount code, if this account bought one less than 30 days ago and has not subscribed since. */
async function passCreditCode(account: Account, now: Date) {
  const sub = account.subscription;
  const pass = PLANS.single_bid.billing;
  if (!sub || sub.tier !== "single_bid" || sub.planVersion !== CURRENT_PLAN_VERSION || pass.kind !== "one_time") return null;
  if (!sub.accessEndsAt || sub.accessEndsAt <= now) return null;
  if (sub.passCreditCode) return sub.passCreditCode;

  const productIds = (["starter", "pro"] as const).flatMap((planId) =>
    (["monthly", "annual"] as const).map((cycle) => productIdFor({ kind: "plan", planId, cycle })),
  ).filter((id): id is string => Boolean(id));
  const code = await createOneTimeDiscount({
    amountCents: Math.round(pass.price.usd * 100),
    productIds,
    // The pass lasts 30 days, so its access end is exactly 30 days after purchase.
    expiresAt: sub.accessEndsAt,
    name: `Single-bid pass credit for ${account.email}`,
    metadata: { user_id: account.id, reason: "single_bid_credit" },
  });
  await prisma.subscription.update({ where: { userId: account.id }, data: { passCreditCode: code } });
  return code;
}

function checkoutCustomer(account: Account) {
  const customerId = account.subscription?.dodoCustomerId;
  return customerId ? { customerId } : { email: account.email, name: account.agencyName };
}

/**
 * Sends the user to pay for a plan, or, for someone already subscribed,
 * switches their subscription to it (the unused part of the current period is
 * credited). The account changes only when Dodo's webhook confirms payment.
 */
export async function startPlanCheckout(userId: string, planId: PlanId, cycle: BillingCycle, now = new Date()): Promise<BillingResult> {
  if (!dodoConfigured()) return { ok: false, error: NOT_LIVE };
  if (!isSellablePlan(planId) || PLANS[planId].billing.kind === "free") return { ok: false, error: "That plan cannot be bought online." };
  const account = await loadAccount(userId);
  if (!account) return { ok: false, error: "Complete onboarding first." };

  const plan = PLANS[planId];
  const subscription = plan.billing.kind === "subscription";
  const productId = productIdFor({ kind: "plan", planId, cycle: subscription ? cycle : null });
  if (!productId) return { ok: false, error: NOT_LIVE };
  const metadata = { user_id: account.id, plan_id: planId, ...(subscription ? { cycle } : {}) };
  const current = account.subscription;

  if (hasRunningSubscription(account)) {
    if (!subscription) {
      return { ok: false, error: "Your subscription already includes more proposals than a single-bid pass. Manage it from this page instead." };
    }
    if (current?.tier === planId && current.billingCycle === cycle && current.planVersion === CURRENT_PLAN_VERSION) {
      return { ok: false, error: "You are already on this plan." };
    }
    // A bigger plan, or the same plan paid yearly, applies now (the unused part of this
    // period is credited); anything else, such as annual to monthly, waits for the renewal.
    const limit = (value: number | null) => value ?? Number.POSITIVE_INFINITY;
    const upgrade =
      limit(plan.proposals.limit) > limit(resolvePlan(current).proposals.limit) ||
      (planId === current!.tier && cycle === "annual" && current!.billingCycle !== "annual");
    await changeSubscriptionPlan(current!.dodoSubscriptionId!, productId, upgrade ? "immediately" : "next_billing_date", metadata);
    const renewal = current!.currentPeriodEnd ? current!.currentPeriodEnd.toISOString().slice(0, 10) : "your next renewal";
    return {
      ok: true,
      message: upgrade
        ? `Switching you to ${plan.name}. The new limits apply as soon as the payment goes through, usually within a minute.`
        : `${plan.name} starts on ${renewal}. You keep your current plan until then.`,
    };
  }

  if (!subscription && current?.tier === "single_bid" && current.accessEndsAt && current.accessEndsAt > now) {
    return { ok: false, error: `Your single-bid pass is active until ${current.accessEndsAt.toISOString().slice(0, 10)}.` };
  }

  const discountCode = subscription ? await passCreditCode(account, now) : null;
  const session = await createCheckoutSession({
    productId,
    customer: checkoutCustomer(account),
    returnUrl: `${SITE_URL}/dashboard/billing?checkout=done`,
    cancelUrl: `${SITE_URL}/dashboard/billing`,
    metadata,
    discountCode,
  });
  return { ok: true, url: session.url };
}

/** Sends the user to pay for one extra proposal at their plan's price, before the upload that needs it. */
export async function startExtraProposalCheckout(userId: string): Promise<BillingResult> {
  if (!dodoConfigured()) return { ok: false, error: NOT_LIVE };
  const account = await loadAccount(userId);
  if (!account) return { ok: false, error: "Complete onboarding first." };
  const allowance = await getProposalAllowance(account.id, account.subscription);
  const plan = allowance.plan;
  const productId = allowance.overagePriceUsd === null ? null : productIdFor({ kind: "extra_proposal", planId: plan.id });
  if (!productId) return { ok: false, error: "Your plan does not offer extra proposals. Choose a bigger plan on the billing page." };

  const session = await createCheckoutSession({
    productId,
    customer: checkoutCustomer(account),
    returnUrl: `${SITE_URL}/dashboard/rfps/new?extra=paid`,
    cancelUrl: `${SITE_URL}/dashboard/rfps/new`,
    metadata: { user_id: account.id, kind: "extra_proposal" },
  });
  return { ok: true, url: session.url };
}

/** Dodo's customer portal for this account: invoices, payment method, cancellation. */
export async function billingPortalUrl(userId: string): Promise<BillingResult> {
  if (!dodoConfigured()) return { ok: false, error: NOT_LIVE };
  const account = await loadAccount(userId);
  const customerId = account?.subscription?.dodoCustomerId;
  if (!customerId) return { ok: false, error: "There is no billing account yet. It is created with your first payment." };
  return { ok: true, url: await createPortalLink(customerId, `${SITE_URL}/dashboard/billing`) };
}

// ---------------------------------------------------------------------------
// Webhooks

export type DodoEvent = { type: string; timestamp: string; data: Record<string, unknown> };

type DodoCustomer = { customer_id?: string; email?: string };
type DodoSubscription = {
  subscription_id: string;
  status: string;
  product_id: string;
  customer?: DodoCustomer;
  metadata?: Record<string, unknown>;
  next_billing_date?: string | null;
  cancel_at_next_billing_date?: boolean;
};
type DodoPayment = {
  payment_id: string;
  status?: string | null;
  subscription_id?: string | null;
  customer?: DodoCustomer;
  metadata?: Record<string, unknown>;
  product_cart?: { product_id: string; quantity: number }[] | null;
  created_at?: string;
};

/**
 * The account an event belongs to: the user ID our checkout put in the
 * metadata, then the subscription or customer already linked to an account,
 * then the customer's email when exactly one account has it.
 */
async function findAccount(data: { metadata?: Record<string, unknown>; customer?: DodoCustomer; subscription_id?: string | null }) {
  const include = { subscription: true } as const;
  const userId = typeof data.metadata?.user_id === "string" ? data.metadata.user_id : null;
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include });
    if (user) return user;
  }
  if (data.subscription_id) {
    const sub = await prisma.subscription.findUnique({ where: { dodoSubscriptionId: data.subscription_id }, select: { userId: true } });
    if (sub) return prisma.user.findUnique({ where: { id: sub.userId }, include });
  }
  const customerId = data.customer?.customer_id;
  if (customerId) {
    const sub = await prisma.subscription.findFirst({ where: { dodoCustomerId: customerId }, select: { userId: true } });
    if (sub) return prisma.user.findUnique({ where: { id: sub.userId }, include });
  }
  const email = data.customer?.email?.trim();
  if (email) {
    const matches = await prisma.user.findMany({ where: { email: { equals: email, mode: "insensitive" } }, include, take: 2 });
    if (matches.length === 1) return matches[0];
  }
  return null;
}

const FREE_TERMS = { tier: "free" as SubscriptionTier, billingCycle: null, accessEndsAt: null };

async function applySubscription(data: DodoSubscription, eventAt: Date) {
  const product = productFromId(data.product_id);
  if (!product || product.kind !== "plan" || product.cycle === null) {
    console.warn(`[billing] Ignoring subscription ${data.subscription_id}: product ${data.product_id} is not a plan this app sells.`);
    return;
  }
  const account = await findAccount(data);
  if (!account) {
    console.error(`[billing] No account for Dodo subscription ${data.subscription_id}.`);
    return;
  }
  const current = account.subscription;
  const isCurrent = current?.dodoSubscriptionId === data.subscription_id;
  // Events can arrive late or out of order; only the newest state of a subscription counts.
  if (isCurrent && current?.billingEventAt && eventAt < current.billingEventAt) return;

  const shared = {
    dodoCustomerId: data.customer?.customer_id ?? current?.dodoCustomerId ?? null,
    providerStatus: data.status,
    billingEventAt: eventAt,
    planVersion: CURRENT_PLAN_VERSION,
  };
  let terms: Prisma.SubscriptionUncheckedUpdateInput | null = null;
  switch (data.status) {
    case "active":
      terms = {
        ...shared,
        tier: product.planId as SubscriptionTier,
        billingCycle: product.cycle,
        status: SubscriptionStatus.active,
        dodoSubscriptionId: data.subscription_id,
        currentPeriodEnd: data.next_billing_date ? new Date(data.next_billing_date) : null,
        cancelAtPeriodEnd: Boolean(data.cancel_at_next_billing_date),
        accessEndsAt: null,
        passCreditCode: null,
      };
      break;
    case "on_hold":
    case "past_due":
    case "paused":
      // A failed renewal: the plan stays, uploads pause until the payment method is fixed (on hold).
      if (isCurrent) terms = { ...shared, status: SubscriptionStatus.past_due };
      break;
    case "cancelled":
    case "expired":
    case "failed":
      // Only the subscription that granted the plan can take it away; an old or never-started one cannot.
      if (isCurrent) terms = { ...shared, ...FREE_TERMS, status: SubscriptionStatus.canceled, cancelAtPeriodEnd: false };
      break;
    default:
      // "pending": checkout not finished; nothing is granted yet.
      break;
  }
  if (!terms) return;
  await prisma.subscription.upsert({
    where: { userId: account.id },
    update: terms,
    create: { ...(terms as Prisma.SubscriptionUncheckedCreateInput), userId: account.id },
  });
  if (data.status === "active") await recordFirst("paid", account.id);
}

async function applyPayment(data: DodoPayment, eventAt: Date) {
  // Subscription charges are handled through the subscription events.
  if (data.subscription_id) return;
  const items = (data.product_cart ?? []).map((item) => ({ ...item, product: productFromId(item.product_id) }));
  if (!items.some((item) => item.product)) {
    console.warn(`[billing] Ignoring payment ${data.payment_id}: no product this app sells.`);
    return;
  }
  const account = await findAccount(data);
  if (!account) {
    console.error(`[billing] No account for Dodo payment ${data.payment_id}.`);
    return;
  }
  const paidAt = data.created_at ? new Date(data.created_at) : eventAt;
  const customerId = data.customer?.customer_id ?? account.subscription?.dodoCustomerId ?? null;

  for (const { product, quantity } of items) {
    if (!product) continue;
    if (product.kind === "extra_proposal") {
      const price = PLANS[product.planId].overage?.usd ?? 0;
      // One row per payment: a repeated delivery of the same payment adds nothing.
      await prisma.extraProposal.createMany({
        data: Array.from({ length: Math.max(1, quantity) }, (_, index) => ({
          userId: account.id,
          paymentId: index === 0 ? data.payment_id : `${data.payment_id}#${index}`,
          amountCents: Math.round(price * 100),
          createdAt: paidAt,
        })),
        skipDuplicates: true,
      });
    } else if (product.planId === "single_bid") {
      if (hasRunningSubscription(account)) {
        console.error(`[billing] Payment ${data.payment_id} bought a single-bid pass for an account that already subscribes; refund it from the Dodo dashboard.`);
        continue;
      }
      const pass = PLANS.single_bid.billing;
      const accessDays = pass.kind === "one_time" ? pass.accessDays : 30;
      const terms = {
        tier: "single_bid" as SubscriptionTier,
        status: SubscriptionStatus.active,
        planVersion: CURRENT_PLAN_VERSION,
        billingCycle: null,
        accessEndsAt: new Date(paidAt.getTime() + accessDays * DAY_MS),
        dodoCustomerId: customerId,
        providerStatus: "paid",
        passCreditCode: null,
      };
      await prisma.subscription.upsert({ where: { userId: account.id }, update: terms, create: { ...terms, userId: account.id } });
      await recordFirst("paid", account.id);
    }
  }
}

/**
 * Applies one verified webhook. Each delivery is recorded by its webhook-id
 * first, so a retried delivery is skipped; if applying it fails, the record is
 * removed again so Dodo's retry gets another go.
 */
export async function handleDodoEvent(webhookId: string, event: DodoEvent): Promise<"applied" | "duplicate"> {
  try {
    await prisma.billingEvent.create({ data: { id: webhookId, type: event.type } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }
  try {
    const eventAt = new Date(event.timestamp);
    const at = Number.isNaN(eventAt.getTime()) ? new Date() : eventAt;
    if (event.type.startsWith("subscription.")) await applySubscription(event.data as unknown as DodoSubscription, at);
    else if (event.type === "payment.succeeded") await applyPayment(event.data as unknown as DodoPayment, at);
    return "applied";
  } catch (error) {
    console.error(`[billing] Could not apply ${event.type}:`, safeErrorSummary(error));
    await prisma.billingEvent.delete({ where: { id: webhookId } }).catch(() => undefined);
    throw error;
  }
}
