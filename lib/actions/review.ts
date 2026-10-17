"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { RfpStatus } from "@/lib/generated/prisma";
import {
  MAX_REVIEW_PROMPTS,
  REVIEW_PROMPT_GAP_MS,
  REVIEW_RESPONSES,
  feedbackEmail,
  reviewUrl,
  type ReviewResponse,
} from "@/lib/review-prompt";

type Prompt = { show: false } | { show: true; reviewUrl: string; feedbackEmail: string | null };

async function currentUserId() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  return user?.id ?? null;
}

/**
 * Called after an export. Decides whether to ask for a review and, if so,
 * records the ask in the same conditional update, so two quick exports can
 * never show it twice.
 */
export async function claimReviewPrompt(): Promise<Prompt> {
  const url = reviewUrl();
  if (!url) return { show: false };
  const userId = await currentUserId();
  if (!userId) return { show: false };

  const exported = await prisma.rfp.count({ where: { userId, status: RfpStatus.exported } });
  if (exported === 0) return { show: false };

  const now = new Date();
  const claimed = await prisma.user.updateMany({
    where: {
      id: userId,
      reviewPromptCount: { lt: MAX_REVIEW_PROMPTS },
      AND: [
        { OR: [{ reviewResponse: null }, { reviewResponse: "later" }] },
        { OR: [{ reviewPromptedAt: null }, { reviewPromptedAt: { lt: new Date(now.getTime() - REVIEW_PROMPT_GAP_MS) } }] },
      ],
    },
    data: { reviewPromptCount: { increment: 1 }, reviewPromptedAt: now },
  });

  return claimed.count === 1 ? { show: true, reviewUrl: url, feedbackEmail: feedbackEmail() } : { show: false };
}

/** Records what the user chose on the review card. */
export async function respondToReviewPrompt(response: ReviewResponse) {
  if (!REVIEW_RESPONSES.includes(response)) return { ok: false as const };
  const userId = await currentUserId();
  if (!userId) return { ok: false as const };
  await prisma.user.update({
    where: { id: userId },
    data: { reviewResponse: response, reviewRespondedAt: new Date() },
  });
  return { ok: true as const };
}
