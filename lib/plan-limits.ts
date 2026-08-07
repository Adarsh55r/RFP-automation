import type { SubscriptionTier } from "@/lib/generated/prisma";

/** Monthly RFP cap per subscription tier. `null` = unlimited. */
export const monthlyRfpLimit: Record<SubscriptionTier, number | null> = {
  free: 1,
  starter: 5,
  growth: 20,
  agency: null,
};

export function rfpsRemaining(
  tier: SubscriptionTier,
  usedThisMonth: number,
): number | null {
  const limit = monthlyRfpLimit[tier];
  if (limit === null) return null;
  return Math.max(0, limit - usedThisMonth);
}
