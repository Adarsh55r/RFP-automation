"use server";

import { auth } from "@clerk/nextjs/server";
import { billingPortalUrl, startExtraProposalCheckout, startPlanCheckout, type BillingResult } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { recordEvent } from "@/lib/funnel";
import { isSellablePlan } from "@/lib/plans";
import { safeErrorSummary } from "@/lib/safe-log";
import type { BillingCycle } from "@/types";

const FAILED = "Could not reach the payment provider. Try again in a minute; nothing was charged.";

async function signedInUserId() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  return user?.id ?? null;
}

async function run(label: string, task: (userId: string) => Promise<BillingResult>): Promise<BillingResult> {
  const userId = await signedInUserId();
  if (!userId) return { ok: false, error: "You must be signed in." };
  try {
    return await task(userId);
  } catch (error) {
    console.error(`[billing] ${label} failed:`, safeErrorSummary(error));
    return { ok: false, error: FAILED };
  }
}

/** Checkout for a plan, or a plan change for someone already subscribed. */
export async function choosePlan(planId: string, cycle: string) {
  if (!isSellablePlan(planId)) return { ok: false as const, error: "That plan cannot be bought online." };
  const billingCycle: BillingCycle = cycle === "annual" ? "annual" : "monthly";
  return run("Plan checkout", async (userId) => {
    const result = await startPlanCheckout(userId, planId, billingCycle);
    if (result.ok) await recordEvent("checkout_started", { userId });
    return result;
  });
}

/** Checkout for one extra proposal, paid before the upload that needs it. */
export async function buyExtraProposal() {
  return run("Extra proposal checkout", startExtraProposalCheckout);
}

/** Dodo's customer portal: invoices, payment method and cancellation. */
export async function openBillingPortal() {
  return run("Billing portal", billingPortalUrl);
}
