import { prisma } from "@/lib/db";
import { DraftStatus, type DraftSection } from "@/lib/generated/prisma";

/**
 * Server-only write used by the drafting route after it has checked the
 * caller owns the RFP. Lives outside `lib/actions` so it is never exposed
 * as a client-callable server action.
 */
export async function upsertGeneratedDraftSection(input: {
  rfpId: string;
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
      data: { content, status: DraftStatus.generated },
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
