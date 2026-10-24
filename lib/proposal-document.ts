import type { Draft, DraftSection, Rfp } from "@/lib/generated/prisma";
import { CITATION_PATTERN, parseCitations, stripCitations } from "@/lib/citations";
import { parseCoverageTable } from "@/lib/coverage-map";
import { findPlaceholders, parseMarkdown, type MdBlock } from "@/lib/markdown";
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
  /**
   * "submission" is the clean copy for the buyer (citation markers removed).
   * "review" keeps the markers and adds an internal appendix of sources and
   * open items, for checking the draft before it goes out.
   */
  variant: ExportVariant;
  review: ReviewAppendix | null;
};

export type ReviewAppendix = {
  sources: { section: string; id: string; title: string; excerpt: string }[];
  openItems: { section: string; kind: "Uncited claim" | "Needs your input"; text: string }[];
};

export type ExportFormat = "docx" | "pdf";
export type ExportVariant = "submission" | "review";

export function isExportFormat(value: unknown): value is ExportFormat {
  return value === "docx" || value === "pdf";
}

export function isExportVariant(value: unknown): value is ExportVariant {
  return value === "submission" || value === "review";
}

function exportableSections(rfp: Rfp, drafts: Draft[]) {
  const bySection = new Map(drafts.map((draft) => [draft.sectionName, draft]));
  return sectionsForRfp(rfp)
    .map((key) => ({
      key,
      content: bySection.get(key)?.content.trim() ?? "",
      citations: parseCitations(bySection.get(key)?.citations),
    }))
    .filter((section) => section.content);
}

function reviewAppendix(sections: ReturnType<typeof exportableSections>): ReviewAppendix {
  const appendix: ReviewAppendix = { sources: [], openItems: [] };
  for (const { key, content, citations } of sections) {
    const section = draftSectionLabel[key];
    const cited = new Set([...content.matchAll(CITATION_PATTERN)].flatMap((m) => m[1].split(/\s*,\s*/)));
    for (const id of [...cited].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
      const source = citations?.sources[id];
      appendix.sources.push(
        source
          ? { section, id, title: source.title, excerpt: source.excerpt }
          : { section, id, title: "Unknown source", excerpt: "This marker does not match a library passage. Check the claim." },
      );
    }
    for (const claim of citations?.unsupported ?? []) {
      appendix.openItems.push({ section, kind: "Uncited claim", text: claim });
    }
    for (const placeholder of findPlaceholders(content)) {
      appendix.openItems.push({ section, kind: "Needs your input", text: placeholder });
    }
  }
  return appendix;
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
  variant?: ExportVariant;
}): ProposalDocument {
  const { rfp } = input;
  const variant = input.variant ?? "submission";
  const sections = exportableSections(rfp, input.drafts);
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
    sections: sections.map(({ key, content }) => ({
      key,
      title: draftSectionLabel[key],
      number: key === "cover_letter" ? null : String((counter += 1)),
      numberSubheadings: key !== "cover_letter" && key !== "responses",
      blocks: parseMarkdown(variant === "review" ? content : stripCitations(content)),
    })),
    complianceMatrix: input.includeComplianceMatrix ? complianceRows(rfp.coverageMap) : null,
    variant,
    review: variant === "review" ? reviewAppendix(sections) : null,
  };
}

export function proposalExportFileName(title: string, format: ExportFormat, variant: ExportVariant = "submission") {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${safe || "proposal"}-${variant === "review" ? "review-copy" : "proposal"}.${format}`;
}
