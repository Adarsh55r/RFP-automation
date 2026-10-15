import type { Draft, DraftSection, Rfp } from "@/lib/generated/prisma";
import { parseMarkdown, type MdBlock } from "@/lib/markdown";
import {
  draftSectionLabel,
  parseDraftPlan,
  sectionsForRfp,
} from "@/lib/rfp-draft";

/** Format-neutral proposal, rendered by both the DOCX and PDF exporters. */
export type ProposalDocument = {
  companyName: string;
  rfpTitle: string;
  buyerName: string;
  solicitationNumber: string;
  dueDate: string;
  dateLabel: string;
  pageSize: "letter" | "a4";
  sections: {
    key: DraftSection;
    title: string;
    /** "1", "2", … — the cover letter is unnumbered. */
    number: string | null;
    blocks: MdBlock[];
  }[];
};

export type ExportFormat = "docx" | "pdf";

export function isExportFormat(value: unknown): value is ExportFormat {
  return value === "docx" || value === "pdf";
}

function exportableSections(rfp: Rfp, drafts: Draft[]) {
  const bySection = new Map(drafts.map((draft) => [draft.sectionName, draft.content.trim()]));
  return sectionsForRfp(rfp)
    .map((key) => ({ key, content: bySection.get(key) ?? "" }))
    .filter((section) => section.content);
}

export function draftsReadyForExport(rfp: Rfp, drafts: Draft[]) {
  return exportableSections(rfp, drafts).length > 0;
}

export function buildProposalDocument(input: {
  companyName: string;
  rfp: Rfp;
  drafts: Draft[];
}): ProposalDocument {
  const { rfp } = input;
  const plan = parseDraftPlan(rfp.draftPlan);
  const locale = plan.language;
  let counter = 0;

  return {
    companyName: input.companyName,
    rfpTitle: plan.projectTitle || rfp.title,
    buyerName: plan.buyerName,
    solicitationNumber: plan.solicitationNumber,
    dueDate: plan.dueDate,
    dateLabel: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date()),
    pageSize: locale === "en-GB" ? "a4" : "letter",
    sections: exportableSections(rfp, input.drafts).map(({ key, content }) => ({
      key,
      title: draftSectionLabel[key],
      number: key === "cover_letter" ? null : String((counter += 1)),
      blocks: parseMarkdown(content),
    })),
  };
}

export function proposalExportFileName(rfpTitle: string, format: ExportFormat) {
  const safe = rfpTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${safe || "proposal"}-proposal.${format}`;
}
