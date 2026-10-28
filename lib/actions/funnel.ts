"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { recordEvent } from "@/lib/funnel";

/** The signed-in user asked to start a paid plan by email (the step before checkout, while online checkout is not configured). */
export async function trackCheckoutStarted() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return;
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (user) await recordEvent("checkout_started", { userId: user.id });
}
