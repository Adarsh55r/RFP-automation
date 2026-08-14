"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { DraftSection, DraftStatus, RfpStatus } from "@/lib/generated/prisma";
import { isDraftSection } from "@/lib/rfp-draft";

export async function saveDraftSection(input: {
  rfpId: string;
  sectionName: string;
  content: string;
}) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return { ok: false as const, error: "You must be signed in." };
  }

  if (!isDraftSection(input.sectionName)) {
    return { ok: false as const, error: "Invalid draft section." };
  }

  const content = input.content.trim();
  if (!content) {
    return { ok: false as const, error: "Section content cannot be empty." };
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return { ok: false as const, error: "Complete onboarding first." };
  }

  const rfp = await prisma.rfp.findFirst({
    where: { id: input.rfpId, userId: user.id },
  });

  if (!rfp) {
    return { ok: false as const, error: "RFP not found." };
  }

  const sectionName = input.sectionName as DraftSection;

  const existing = await prisma.draft.findFirst({
    where: { rfpId: rfp.id, sectionName },
  });

  const draft = existing
    ? await prisma.draft.update({
        where: { id: existing.id },
        data: {
          content,
          status: DraftStatus.edited,
        },
      })
    : await prisma.draft.create({
        data: {
          rfpId: rfp.id,
          sectionName,
          content,
          status: DraftStatus.edited,
        },
      });

  if (rfp.status === RfpStatus.drafting || rfp.status === RfpStatus.extracted) {
    const sections = await prisma.draft.findMany({
      where: { rfpId: rfp.id },
      select: { sectionName: true },
    });
    const names = new Set(sections.map((item) => item.sectionName));
    const complete = (
      ["exec_summary", "technical_approach", "team", "pricing"] as const
    ).every((name) => names.has(name));

    if (complete) {
      await prisma.rfp.update({
        where: { id: rfp.id },
        data: { status: RfpStatus.drafting },
      });
    }
  }

  revalidatePath(`/dashboard/rfps/${rfp.id}/draft`);
  revalidatePath(`/dashboard/rfps/${rfp.id}`);

  return {
    ok: true as const,
    draft: {
      id: draft.id,
      sectionName: draft.sectionName,
      content: draft.content,
      status: draft.status,
      updatedAt: draft.updatedAt.toISOString(),
    },
  };
}

export async function upsertGeneratedDraftSection(input: {
  rfpId: string;
  userId: string;
  sectionName: DraftSection;
  content: string;
}) {
  const content = input.content.trim();
  if (!content) {
    return;
  }

  const existing = await prisma.draft.findFirst({
    where: { rfpId: input.rfpId, sectionName: input.sectionName },
  });

  if (existing) {
    await prisma.draft.update({
      where: { id: existing.id },
      data: {
        content,
        status: DraftStatus.generated,
      },
    });
    return;
  }

  await prisma.draft.create({
    data: {
      rfpId: input.rfpId,
      sectionName: input.sectionName,
      content,
      status: DraftStatus.generated,
    },
  });
}
