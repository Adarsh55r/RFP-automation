/**
 * SEO page templates. The structure and headings are set; the body text is
 * the founder's to write ({{…}} placeholders, see FOUNDER_TODO.md). A guide
 * with `published: false` is not in the sitemap and returns 404 in
 * production; preview and development show it with a draft banner.
 */
export type Guide = {
  slug: string;
  title: string;
  description: string;
  published: boolean;
  /** Segment this checklist page is for, if any (links to /for/<segment>). */
  segment?: string;
  sections: { heading: string; body: string }[];
};

const placeholder = (what: string) => `{{GUIDE_COPY: ${what}}}`;

export const GUIDES: Guide[] = [
  {
    slug: "rfp-compliance-checklist",
    title: "RFP compliance checklist",
    description: "What to check in any RFP before you write a word: mandatory requirements, forms, page limits, deadlines and scoring.",
    published: false,
    sections: [
      { heading: "Why a compliance checklist comes first", body: placeholder("why missed requirements disqualify bids") },
      { heading: "Mandatory and pass/fail requirements", body: placeholder("how to find them") },
      { heading: "Forms, attachments and certificates", body: placeholder("common required documents") },
      { heading: "Page limits, formatting and submission method", body: placeholder("rules to check") },
      { heading: "Deadlines and addenda", body: placeholder("submission and clarification dates; tracking addenda") },
      { heading: "Evaluation criteria and weights", body: placeholder("using scoring to plan the response") },
    ],
  },
  {
    slug: "how-to-respond-to-an-rfp-small-business",
    title: "How to respond to an RFP as a small business",
    description: "A practical process for small teams answering RFPs: deciding to bid, building the checklist, drafting from past work and reviewing.",
    published: false,
    sections: [
      { heading: "Decide whether to bid", body: placeholder("bid / no-bid questions") },
      { heading: "Build the requirement checklist", body: placeholder("process") },
      { heading: "Draft from what you have already done", body: placeholder("reusing past proposals and case studies") },
      { heading: "Review, fill gaps and submit", body: placeholder("final checks") },
    ],
  },
  {
    slug: "proposal-template-from-your-portfolio",
    title: "A proposal template built from your company portfolio",
    description: "How to turn your past proposals, case studies and résumés into a reusable proposal structure.",
    published: false,
    sections: [
      { heading: "What belongs in a proposal library", body: placeholder("documents to collect") },
      { heading: "A section-by-section structure", body: placeholder("cover letter to pricing") },
      { heading: "Keeping it current", body: placeholder("maintenance habits") },
    ],
  },
  {
    slug: "draftbid-ai-vs-chatgpt-for-rfps",
    title: "DraftBid AI vs ChatGPT for RFPs",
    description: "Where a general AI assistant helps with RFPs, where a dedicated RFP tool differs, and how to compare them on your own RFP.",
    published: false,
    sections: [
      { heading: "What a general assistant does well", body: placeholder("fair description") },
      { heading: "What changes for a full RFP response", body: placeholder("checklist, sources, gaps, export") },
      { heading: "Compare them on the same RFP", body: placeholder("method, linking the real comparison once produced") },
    ],
  },
  {
    slug: "rfp-checklist-it-services",
    title: "RFP checklist for IT services and MSPs",
    description: "Requirements to check in managed IT and IT services RFPs: SLAs, security questionnaires, certifications, transition plans and pricing.",
    published: false,
    segment: "it-services",
    sections: [
      { heading: "Service levels", body: placeholder("what to look for") },
      { heading: "Security and data protection", body: placeholder("common questions") },
      { heading: "Transition and onboarding", body: placeholder("what buyers ask") },
      { heading: "Pricing format", body: placeholder("per user, per device, fixed fee") },
    ],
  },
  {
    slug: "rfp-checklist-consultancies",
    title: "RFP checklist for engineering and professional consultancies",
    description: "Requirements to check in RFPs and RFQs for professional services: key personnel, résumés, project references and page limits.",
    published: false,
    segment: "consultancies",
    sections: [
      { heading: "Key personnel and résumés", body: placeholder("what to look for") },
      { heading: "Project references", body: placeholder("number, type, recency") },
      { heading: "Registrations and licences", body: placeholder("what may be required") },
      { heading: "Page limits and formats", body: placeholder("statement of qualifications rules") },
    ],
  },
  {
    slug: "rfp-checklist-service-contractors",
    title: "Tender checklist for facilities and service contractors",
    description: "Requirements to check in service-contract tenders: mandatory forms, insurance, bonds, staffing, health and safety and pricing schedules.",
    published: false,
    segment: "service-contractors",
    sections: [
      { heading: "Mandatory forms and declarations", body: placeholder("common forms") },
      { heading: "Insurance, bonds and guarantees", body: placeholder("thresholds to check") },
      { heading: "Staffing and mobilisation", body: placeholder("what buyers ask") },
      { heading: "Health and safety", body: placeholder("evidence requested") },
      { heading: "Pricing schedules", body: placeholder("format rules") },
    ],
  },
];

export const getGuide = (slug: string) => GUIDES.find((guide) => guide.slug === slug) ?? null;

/** Production builds hide unpublished guides; previews and development show them. */
export function guideVisible(guide: Guide) {
  return guide.published || process.env.VERCEL_ENV !== "production";
}
