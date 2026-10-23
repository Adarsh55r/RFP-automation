import { prisma } from "@/lib/db";
import { safeErrorSummary } from "@/lib/safe-log";
import { ATTRIBUTION_SOURCES, isAttributionSource } from "@/lib/funnel-sources";

/**
 * Product funnel events, kept in our own database. They hold the event name,
 * the account for signed-in events, and for anonymous page events only the
 * path and marketing segment: no document content, no cookies, no IPs.
 */
export const FUNNEL_EVENTS = [
  "visit",
  "visit_pricing",
  "start_signup",
  "complete_signup",
  "first_upload",
  "checklist_confirmed",
  "first_draft",
  "first_export",
  "upgrade_viewed",
  "checkout_started",
  "paid",
  "second_proposal",
  "outcome_logged",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

/** Events a visitor's browser may send without signing in. */
export const ANONYMOUS_EVENTS: FunnelEventName[] = ["visit", "visit_pricing", "start_signup"];

export { ATTRIBUTION_SOURCES, isAttributionSource } from "@/lib/funnel-sources";

export { INDUSTRIES } from "@/lib/funnel-sources";

/** Records an event. Never throws: analytics must not break the product. */
export async function recordEvent(event: FunnelEventName, data: { userId?: string; segment?: string | null; path?: string | null } = {}) {
  try {
    await prisma.funnelEvent.create({
      data: {
        event,
        userId: data.userId ?? null,
        segment: isAttributionSource(data.segment) ? data.segment : null,
        path: data.path ? data.path.slice(0, 200) : null,
      },
    });
  } catch (error) {
    console.error(`[funnel] Could not record ${event}:`, safeErrorSummary(error));
  }
}

/** Records a milestone the first time an account reaches it. */
export async function recordFirst(event: FunnelEventName, userId: string) {
  try {
    const seen = await prisma.funnelEvent.findFirst({ where: { event, userId }, select: { id: true } });
    if (!seen) await recordEvent(event, { userId });
  } catch (error) {
    console.error(`[funnel] Could not check ${event}:`, safeErrorSummary(error));
  }
}

export type FunnelRow = {
  segment: string;
  visits: number;
  signups: number;
  firstDraft: number;
  paid: number;
  secondProposal: number;
};

/**
 * Visits → signups → first draft → paid → second proposal, by the segment the
 * account signed up from ("none" when it came without one).
 */
export async function funnelBySegment(since: Date): Promise<FunnelRow[]> {
  const [visits, users, milestones] = await Promise.all([
    prisma.funnelEvent.groupBy({
      by: ["segment"],
      where: { event: "visit", createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, signupSegment: true } }),
    prisma.funnelEvent.findMany({
      where: { event: { in: ["first_draft", "paid", "second_proposal"] }, userId: { not: null }, createdAt: { gte: since } },
      select: { event: true, userId: true },
      distinct: ["event", "userId"],
    }),
  ]);
  const segmentOf = new Map(users.map((user) => [user.id, user.signupSegment ?? "none"]));
  const rows = new Map<string, FunnelRow>();
  const row = (segment: string) => {
    if (!rows.has(segment)) rows.set(segment, { segment, visits: 0, signups: 0, firstDraft: 0, paid: 0, secondProposal: 0 });
    return rows.get(segment)!;
  };
  for (const source of [...ATTRIBUTION_SOURCES, "none"]) row(source);
  for (const visit of visits) row(visit.segment ?? "none").visits += visit._count._all;
  for (const user of users) row(user.signupSegment ?? "none").signups += 1;
  for (const milestone of milestones) {
    const segment = segmentOf.get(milestone.userId!);
    if (!segment) continue; // signed up before the period
    const target = row(segment);
    if (milestone.event === "first_draft") target.firstDraft += 1;
    if (milestone.event === "paid") target.paid += 1;
    if (milestone.event === "second_proposal") target.secondProposal += 1;
  }
  return [...rows.values()];
}
