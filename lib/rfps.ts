import { cache } from "react";
import { prisma } from "@/lib/db";
import { RfpStatus, type Prisma } from "@/lib/generated/prisma";
import { allowancePeriodStart, computeAllowance, decideUpload, type SubscriptionTerms } from "@/lib/entitlements";
import { recordFirst } from "@/lib/funnel";
import { safeErrorSummary } from "@/lib/safe-log";
import { getRfpStorageBucket, getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * One RFP for its pages. Leaves out the full document text, which can run to
 * 400,000 characters and is only read by the AI routes.
 */
export const getRfpForUser = cache(async (rfpId: string, userId: string) => {
  return prisma.rfp.findFirst({
    where: { id: rfpId, userId },
    omit: { sourceText: true },
  });
});

/** Columns RFP lists show. Keeps large fields (full RFP text, bid plan) out of list queries. */
export const rfpListSelect = {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  extractedDocumentType: true,
  extractedDeadline: true,
} satisfies Prisma.RfpSelect;

export type RfpListItem = Prisma.RfpGetPayload<{ select: typeof rfpListSelect }>;

/** By Clerk ID, so a page can load the list alongside the user lookup instead of after it. */
export async function getRfpsForClerkUser(clerkId: string) {
  return prisma.rfp.findMany({
    // Large uploads create the row before the file arrives; hide them until it does.
    where: { user: { clerkId }, originalFileUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    select: rfpListSelect,
  });
}

/** Upload attempts allowed per account per hour, finished or not. */
export const UPLOADS_PER_HOUR = 10;

/** A large upload not finished within this time is abandoned, and its proposal is given back. */
export const PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000;

const RATE_LIMITED =
  "You have uploaded a lot of files in the last hour. Please wait a few minutes and try again.";

/** Message when the hourly upload rate limit is reached, or null when there is room. */
export async function uploadRateLimited(userId: string) {
  const recent = await prisma.rfp.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  return recent >= UPLOADS_PER_HOUR ? RATE_LIMITED : null;
}

export type Reservation =
  | { ok: true; rfpId: string; overageCents: number | null }
  | { ok: false; status: 402 | 403 | 429; error: string; overagePriceUsd?: number };

/**
 * Starts a new proposal: checks the plan's limit and books the proposal in
 * one step. The account's row is locked while the limit is counted, so two
 * uploads started at the same moment, or several large uploads started
 * before any of them finishes, cannot all see a free slot. The RFP is created
 * without its file; `completeRfpUpload` attaches it, `releaseReservation`
 * gives the proposal back if the upload never completes.
 */
export async function reserveProposal(input: {
  userId: string;
  subscription: SubscriptionTerms;
  title: string;
  now?: Date;
}): Promise<Reservation> {
  const now = input.now ?? new Date();
  await releaseAbandonedUploads(input.userId, now);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE`;

    const recent = await tx.rfp.count({
      where: { userId: input.userId, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
    });
    if (recent >= UPLOADS_PER_HOUR) return { ok: false as const, status: 429 as const, error: RATE_LIMITED };

    const since = allowancePeriodStart(input.subscription, now);
    const used = await tx.proposalUsage.count({
      where: { userId: input.userId, ...(since ? { createdAt: { gte: since } } : {}) },
    });
    const extra = await tx.extraProposal.findFirst({
      where: { userId: input.userId, usedAt: null },
      orderBy: { createdAt: "asc" },
    });
    const decision = decideUpload(computeAllowance(input.subscription, used, now), extra ? 1 : 0);
    if (!decision.ok) return decision;

    // Past the limit, the proposal uses an extra the user already paid for at checkout.
    const overageCents = decision.useExtra && extra ? extra.amountCents : null;
    const rfp = await tx.rfp.create({
      data: { userId: input.userId, title: input.title, status: RfpStatus.uploaded, overageCents },
    });
    if (decision.useExtra && extra) {
      await tx.extraProposal.update({ where: { id: extra.id }, data: { usedAt: now, rfpId: rfp.id } });
    }
    await tx.proposalUsage.create({
      data: { userId: input.userId, rfpId: rfp.id, overageCents, overageBilledAt: overageCents === null ? null : now },
    });
    return { ok: true as const, rfpId: rfp.id, overageCents };
  });
}

/**
 * Gives back the proposal booked for an upload that never completed (failed,
 * cancelled, invalid or abandoned) and removes its RFP. Does nothing once the
 * file has arrived: a finished proposal stays counted, even if deleted later.
 */
export async function releaseReservation(rfpId: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const pending = await tx.rfp.findFirst({ where: { id: rfpId, userId, originalFileUrl: null }, select: { id: true } });
    if (!pending) return;
    // A paid extra the upload was using is kept for the next one.
    await tx.extraProposal.updateMany({ where: { rfpId, userId }, data: { usedAt: null, rfpId: null } });
    await tx.proposalUsage.deleteMany({ where: { rfpId, userId } });
    await tx.rfp.delete({ where: { id: rfpId } });
  });
}

/** Releases this account's uploads started more than an hour ago and never finished, with any file left behind. */
export async function releaseAbandonedUploads(userId: string, now = new Date()) {
  const stale = await prisma.rfp.findMany({
    where: { userId, originalFileUrl: null, createdAt: { lt: new Date(now.getTime() - PENDING_UPLOAD_TTL_MS) } },
    select: { id: true },
  });
  for (const { id } of stale) {
    await removePendingFiles(`${userId}/${id}`);
    await releaseReservation(id, userId);
  }
}

/** Best effort: storage may not be configured, and a stray file must not block the user. */
async function removePendingFiles(folder: string) {
  try {
    const bucket = getSupabaseAdmin().storage.from(getRfpStorageBucket());
    const { data } = await bucket.list(folder);
    if (data?.length) await bucket.remove(data.map((item) => `${folder}/${item.name}`));
  } catch (error) {
    console.error("[uploads] Could not remove an abandoned upload's file:", safeErrorSummary(error));
  }
}

/**
 * Marks an upload as finished. The proposal was booked when the upload
 * started (`reserveProposal`); uploads started before reservations existed
 * get their proposal recorded here, exactly once.
 */
export async function completeRfpUpload(
  rfpId: string,
  userId: string,
  originalFileUrl: string,
  overageCents: number | null = null,
) {
  await prisma.$transaction(async (tx) => {
    await tx.rfp.update({ where: { id: rfpId }, data: { originalFileUrl } });
    const booked = await tx.proposalUsage.count({ where: { rfpId, userId } });
    if (booked === 0) await tx.proposalUsage.create({ data: { userId, rfpId, overageCents } });
  });
  const proposals = await prisma.proposalUsage.count({ where: { userId } });
  if (proposals === 1) await recordFirst("first_upload", userId);
  if (proposals === 2) await recordFirst("second_proposal", userId);
}
