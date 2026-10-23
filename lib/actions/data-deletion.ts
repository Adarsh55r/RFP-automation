"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DELETE_WORKSPACE_CONFIRMATION } from "@/lib/data-deletion";
import { RfpStatus } from "@/lib/generated/prisma";
import { reportError } from "@/lib/monitoring";
import { removeRfpFiles } from "@/lib/rfp-storage";

async function signedInUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  return prisma.user.findUnique({ where: { clerkId } });
}

const STORAGE_FAILED =
  "We could not delete the stored file just now, so nothing was deleted. Try again in a moment.";

/**
 * Deletes one RFP: its stored file, extracted text, requirements and drafts.
 * The plan usage it consumed stays recorded, so the monthly limit is unchanged.
 */
export async function deleteRfp(rfpId: string) {
  const user = await signedInUser();
  if (!user) return { ok: false as const, error: "You must be signed in." };

  const rfp = await prisma.rfp.findFirst({ where: { id: rfpId, userId: user.id }, select: { id: true, status: true } });
  if (!rfp) return { ok: false as const, error: "RFP not found." };

  const aiRunning = Boolean(user.aiBusyUntil && user.aiBusyUntil > new Date());
  if (aiRunning && (rfp.status === RfpStatus.extracting || rfp.status === RfpStatus.drafting)) {
    return { ok: false as const, error: "This RFP is being processed. Wait for it to finish, then delete it." };
  }

  try {
    await removeRfpFiles(user.id, rfp.id);
  } catch (error) {
    reportError(error, { area: "delete-rfp", userId: user.id, rfpId: rfp.id });
    return { ok: false as const, error: STORAGE_FAILED };
  }
  await prisma.rfp.delete({ where: { id: rfp.id } });
  revalidatePath("/dashboard", "layout");
  return { ok: true as const };
}

/**
 * Deletes the whole workspace: every stored file, RFP, draft, library item,
 * usage record and the account's plan. The Clerk sign-in itself is left for
 * the user to remove from their account menu.
 */
export async function deleteWorkspace(confirmation: string) {
  if (confirmation.trim() !== DELETE_WORKSPACE_CONFIRMATION) {
    return { ok: false as const, error: `Type ${DELETE_WORKSPACE_CONFIRMATION} to confirm.` };
  }
  const user = await signedInUser();
  if (!user) return { ok: false as const, error: "You must be signed in." };

  const rfps = await prisma.rfp.findMany({ where: { userId: user.id }, select: { id: true } });
  try {
    for (const rfp of rfps) {
      await removeRfpFiles(user.id, rfp.id);
    }
  } catch (error) {
    reportError(error, { area: "delete-workspace", userId: user.id });
    return { ok: false as const, error: STORAGE_FAILED };
  }
  // Cascades to the subscription, RFPs, drafts, library items and usage records.
  await prisma.user.delete({ where: { id: user.id } });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
