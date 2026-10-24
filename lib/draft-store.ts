import { prisma } from "@/lib/db";
import type { DraftCitations } from "@/lib/citations";
import { DraftStatus, type Draft, type Prisma } from "@/lib/generated/prisma";
import type { PlannedSection } from "@/lib/rfp-draft";

/** A draft row's place in the outline. Rows written before outlines existed are keyed by their kind. */
export function draftKey(draft: Pick<Draft, "sectionKey" | "sectionName">) {
  return draft.sectionKey ?? draft.sectionName;
}

/** The stored draft for one outline section, if any. */
export async function findSectionDraft(rfpId: string, section: Pick<PlannedSection, "key" | "kind">) {
  const rows = await prisma.draft.findMany({
    where: {
      rfpId,
      OR: [{ sectionKey: section.key }, { sectionKey: null, sectionName: section.kind }],
    },
    orderBy: { updatedAt: "desc" },
  });
  // A legacy row only stands in for the standard section of its kind.
  return rows.find((row) => draftKey(row) === section.key) ?? null;
}

/**
 * Server-only write used by the drafting route after it has checked the
 * caller owns the RFP. Lives outside `lib/actions` so it is never exposed
 * as a client-callable server action.
 */
export async function upsertGeneratedDraftSection(input: {
  rfpId: string;
  section: PlannedSection;
  content: string;
  citations?: DraftCitations;
}) {
  const content = input.content.trim();
  const citations = input.citations as unknown as Prisma.InputJsonValue | undefined;
  if (!content) {
    return;
  }

  const existing = await findSectionDraft(input.rfpId, input.section);
  const fields = {
    sectionKey: input.section.key,
    sectionName: input.section.kind,
    title: input.section.title,
    content,
    citations,
    status: DraftStatus.generated,
  };

  if (existing) {
    await prisma.draft.update({ where: { id: existing.id }, data: fields });
    return;
  }

  await prisma.draft.create({ data: { rfpId: input.rfpId, ...fields } });
}
