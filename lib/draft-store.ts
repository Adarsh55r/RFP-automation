import { prisma } from "@/lib/db";
import type { DraftCitations } from "@/lib/citations";
import { DraftStatus, type DraftSection, type Prisma } from "@/lib/generated/prisma";

/**
 * Server-only write used by the drafting route after it has checked the
 * caller owns the RFP. Lives outside `lib/actions` so it is never exposed
 * as a client-callable server action.
 */
export async function upsertGeneratedDraftSection(input: {
  rfpId: string;
  sectionName: DraftSection;
  content: string;
  citations?: DraftCitations;
}) {
  const content = input.content.trim();
  const citations = input.citations as unknown as Prisma.InputJsonValue | undefined;
  if (!content) {
    return;
  }

  const existing = await prisma.draft.findFirst({
    where: { rfpId: input.rfpId, sectionName: input.sectionName },
  });

  if (existing) {
    await prisma.draft.update({
      where: { id: existing.id },
      data: { content, citations, status: DraftStatus.generated },
    });
    return;
  }

  await prisma.draft.create({
    data: {
      rfpId: input.rfpId,
      sectionName: input.sectionName,
      content,
      citations,
      status: DraftStatus.generated,
    },
  });
}
