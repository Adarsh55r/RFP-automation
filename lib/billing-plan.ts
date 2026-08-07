import { parsePlanId } from "@/lib/intended-plan";
import type { PlanId } from "@/types";

/**
 * Read the plan the user picked on pricing — for the billing step.
 * Prefers Clerk unsafeMetadata, which survives after first login.
 */
export function getIntendedPlan(
  user: { unsafeMetadata?: UserUnsafeMetadata } | null | undefined,
): PlanId | undefined {
  return parsePlanId(
    user?.unsafeMetadata?.intendedPlan
      ? String(user.unsafeMetadata.intendedPlan)
      : undefined,
  );
}
