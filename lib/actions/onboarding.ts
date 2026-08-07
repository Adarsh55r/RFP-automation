"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import type { OnboardingPayload } from "@/lib/onboarding";
import { teamSizeOptions } from "@/lib/onboarding";
import { SubscriptionStatus, SubscriptionTier } from "@/lib/generated/prisma";

function isTeamSize(
  value: string,
): value is (typeof teamSizeOptions)[number]["value"] {
  return teamSizeOptions.some((option) => option.value === value);
}

/**
 * Persist the onboarding User to Neon and seed a free Subscription.
 * Intended paid plan stays in Clerk unsafeMetadata for the billing step.
 */
export async function completeOnboarding(payload: OnboardingPayload) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false as const, error: "You must be signed in." };
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return { ok: false as const, error: "Could not load your Clerk account." };
  }

  const agencyName = payload.agencyName.trim();
  if (agencyName.length < 2) {
    return { ok: false as const, error: "Enter a valid agency name." };
  }

  if (!isTeamSize(payload.teamSize)) {
    return { ok: false as const, error: "Pick a valid team size." };
  }

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    return { ok: false as const, error: "Your account needs an email address." };
  }

  const user = await prisma.user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      email,
      agencyName,
      teamSize: payload.teamSize,
      subscription: {
        create: {
          tier: SubscriptionTier.free,
          status: SubscriptionStatus.active,
        },
      },
    },
    update: {
      email,
      agencyName,
      teamSize: payload.teamSize,
    },
  });

  return { ok: true as const, userId: user.id };
}
