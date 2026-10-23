"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { TERMS_VERSION } from "@/lib/legal";

/** Records that the signed-in user accepted the current Terms of Service and Privacy Policy. */
export async function acceptCurrentTerms(accepted: boolean) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false as const, error: "You must be signed in." };
  }
  if (accepted !== true) {
    return { ok: false as const, error: "Tick the box to accept the Terms of Service and Privacy Policy." };
  }
  const result = await prisma.user.updateMany({
    where: { clerkId },
    data: { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() },
  });
  if (result.count === 0) {
    return { ok: false as const, error: "Complete onboarding first." };
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true as const };
}
