import type { Draft, DraftSection, Rfp } from "@/lib/generated/prisma";
import { parseCoverageTable } from "@/lib/coverage-map";
import { parseMarkdown, type MdBlock } from "@/lib/markdown";
import {
  draftSectionLabel,
  parseDraftPlan,
  resolveCover,
  sectionsForRfp,
  type CoverDetails,
} from "@/lib/rfp-draft";

/** Format-neutral proposal, rendered by both the DOCX and PDF exporters. */
export type ProposalDocument = {
  cover: CoverDetails;
  dateLabel: string;
  pageSize: "letter" | "a4";
  sections: {
    key: DraftSection;
    title: string;
    /** "1", "2", … — the cover letter is unnumbered. */
    number: string | null;
    /** Number "##" subheadings as 1.1, 1.2 (not for letters or question lists). */
    numberSubheadings: boolean;
    blocks: MdBlock[];
  }[];
  /** Appendix mapping each requirement to where the proposal answers it. */
  complianceMatrix: { requirement: string; type: string; reference: string }[] | null;
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

function complianceRows(coverageMap: string | null) {
  const rows = parseCoverageTable(coverageMap ?? "");
  if (rows.length === 0) return null;
  return rows.map((row) => {
    const addressed = row.addressedIn.trim();
    const missing = !addressed || /^[-—–]+$/.test(addressed);
    return {
      requirement: row.requirement,
      type: row.type,
      // Never claim compliance the draft does not show: unanswered rows stay a visible gap.
      reference: missing ? "[[Confirm where this is addressed]]" : addressed,
    };
  });
}

export function buildProposalDocument(input: {
  companyName: string;
  rfp: Rfp;
  drafts: Draft[];
  includeComplianceMatrix: boolean;
}): ProposalDocument {
  const { rfp } = input;
  const plan = parseDraftPlan(rfp.draftPlan);
  const locale = plan.language;
  let counter = 0;

  return {
    cover: resolveCover(plan, { companyName: input.companyName, rfpTitle: rfp.title }),
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
      numberSubheadings: key !== "cover_letter" && key !== "responses",
      blocks: parseMarkdown(content),
    })),
    complianceMatrix: input.includeComplianceMatrix ? complianceRows(rfp.coverageMap) : null,
  };
}

export function proposalExportFileName(title: string, format: ExportFormat) {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${safe || "proposal"}-proposal.${format}`;
}
