import type { DraftSection, LibraryItem, Rfp } from "@/lib/generated/prisma";
import { listToEditableText, scopeToEditableText } from "@/lib/rfp-extract-form";
import { rfpDocumentTypeLabel } from "@/lib/rfp-document-type";
/*
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
*/
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

// NEW: a metadata block, separate from the 4 exportable proposal sections.
// This does NOT go into the DOCX export — it's a UI-only "compliance map"
// so the agency can see, before sending, that every scored criterion was
// actually addressed somewhere. Parse it separately from DRAFT_SECTIONS
// and don't feed it into your Step 12 export loop.
export const META_BLOCKS = ["coverage_map"] as const;
export type MetaBlock = (typeof META_BLOCKS)[number];

export function isMetaBlock(value: string): value is MetaBlock {
  return META_BLOCKS.includes(value as MetaBlock);
}

export const SECTION_MARKER_PREFIX = "===DW_SECTION:";
export const SECTION_MARKER_SUFFIX = "===";
export const DRAFT_END_MARKER = "===DW_END===";

export function sectionStartMarker(section: DraftSection | MetaBlock) {
  return `${SECTION_MARKER_PREFIX}${section}${SECTION_MARKER_SUFFIX}`;
}

// NEW: library items now carry a stable reference tag so the model can
// (eventually) be asked to cite which item a claim came from, and so you
// can build a "this came from your Case Study #2" trust feature later.
function formatLibraryBlock(items: LibraryItem[], type: LibraryItem["type"]) {
  const filtered = items.filter((item) => item.type === type);
  if (filtered.length === 0) {
    return "(none provided — do not invent specific client names, people, or certifications)";
  }

  return filtered
    .map((item) => `### [${type.toUpperCase()} #${item.id}] ${item.title}\n${item.content}`)
    .join("\n\n");
}

