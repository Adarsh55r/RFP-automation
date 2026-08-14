import type { DraftSection, LibraryItem, Rfp } from "@/lib/generated/prisma";
import { listToEditableText, scopeToEditableText } from "@/lib/rfp-extract-form";

export const DRAFT_SECTIONS: DraftSection[] = [
  "exec_summary",
  "technical_approach",
  "team",
  "pricing",
];

export const draftSectionLabel: Record<DraftSection, string> = {
  exec_summary: "Executive Summary",
  technical_approach: "Technical Approach",
  team: "Team",
  pricing: "Pricing",
};

export function isDraftSection(value: string): value is DraftSection {
  return DRAFT_SECTIONS.includes(value as DraftSection);
}

export const SECTION_MARKER_PREFIX = "===DW_SECTION:";
export const SECTION_MARKER_SUFFIX = "===";
export const DRAFT_END_MARKER = "===DW_END===";

export function sectionStartMarker(section: DraftSection) {
  return `${SECTION_MARKER_PREFIX}${section}${SECTION_MARKER_SUFFIX}`;
}

function formatLibraryBlock(items: LibraryItem[], type: LibraryItem["type"]) {
  const filtered = items.filter((item) => item.type === type);
  if (filtered.length === 0) {
    return "(none provided — do not invent specific client names, people, or certifications)";
  }

  return filtered
    .map((item) => `### ${item.title}\n${item.content}`)
    .join("\n\n");
}

export function buildDraftingSystemPrompt(agencyName: string) {
  return `You write proposal sections for ${agencyName}, an Indian IT services agency responding to private-sector RFPs (not GeM/government tenders).

Rules:
- Ground every claim in the provided RFP extraction and Content Library. Prefer real case studies, named people, certifications, and the company profile.
- If library content is missing for a topic, write carefully without inventing fake clients, people, metrics, or certs. Use honest placeholders like "[Add case study]" sparingly.
- Tone: confident, specific, professional B2B services — not generic AI filler.
- Output ONLY the four sections using the exact markers below. No preamble or closing commentary.

Required format:
${sectionStartMarker("exec_summary")}
<markdown prose for Executive Summary>
${sectionStartMarker("technical_approach")}
<markdown prose for Technical Approach>
${sectionStartMarker("team")}
<markdown prose for Team>
${sectionStartMarker("pricing")}
<markdown for a Pricing Table shell — include a markdown table of line items/roles with blank or TBD amounts the agency can fill>
${DRAFT_END_MARKER}`;
}

export function buildDraftingUserPrompt(input: {
  agencyName: string;
  rfp: Rfp;
  libraryItems: LibraryItem[];
}) {
  const { agencyName, rfp, libraryItems } = input;
  const deadline = rfp.extractedDeadline
    ? rfp.extractedDeadline.toISOString().slice(0, 10)
    : "Not specified";

  return `Draft a proposal pack for this RFP.

Agency: ${agencyName}
RFP title: ${rfp.title}

## Extracted requirements
### Scope
${scopeToEditableText(rfp.extractedScope) || "(empty)"}

### Deadline
${deadline}

### Eligibility criteria
${listToEditableText(rfp.extractedEligibility) || "(none)"}

### Evaluation criteria
${listToEditableText(rfp.extractedEvaluationCriteria) || "(none)"}

## Content library
### Company profile
${formatLibraryBlock(libraryItems, "company_profile")}

### Case studies
${formatLibraryBlock(libraryItems, "case_study")}

### Team bios
${formatLibraryBlock(libraryItems, "team_bio")}

### Certifications
${formatLibraryBlock(libraryItems, "certification")}

Write all four sections now, using the required markers.`;
}
