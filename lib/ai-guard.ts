import { prisma } from "@/lib/db";
import type { SubscriptionTier } from "@/lib/generated/prisma";

/**
 * Protections against runaway AI spend: per-proposal allowances, a monthly
 * spend cap per account, one AI task at a time, a cooldown between full
 * regenerations, and an hourly call limit.
 */

export type AiOperation = "extract" | "full_draft" | "revision";

export type ProposalAllowance = { extract: number; full_draft: number; revision: number };

/** Per uploaded RFP. "full_draft" counts the first draft plus regenerations. */
export function proposalAllowance(tier: SubscriptionTier): ProposalAllowance {
  return tier === "free"
    ? { extract: 2, full_draft: 2, revision: 10 }
    : { extract: 3, full_draft: 4, revision: 20 };
}

/** Monthly AI spend ceiling per account, in US dollars. */
export const monthlySpendCapUsd: Record<SubscriptionTier, number> = {
  free: 3,
  starter: 15,
  growth: 60,
  agency: 200,
};

export const FULL_DRAFT_COOLDOWN_SECONDS = 60;
export const HOURLY_CALL_LIMIT = 120;
/** Longest an AI task can hold the account lock if it never releases (crash, timeout). */
const LOCK_MINUTES = 6;

const counterField = {
  extract: "extractCount",
  full_draft: "fullDraftCount",
  revision: "revisionCount",
} as const;

export type AiDenied = { ok: false; status: number; error: string };
export type AiGranted = { ok: true; release: () => Promise<void> };

function startOfMonthUtc(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function monthlySpendUsd(userId: string, now = new Date()) {
  const total = await prisma.aiUsage.aggregate({
    where: { userId, createdAt: { gte: startOfMonthUtc(now) } },
    _sum: { costMicros: true },
  });
  return (total._sum.costMicros ?? 0) / 1_000_000;
}

async function alertSpendCap(user: { id: string; email: string }, spentUsd: number, capUsd: number) {
  const month = new Date().toISOString().slice(0, 7);
  // Only the first request to flip the flag this month sends the alert.
  const claimed = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ aiAlertMonth: null }, { aiAlertMonth: { not: month } }] },
    data: { aiAlertMonth: month },
  });
  if (claimed.count === 0) return;

  const text = `[DraftWin] AI spend cap reached: ${user.email} (user ${user.id}) spent $${spentUsd.toFixed(2)} of $${capUsd} in ${month}. AI features are paused for this account until next month.`;
  console.error(`[ai-budget] ALERT ${text}`);
  const webhook = process.env.ALERT_WEBHOOK_URL?.trim();
  if (webhook) {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch((error) => console.error("[ai-budget] Alert webhook failed:", error));
  }
}

/**
 * Checks every limit and, if allowed, takes the account's AI lock and uses one
 * unit of the proposal's allowance. Call `release()` when the task finishes.
 */
export async function beginAiOperation(input: {
  user: { id: string; email: string };
  tier: SubscriptionTier;
  rfpId: string;
  operation: AiOperation;
}): Promise<AiGranted | AiDenied> {
  const { user, tier, rfpId, operation } = input;
  const now = new Date();

  const capUsd = monthlySpendCapUsd[tier];
  const spentUsd = await monthlySpendUsd(user.id, now);
  if (spentUsd >= capUsd) {
    await alertSpendCap(user, spentUsd, capUsd);
    return {
      ok: false,
      status: 429,
      error:
        "This account has reached its AI usage limit for the month. Contact support if you need more capacity — it resets on the 1st.",
    };
  }

  const callsLastHour = await prisma.aiUsage.count({
    where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
  });
  if (callsLastHour >= HOURLY_CALL_LIMIT) {
    return {
      ok: false,
      status: 429,
      error: "You've made a lot of AI requests in the last hour. Please wait a few minutes and try again.",
    };
  }

  // One AI task at a time per account. The lock expires on its own if a task dies.
  const locked = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ aiBusyUntil: null }, { aiBusyUntil: { lt: now } }] },
    data: { aiBusyUntil: new Date(now.getTime() + LOCK_MINUTES * 60 * 1000) },
  });
  if (locked.count === 0) {
    return {
      ok: false,
      status: 409,
      error: "Another AI task is still running for your account. Wait for it to finish, then try again.",
    };
  }
  const release = async () => {
    await prisma.user
      .update({ where: { id: user.id }, data: { aiBusyUntil: null } })
      .catch((error) => console.error("[ai-guard] Could not release AI lock:", error));
  };

  const allowance = proposalAllowance(tier);
  const field = counterField[operation];
  const cooldownStart = new Date(now.getTime() - FULL_DRAFT_COOLDOWN_SECONDS * 1000);

  // Conditional increment: concurrent requests can't both pass the allowance check.
  const reserved = await prisma.rfp.updateMany({
    where: {
      id: rfpId,
      [field]: { lt: allowance[operation] },
      ...(operation === "full_draft"
        ? { OR: [{ lastFullDraftAt: null }, { lastFullDraftAt: { lt: cooldownStart } }] }
        : {}),
    },
    data: {
      [field]: { increment: 1 },
      ...(operation === "full_draft" ? { lastFullDraftAt: now } : {}),
    },
  });

  if (reserved.count === 0) {
    await release();
    const rfp = await prisma.rfp.findUnique({
      where: { id: rfpId },
      select: { extractCount: true, fullDraftCount: true, revisionCount: true, lastFullDraftAt: true },
    });
    const used = rfp ? rfp[field] : allowance[operation];
    if (operation === "full_draft" && rfp && used < allowance.full_draft && rfp.lastFullDraftAt) {
      const wait = Math.max(
        1,
        Math.ceil((rfp.lastFullDraftAt.getTime() + FULL_DRAFT_COOLDOWN_SECONDS * 1000 - now.getTime()) / 1000),
      );
      return { ok: false, status: 429, error: `Please wait ${wait} seconds before regenerating the whole proposal again.` };
    }
    const messages: Record<AiOperation, string> = {
      extract: `You've used all ${allowance.extract} requirement extractions for this RFP. Edit the requirements by hand, or upload it again as a new proposal.`,
      full_draft: `You've used all ${allowance.full_draft} full drafts for this proposal. Use "Revise with AI" on individual sections, or upload the RFP again as a new proposal.`,
      revision: `You've used all ${allowance.revision} section revisions for this proposal. You can still edit sections by hand, or upload the RFP again as a new proposal.`,
    };
    return { ok: false, status: 429, error: messages[operation] };
  }

  return { ok: true, release };
}