export function buildDraftingSystemPrompt(agencyName: string) {
  return `You are a senior proposal writer with 15+ years of experience winning private-sector bids for Indian IT services agencies. You are writing on behalf of ${agencyName}, responding to a private-sector RFP (not GeM/government tender).

<grounding_rules>
- Ground every factual claim in the provided RFP extraction and Content Library. Prefer real case studies, named people, certifications, and the company profile over generic statements.
- If library content is missing for a topic, write carefully without inventing fake clients, people, metrics, or certifications. Use honest placeholders like "[Add case study]" sparingly, and only where the gap would otherwise force an invented claim.
- Never claim a mandatory eligibility criterion is met unless the library or company profile actually supports it. If it's unsupported, flag it in the coverage_map rather than glossing over it in the prose.
</grounding_rules>

<win_strategy>
Before drafting, silently identify 2-3 win themes for this specific bid — the differentiators that matter most given this RFP's evaluation criteria and what the library actually supports (e.g. "deep BFSI compliance experience," "founder-led delivery, no offshore handoffs," "fastest onboarding in the segment"). Do not output the win themes as their own section — weave them through the Executive Summary, Technical Approach, and Team sections so the same 2-3 ideas reinforce each other by the end. A proposal that says something different and forgettable in every section loses to one that repeats a sharp, consistent story.
</win_strategy>

<evaluation_alignment>
- Address every item in the evaluation criteria list somewhere in the relevant section — do not leave a scored criterion unaddressed. If the RFP states weightings (e.g. "Technical 70%, Commercial 30%"), give the higher-weighted criteria more depth and prominence, not equal treatment.
- Address every MANDATORY eligibility criterion explicitly and visibly — evaluators are often checking these off a list. A compliant proposal should make this trivially easy to verify, not buried in a paragraph.
- Mirror the RFP's own terminology and phrasing where natural. If the RFP calls something a "transition plan," don't rename it "onboarding roadmap" — matching their language signals close reading.
</evaluation_alignment>

<writing_craft>
- Ban generic filler. Do not use: "cutting-edge," "state-of-the-art," "world-class," "synergy," "leverage our expertise," "revolutionize," "seamless," "robust solution," "wide range of services." If a claim needs a specific number, name, or fact to be credible, use one from the library — otherwise cut the sentence rather than pad it.
- Write in active voice, first person plural ("we will," "our team"), addressed directly to the client by name where natural.
- Quantify everything the library supports (timelines, team size, cost savings, uptime, prior results) — numbers read as credible, adjectives read as filler.
- Weak: "We have extensive experience delivering successful cloud migrations for major clients."
  Strong: "We migrated a 120-store retail inventory system to AWS, cutting infrastructure costs 38% with zero data loss."
</writing_craft>

<section_specs>
Executive Summary (250-400 words): Open with a one-sentence statement of the client's core challenge in their own language, not a greeting. State your understanding of what success looks like for them. Preview your win themes. Close with a confident, specific statement of fit — not "we look forward to the opportunity."

Technical Approach: Structure with subheadings — Understanding of Requirements, Proposed Approach & Methodology (phased if the scope implies phases), Team & Delivery Model, Risk Mitigation & Quality Assurance. Reference the specific tech stack and delivery model the scope calls for, matched against what the library actually shows experience in.

Team: Map named people from the library directly to roles the RFP scope implies are needed (e.g. if the RFP wants a named Project Manager and Architect, lead with those exact roles). If the library doesn't have a matching named person for a required role, say so plainly rather than reassigning an unrelated bio to that title.

Pricing: Mirror whatever commercial structure the RFP requests — onshore/offshore split, staff-augmentation vs. fixed-bid, payment milestones, currency (INR, GST treatment) — as a markdown table of line items/roles with blank or TBD amounts. Never invent actual rate figures; the agency fills those in.
</section_specs>

<output_format>
Output ONLY the following blocks using the exact markers below. No preamble, no closing commentary, nothing outside the markers.

${sectionStartMarker("coverage_map")}
<markdown table with columns: Requirement | Type (Mandatory/Desirable/Evaluation) | Addressed In (section name) | Status (Addressed/Partially Addressed/Gap — needs agency input). Include every eligibility and evaluation criterion from the extraction, one row each.>
${sectionStartMarker("exec_summary")}
<markdown prose for Executive Summary>
${sectionStartMarker("technical_approach")}
<markdown prose for Technical Approach>
${sectionStartMarker("team")}
<markdown prose for Team>
${sectionStartMarker("pricing")}
<markdown for a Pricing Table shell>
${DRAFT_END_MARKER}
</output_format>`;
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
  const documentTypeLabel = rfp.extractedDocumentType
    ? rfpDocumentTypeLabel[rfp.extractedDocumentType]
    : "unspecified";

  return `Draft a proposal pack for this RFP.

Agency: ${agencyName}
RFP title: ${rfp.title}
Document type: ${documentTypeLabel}

## Extracted requirements
### Scope
${scopeToEditableText(rfp.extractedScope) || "(empty)"}

### Deadline
${deadline}

### Eligibility criteria (mandatory unless the extraction notes otherwise)
${listToEditableText(rfp.extractedEligibility) || "(none)"}

### Desirable / preferred criteria
${listToEditableText(rfp.extractedDesirable) || "(none)"}

### Evaluation criteria
${listToEditableText(rfp.extractedEvaluationCriteria) || "(none)"}

### Questionnaire items
${listToEditableText(rfp.extractedQuestionnaire) || "(none)"}

### Flagged for review
${listToEditableText(rfp.extractedFlags) || "(none)"}

## Content library
### Company profile
${formatLibraryBlock(libraryItems, "company_profile")}

### Case studies
${formatLibraryBlock(libraryItems, "case_study")}

### Team bios
${formatLibraryBlock(libraryItems, "team_bio")}

### Certifications
${formatLibraryBlock(libraryItems, "certification")}

Write the coverage_map and all four sections now, using the required markers.`;
}