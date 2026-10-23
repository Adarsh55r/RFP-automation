"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import type { SubscriptionTier } from "@/lib/generated/prisma";
import { CURRENT_PLAN_VERSION, PLANS } from "@/lib/plans";
import { recordFirst } from "@/lib/funnel";

/** Plans an admin can assign. Legacy Growth and Team are not re-assignable; existing accounts keep them. */
const TIERS: SubscriptionTier[] = ["free", "single_bid", "starter", "pro", "consultant", "pilot"];

type Result = { ok: true } | { ok: false; error: string };

async function run(action: () => Promise<void>, paths: string[]): Promise<Result> {
  try {
    const admin = await assertAdmin();
    await action();
    console.info(`[admin] ${admin} updated ${paths.join(", ")}`);
    for (const path of paths) revalidatePath(path);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Action failed." };
  }
}

/** Moves an account to another plan (manual override until Stripe billing is live). */
export async function adminSetPlan(userId: string, tier: string) {
  if (!TIERS.includes(tier as SubscriptionTier)) {
    return { ok: false as const, error: "Unknown plan." };
  }
  const plan = PLANS[tier as SubscriptionTier];
  // A plan change moves the account onto current pricing; one-time plans get their access window from today.
  const terms = {
    tier: tier as SubscriptionTier,
    status: "active" as const,
    planVersion: CURRENT_PLAN_VERSION,
    accessEndsAt:
      plan.billing.kind === "one_time" ? new Date(Date.now() + plan.billing.accessDays * 24 * 60 * 60 * 1000) : null,
  };
  return run(async () => {
    await prisma.subscription.upsert({
      where: { userId },
      update: terms,
      create: { userId, ...terms },
    });
    if (plan.billing.kind !== "free") await recordFirst("paid", userId);
  }, [`/admin/customers/${userId}`, "/admin/customers", "/admin"]);
}

/** Gives a proposal its extractions, full drafts, and revisions back. */
export async function adminResetAllowance(userId: string, rfpId: string) {
  return run(async () => {
    await prisma.rfp.updateMany({
      where: { id: rfpId, userId },
      data: { extractCount: 0, fullDraftCount: 0, revisionCount: 0, lastFullDraftAt: null },
    });
  }, [`/admin/customers/${userId}`, "/admin/alerts"]);
}

/** Clears a stuck one-task-at-a-time AI lock. */
export async function adminUnlockAi(userId: string) {
  return run(async () => {
    await prisma.user.update({ where: { id: userId }, data: { aiBusyUntil: null } });
  }, [`/admin/customers/${userId}`, "/admin/alerts"]);
}

/** Lets an account see the review request again (e.g. to test it on your own account). */
export async function adminResetReviewPrompt(userId: string) {
  return run(async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { reviewPromptCount: 0, reviewPromptedAt: null, reviewResponse: null, reviewRespondedAt: null },
    });
  }, [`/admin/customers/${userId}`, "/admin"]);
}
