"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { teamSizeOptions } from "@/lib/onboarding";

function isTeamSize(
  value: string,
): value is (typeof teamSizeOptions)[number]["value"] {
  return teamSizeOptions.some((option) => option.value === value);
}

export async function updateAgencySettings(payload: {
  agencyName: string;
  teamSize: string;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false as const, error: "You must be signed in." };
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return {
      ok: false as const,
      error: "Complete onboarding before updating settings.",
    };
  }

  const agencyName = payload.agencyName.trim();
  if (agencyName.length < 2) {
    return {
      ok: false as const,
      error: "Enter your agency’s legal or trading name (at least 2 characters).",
    };
  }

  if (!isTeamSize(payload.teamSize)) {
    return { ok: false as const, error: "Pick a valid team size." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { agencyName, teamSize: payload.teamSize },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/billing");

  return { ok: true as const };
}
