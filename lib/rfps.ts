import { cache } from "react";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

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

/**
 * Marks an upload as finished and records that it used one proposal from the
 * plan, together. Abandoned uploads never reach this, so they never count.
 */
export async function completeRfpUpload(
  rfpId: string,
  userId: string,
  originalFileUrl: string,
  overageCents: number | null = null,
) {
  await prisma.$transaction([
    prisma.rfp.update({ where: { id: rfpId }, data: { originalFileUrl } }),
    // A confirmed extra charge is recorded with the proposal, to be billed once checkout is live.
    prisma.proposalUsage.create({ data: { userId, rfpId, overageCents } }),
  ]);
}

/** Upload attempts allowed per account per hour, finished or not. */
export const UPLOADS_PER_HOUR = 10;

/** Message when the hourly upload rate limit is reached, or null when there is room. */
export async function uploadRateLimited(userId: string) {
  const recent = await prisma.rfp.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  return recent >= UPLOADS_PER_HOUR
    ? "You have uploaded a lot of files in the last hour. Please wait a few minutes and try again."
    : null;
}
