"use server";

import type { OnboardingPayload } from "@/lib/onboarding";
import { saveOnboarding } from "@/lib/onboarding-store";

/**
 * Persist the onboarding User to Neon and seed a free Subscription.
 * Intended paid plan stays in Clerk unsafeMetadata for the billing step.
 */
export async function completeOnboarding(payload: OnboardingPayload) {
  if (payload.acceptTerms !== true) {
    return {
      ok: false as const,
      error: "Please accept the Terms of Service and Privacy Policy to continue.",
    };
  }
  return saveOnboarding(payload, true);
}
