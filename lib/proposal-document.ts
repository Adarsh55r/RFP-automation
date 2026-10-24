import type { Draft, DraftSection, Rfp } from "@/lib/generated/prisma";
import { draftKey } from "@/lib/draft-store";
import { CITATION_PATTERN, parseCitations, stripCitations } from "@/lib/citations";
import { parseCoverageTable } from "@/lib/coverage-map";
import { rateConflicts } from "@/lib/grounding";
import { citationIds, findPlaceholders, parseMarkdown, type MdBlock } from "@/lib/markdown";
import {
  parseDraftPlan,
  proposalOutline,
  resolveCover,
  type CoverDetails,
} from "@/lib/rfp-draft";

/** Format-neutral proposal, rendered by both the DOCX and PDF exporters. */
export type ProposalDocument = {
  cover: CoverDetails;
  /** Submission date for the cover page; empty to leave the line off. */
  dateLabel: string;
  /**
   * Whether to mark the document "Confidential". Off for public-sector bids:
   * they are usually public records, and blanket marking is discouraged.
   */
  confidential: boolean;
  /** Left-hand footer text when the document is not marked confidential. */
  footerLabel: string;
  pageSize: "letter" | "a4";
  sections: {
    key: string;
    kind: DraftSection;
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
  openItems: { section: string; kind: "Does not match its source" | "Uncited claim" | "Figure to check" | "Absolute claim" | "Note left in the text" | "Conflicting prices" | "Needs your input"; text: string }[];
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
  const byKey = new Map<string, Draft>();
  for (const draft of [...drafts].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())) {
    if (!byKey.has(draftKey(draft))) byKey.set(draftKey(draft), draft);
  }
  return proposalOutline(rfp)
    .map((section) => ({
      key: section.key,
      kind: section.kind,
      title: section.title,
      content: byKey.get(section.key)?.content.trim() ?? "",
      citations: parseCitations(byKey.get(section.key)?.citations),
    }))
    .filter((section) => section.content);
}

function reviewAppendix(sections: ReturnType<typeof exportableSections>): ReviewAppendix {
  const appendix: ReviewAppendix = { sources: [], openItems: [] };
  for (const conflict of rateConflicts(sections)) {
    appendix.openItems.push({
      section: "Whole proposal",
      kind: "Conflicting prices",
      text: `Per ${conflict.unit}: ${conflict.amounts.map((item) => `${item.amount} (${item.where.join(", ")})`).join(" vs ")}`,
    });
  }
  for (const { title: section, content, citations } of sections) {
    const cited = new Set([...content.matchAll(CITATION_PATTERN)].flatMap((m) => citationIds(m[1])));
    for (const id of [...cited].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
      const source = citations?.sources[id];
      appendix.sources.push(
        source
          ? { section, id, title: source.title, excerpt: source.excerpt }
          : { section, id, title: "Unknown source", excerpt: "This marker does not match a library passage. Check the claim." },
      );
    }
    for (const item of citations?.misstated ?? []) {
      appendix.openItems.push({ section, kind: "Does not match its source", text: `${item.claim} (${item.issue})` });
    }
    for (const claim of citations?.unsupported ?? []) {
      appendix.openItems.push({ section, kind: "Uncited claim", text: claim });
    }
    for (const figure of citations?.figures ?? []) {
      appendix.openItems.push({ section, kind: "Figure to check", text: figure });
    }
    for (const claim of citations?.overclaims ?? []) {
      appendix.openItems.push({ section, kind: "Absolute claim", text: claim });
    }
    for (const note of citations?.notes ?? []) {
      appendix.openItems.push({ section, kind: "Note left in the text", text: note });
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

/**
 * The compliance matrix for the buyer: each requirement the proposal must
 * meet and where it answers it. The internal review (statuses, actions,
 * scoring weights, delivery logistics) stays in the app and the review copy.
 * A mandatory requirement the draft does not answer stays as a highlighted
 * gap, so the matrix never claims compliance the proposal does not show.
 */
export function complianceRows(coverageMap: string | null) {
  const rows = parseCoverageTable(coverageMap ?? "");
  if (rows.length === 0) return null;
  const out = rows
    .filter((row) => !/evaluat/i.test(row.type))
    .map((row) => {
      const addressed = row.addressedIn
        // Reviewer notes such as "(not in draft)" or "(pending section)" are for the bidder.
        .replace(/\s*\((?:[^)]*\b(?:draft|pending|narrative|missing|not (?:yet )?(?:in|addressed)|confirm)\b[^)]*)\)/gi, "")
        .replace(/\[\[[^\]]*\]\]/g, "")
        .trim();
      const missing = !addressed || /^[-—–]+$/.test(addressed) || /^gap$/i.test(addressed);
      return {
        // Requirement IDs (M3, S2) are the app's own numbering, not the buyer's.
        requirement: row.requirement.replace(/^[MDESQ]\d+\s*[:.)-]\s*/, ""),
        type: row.type,
        missing,
        reference: missing ? "[[Answer this requirement before submitting]]" : addressed,
      };
    })
    // Delivery logistics left to the bidder (file format, deadline) are not proposal content.
    .filter((row) => !(row.missing && /submission/i.test(row.type)))
    .map(({ requirement, type, reference }) => ({ requirement, type, reference }));
  return out.length > 0 ? out : null;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** The calendar date in a due-date string such as "September 4, 2026, by 4:59 p.m." or "4 September 2026", if unambiguous. */
export function parseDueDate(text: string): Date | null {
  const month = String.raw`(${MONTHS.join("|")}|${MONTHS.map((m) => m.slice(0, 3)).join("|")})\.?`;
  const us = new RegExp(String.raw`${month}\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})`, "i").exec(text);
  const uk = new RegExp(String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${month},?\s+(\d{4})`, "i").exec(text);
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const monthIndex = (name: string) => MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3)));
  let date: Date | null = null;
  if (us) date = new Date(Number(us[3]), monthIndex(us[1]), Number(us[2]));
  else if (uk) date = new Date(Number(uk[3]), monthIndex(uk[2]), Number(uk[1]));
  else if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * The cover page's submission date: the bidder's own entry, else today's
 * date, unless the deadline has already passed (a cover dated after the
 * deadline would mark the bid as late), in which case the line is left off.
 */
export function proposalDateLabel(cover: CoverDetails, locale: string, today = new Date()) {
  if (cover.submissionDate.trim()) return cover.submissionDate.trim();
  const due = parseDueDate(cover.dueDate);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (due && startOfToday > due) return "";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(today);
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
  const cover = resolveCover(plan, { companyName: input.companyName, rfpTitle: rfp.title });

  return {
    cover,
    dateLabel: proposalDateLabel(cover, locale),
    confidential: rfp.extractedDocumentType !== "public_tender",
    footerLabel: cover.projectTitle || cover.bidderName,
    pageSize: locale === "en-GB" ? "a4" : "letter",
    sections: sections.map(({ key, kind, title, content }) => ({
      key,
      kind,
      title,
      // An RFP's own labels ("G. Cost Proposal") are the numbering; ours would clash with them.
      number: plan.outlineFromRfp || kind === "cover_letter" ? null : String((counter += 1)),
      numberSubheadings: !plan.outlineFromRfp && kind !== "cover_letter" && kind !== "responses" && kind !== "form",
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
