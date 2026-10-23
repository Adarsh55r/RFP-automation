/**
 * Segment landing pages (/for/[segment]): one template, driven by this
 * config, so adding or swapping a segment needs no code. The product is the
 * same for every segment; only the language changes. Copy is a first draft
 * for the founder to review (FOUNDER_TODO.md): factual, no outcome promises.
 */

export type Segment = {
  slug: string;
  /** Short name for links and the funnel report. */
  name: string;
  /** Who the page is for, in a few words. */
  audience: string;
  title: string;
  description: string;
  headline: string;
  subheadline: string;
  /** 3–5 RFP pains typical for this segment. */
  pains: { title: string; body: string }[];
  /** Requirement types the checklist picks out for them. */
  checklistCatches: string[];
  /** Library documents worth uploading first. */
  uploadFirst: string[];
  /** Optional template starter set (lib/library-templates.ts). */
  templateSet?: "it-services" | "consultancies" | "service-contractors";
  /** Link to a real sample output once supplied; hidden until then. */
  sampleOutput: { title: string; href: string; source: string } | null;
};

export const SEGMENTS: Segment[] = [
  {
    slug: "it-services",
    name: "IT services",
    audience: "IT services and managed-service providers",
    title: "RFP response software for IT services and MSPs",
    description:
      "Turn managed IT and IT services RFPs into a compliant first draft built from your own case studies, service levels and security answers.",
    headline: "Answer managed IT and IT services RFPs from the work you have already done.",
    subheadline:
      "DraftBid AI reads the RFP and its addenda, lists every requirement, SLA and security question, and drafts your response from your past proposals, case studies and saved answers, flagging anything it can't support.",
    pains: [
      {
        title: "Long security questionnaires attached to every bid",
        body: "Dozens of questions on access control, backups and incident response, often in a spreadsheet you have to answer row by row.",
      },
      {
        title: "Service levels buried in the scope",
        body: "Response and resolution times, hours of cover and reporting duties are spread across sections and attachments.",
      },
      {
        title: "The same answers, rewritten every time",
        body: "Your onboarding plan, help-desk process and tooling barely change between bids, but each RFP asks in different words.",
      },
      {
        title: "Certifications you must not overstate",
        body: "Buyers ask about specific security standards; a draft must claim only what you actually hold.",
      },
    ],
    checklistCatches: [
      "Service levels: response and resolution times, hours of cover",
      "Security and data-protection requirements",
      "Required certifications, insurance and registrations",
      "Transition and onboarding timelines",
      "Pricing format: per user, per device or fixed fee",
      "Page limits, submission portal and deadline with time zone",
    ],
    uploadFirst: [
      "Two or three past proposals for managed IT or IT services",
      "Case studies with client, scope, user or device counts and results",
      "Your standard security, backup and incident-response answers",
      "Résumés for your service-desk lead and technical lead",
      "Certificates and insurance documents you hold",
    ],
    templateSet: "it-services",
    sampleOutput: null,
  },
  {
    slug: "consultancies",
    name: "Consultancies",
    audience: "engineering and professional consultancies",
    title: "Proposal software for engineering and professional consultancies",
    description:
      "Turn RFPs and RFQs for engineering and professional services into a compliant first draft built from your past projects, staff résumés and methodology.",
    headline: "Respond to engineering and professional services RFPs from your own projects and people.",
    subheadline:
      "DraftBid AI reads the solicitation and addenda, lists the qualifications, key personnel and submission rules, and drafts your response from your past proposals, project sheets and résumés, flagging anything it can't support.",
    pains: [
      {
        title: "Key personnel and résumé requirements",
        body: "Named roles, minimum years of experience and licences, each with its own résumé format and page limit.",
      },
      {
        title: "Relevant project experience, every time",
        body: "Every bid asks for comparable past projects; finding and rewriting the right ones takes hours.",
      },
      {
        title: "Strict page limits and formats",
        body: "Qualifications-based selections often cap pages and prescribe sections, fonts and forms.",
      },
      {
        title: "Methodology written from scratch",
        body: "Your approach is consistent across projects, but each RFP frames the work differently.",
      },
    ],
    checklistCatches: [
      "Key personnel, required qualifications and résumé formats",
      "Number and type of project references",
      "Evaluation criteria and weights",
      "Professional registrations and licences required to bid",
      "Required forms and certifications",
      "Page limits, formatting rules and submission deadline",
    ],
    uploadFirst: [
      "Past proposals or statements of qualifications",
      "Project sheets for comparable projects",
      "Résumés for the people you usually propose",
      "Your quality-control and review process",
      "Professional registrations and insurance certificates",
    ],
    templateSet: "consultancies",
    sampleOutput: null,
  },
  {
    slug: "service-contractors",
    name: "Service contractors",
    audience: "facilities and other service contractors",
    title: "Bid writing software for facilities and service contractors",
    description:
      "Turn facilities, maintenance and service-contract tenders into a compliant first draft built from your own contracts, method statements and safety records.",
    headline: "Bid for facilities and service contracts from the contracts you already run.",
    subheadline:
      "DraftBid AI reads the tender and its addenda, lists the mandatory forms, insurance, staffing and service standards, and drafts your response from your past bids, method statements and contract records, flagging anything it can't support.",
    pains: [
      {
        title: "Mandatory forms and insurance thresholds",
        body: "Signed declarations, insurance minimums and bonds that disqualify a bid if one is missed.",
      },
      {
        title: "Staffing, mobilisation and supervision",
        body: "Buyers want to know who will turn up, from when, and how sites are supervised.",
      },
      {
        title: "Health and safety evidence",
        body: "Method statements, training and incident records, asked for in a different format each time.",
      },
      {
        title: "Pricing schedules with strict formats",
        body: "Rates, schedules of work and price forms that must be completed exactly as issued.",
      },
    ],
    checklistCatches: [
      "Mandatory forms, declarations and signed acknowledgements",
      "Insurance minimums, bonds and guarantees",
      "Staffing levels, mobilisation dates and supervision",
      "Health and safety requirements",
      "Service standards and performance measures",
      "Pricing schedule format and submission deadline",
    ],
    uploadFirst: [
      "Past bids for similar contracts",
      "Contract records with site, scope, value and duration",
      "Method statements and your health and safety policy",
      "Résumés or role profiles for supervisors and managers",
      "Insurance certificates, licences and accreditations",
    ],
    templateSet: "service-contractors",
    sampleOutput: null,
  },
  {
    slug: "consultants",
    name: "Proposal consultants",
    audience: "independent proposal consultants and bid writers",
    title: "AI first drafts for proposal consultants and bid writers",
    description:
      "Turn a client's RFP and their past material into a compliant first draft and a requirement checklist you can review and refine.",
    headline: "Start every client bid from a checklist and a first draft, not a blank page.",
    subheadline:
      "DraftBid AI reads the RFP and addenda, builds the compliance checklist, and drafts from the past proposals, case studies and résumés you load in, marking every claim with its source and flagging anything it can't support for you or your client to fill.",
    pains: [
      {
        title: "The first day of every bid is extraction",
        body: "Reading the whole RFP and addenda to build a compliance matrix before any writing starts.",
      },
      {
        title: "Clients send material in every format",
        body: "Old proposals, CVs, brochures and spreadsheets that need turning into usable content.",
      },
      {
        title: "Checking every claim",
        body: "You need to know where each statement in a draft came from before it goes to the client.",
      },
    ],
    checklistCatches: [
      "Mandatory requirements and pass/fail criteria",
      "Evaluation criteria and weights",
      "Required forms, attachments and references",
      "Page and word limits, formatting rules",
      "Deadlines, clarification dates and submission method",
    ],
    uploadFirst: [
      "The client's recent proposals",
      "Client case studies and project records",
      "Résumés for the client's proposed team",
      "The client's certifications and insurance",
    ],
    sampleOutput: null,
  },
];

export function getSegment(slug: string) {
  return SEGMENTS.find((segment) => segment.slug === slug) ?? null;
}

export const isSegmentSlug = (value: unknown): value is string =>
  typeof value === "string" && SEGMENTS.some((segment) => segment.slug === value);
