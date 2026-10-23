import type { LibraryItemType } from "@/lib/generated/prisma";

/**
 * Starting structures for library items. They contain no facts: every
 * company-specific detail is a [[placeholder]] for the user to replace, and
 * placeholders left in are highlighted in drafts. General templates suit any
 * field; the optional starter sets add structures common in one segment.
 */

export type LibraryTemplate = {
  id: string;
  type: LibraryItemType;
  name: string;
  /** Optional starter set it belongs to; general templates have none. */
  segment?: "it-services" | "consultancies" | "service-contractors";
  title: string;
  content: string;
};

export const TEMPLATE_SEGMENTS = {
  "it-services": "IT services",
  consultancies: "Engineering and professional consultancies",
  "service-contractors": "Facilities and service contractors",
} as const;

export const libraryTemplates: LibraryTemplate[] = [
  {
    id: "company-overview",
    type: "company_profile",
    name: "Company overview",
    title: "Company profile",
    content: `[[Company legal name]] is a [[size, e.g. 25-person]] [[what you do]] based in [[city, region]], founded in [[year]].

We serve [[types of clients]] across [[area served]].

Core services:
- [[Service]]
- [[Service]]
- [[Service]]

What sets us apart: [[one or two specific, provable differences, e.g. response times, accreditations, local team]].

Registrations and identifiers: [[company number, UEI, VAT number, as relevant]].`,
  },
  {
    id: "case-study",
    type: "case_study",
    name: "Past performance / case study",
    title: "[[Client name]]: [[project name]]",
    content: `Client: [[client name and type]]
Dates: [[start month and year]] to [[end month and year, or "ongoing"]]
Contract value: [[value, or leave out if confidential]]

Challenge: [[what the client needed and why]]

What we did: [[scope, team size, approach, systems or methods used]]

Results:
- [[measurable result]]
- [[measurable result]]

Reference: [[name, title, email, phone, if the client agreed to be a reference]]`,
  },
  {
    id: "staff-resume",
    type: "team_bio",
    name: "Staff résumé summary",
    title: "[[Full name]], [[role]]",
    content: `[[Full name]] is our [[role]], with [[number]] years of experience in [[field]].

Qualifications: [[degrees, certifications, licences, memberships]]

Relevant experience:
- [[project or client]]: [[what they did and the outcome]]
- [[project or client]]: [[what they did and the outcome]]

Role on bids: [[e.g. project manager, lead engineer, account manager]]
Availability: [[e.g. full time from contract start]]`,
  },
  {
    id: "staffing-plan",
    type: "saved_answer",
    name: "Staffing and team structure",
    title: "How we staff and manage a contract",
    content: `Team structure: [[roles and how many of each]]

Key personnel: [[named lead roles and who fills them]]

Backup and continuity: [[how you cover absence, leave and turnover]]

Subcontractors: [[who, for what, or "none"]]`,
  },
  {
    id: "methodology",
    type: "saved_answer",
    name: "Methodology / approach",
    title: "Our approach to delivering [[type of work]]",
    content: `1. [[Phase name]]: [[what happens, who is involved, what is delivered]]
2. [[Phase name]]: [[what happens, who is involved, what is delivered]]
3. [[Phase name]]: [[what happens, who is involved, what is delivered]]

How we keep the client informed: [[meetings, reports and their frequency]]
How we manage risk and change: [[process]]`,
  },
  {
    id: "quality-safety",
    type: "saved_answer",
    name: "Quality and safety practices",
    title: "Quality and safety",
    content: `Quality management: [[system or standard you follow, how work is checked, who signs off]]

Health and safety: [[policy, training, incident reporting, responsible person]]

Records: [[what you document and how long you keep it]]`,
  },
  {
    id: "references",
    type: "saved_answer",
    name: "References",
    title: "Client references",
    content: `1. [[Client]]: [[contact name, title, email, phone]]. Work: [[scope and dates]]
2. [[Client]]: [[contact name, title, email, phone]]. Work: [[scope and dates]]
3. [[Client]]: [[contact name, title, email, phone]]. Work: [[scope and dates]]

All references have agreed to be contacted: [[confirm]]`,
  },
  {
    id: "certification",
    type: "certification",
    name: "Certification, insurance or registration",
    title: "[[Certification, insurance or registration name]]",
    content: `Name: [[e.g. a quality standard, an insurance policy, a trade registration]]
Issued by: [[certifying body or insurer]]
Number: [[certificate or policy number]]
Valid until: [[expiry date]]
Scope or cover: [[what it covers, e.g. scope statement or cover limit per occurrence]]`,
  },
  {
    id: "saved-answer",
    type: "saved_answer",
    name: "Blank saved answer",
    title: "[[Question this answers]]",
    content: `[[Your approved answer. Lead with a direct answer, then the specifics: policies, tools, frequencies, responsible roles and any certification that backs it up.]]`,
  },
  // Starter sets: optional, offered by field.
  {
    id: "it-service-desk",
    type: "saved_answer",
    segment: "it-services",
    name: "Service desk and response times",
    title: "Service desk, hours and response times",
    content: `Hours of support: [[hours and time zone; out-of-hours arrangements]]
How users contact us: [[phone, email, portal]]

Priority | Response time | Resolution target
[[P1 definition]] | [[time]] | [[time]]
[[P2 definition]] | [[time]] | [[time]]

How we report performance: [[reports and frequency]]`,
  },
  {
    id: "it-security",
    type: "saved_answer",
    segment: "it-services",
    name: "Security practices",
    title: "How we protect client systems and data",
    content: `Access control: [[e.g. MFA, least privilege, reviews]]
Patching and monitoring: [[tools and frequency]]
Backups: [[frequency, retention, restore testing]]
Incident response: [[process and notification times]]
Certifications held: [[only those you actually hold]]`,
  },
  {
    id: "consultancy-qa",
    type: "saved_answer",
    segment: "consultancies",
    name: "QA/QC and design review",
    title: "Quality assurance and review process",
    content: `Review stages: [[e.g. internal check, senior review, independent check]]
Who signs off: [[role and professional registration]]
Standards and codes followed: [[as relevant to your work]]`,
  },
  {
    id: "consultancy-registrations",
    type: "certification",
    segment: "consultancies",
    name: "Professional registration",
    title: "[[Professional registration or licence]]",
    content: `Holder: [[person or firm]]
Body: [[registering body]]
Number: [[registration number]]
Valid until: [[date]]`,
  },
  {
    id: "contractor-mobilisation",
    type: "saved_answer",
    segment: "service-contractors",
    name: "Mobilisation plan",
    title: "How we mobilise a new contract",
    content: `Week [[n]]: [[activity]]
Week [[n]]: [[activity]]
TUPE or staff transfer: [[approach, if relevant]]
Equipment and materials: [[how sourced and when ready]]`,
  },
  {
    id: "contractor-health-safety",
    type: "saved_answer",
    segment: "service-contractors",
    name: "Health and safety on site",
    title: "Health and safety on site",
    content: `Risk assessments and method statements: [[process]]
Training and competence: [[training given, cards or tickets held]]
Supervision: [[how sites are supervised]]
Incident record: [[figures you can evidence, or leave this line out]]`,
  },
];

export function templatesFor(type: LibraryItemType) {
  return libraryTemplates.filter((template) => template.type === type);
}
