import type { LibraryItemType } from "@/lib/generated/prisma";

/**
 * Starting structures for library items. They contain no facts: every
 * company-specific detail is a [[placeholder]] for the user to replace, and
 * placeholders are highlighted in drafts if any are left in.
 */
export const libraryTemplates: Record<LibraryItemType, { title: string; content: string }> = {
  company_profile: {
    title: "Company profile",
    content: `[[Company legal name]] is a [[size, e.g. 25-person]] [[what you do, e.g. managed IT provider / engineering consultancy / facilities contractor]] based in [[city, region]], founded in [[year]].

We serve [[types of clients, e.g. local government, schools, mid-sized manufacturers]] across [[area served]].

Core services:
- [[Service 1]]
- [[Service 2]]
- [[Service 3]]

What sets us apart: [[one or two specific, provable differences, e.g. response times, accreditations, local team]].

Registrations and identifiers: [[company number / UEI / VAT number, as relevant]].`,
  },
  case_study: {
    title: "[[Client name]]: [[project name]]",
    content: `Client: [[client name and type, e.g. City of …, 300-staff manufacturer]]
Dates: [[start month and year]] to [[end month and year, or "ongoing"]]
Contract value: [[value, or leave out if confidential]]

Challenge: [[what the client needed and why]]

What we did: [[scope, team size, approach, systems or methods used]]

Results:
- [[measurable result, e.g. reduced response time from X to Y]]
- [[measurable result]]

Reference: [[name, title, email, phone, if the client agreed to be a reference]]`,
  },
  team_bio: {
    title: "[[Full name]], [[role]]",
    content: `[[Full name]] is our [[role]], with [[number]] years of experience in [[field]].

Qualifications: [[degrees, certifications, licences, memberships]]

Relevant experience:
- [[project or client]]: [[what they did and the outcome]]
- [[project or client]]: [[what they did and the outcome]]

Role on bids: [[e.g. project manager, lead engineer, account manager]]`,
  },
  certification: {
    title: "[[Certification, insurance or registration name]]",
    content: `Name: [[e.g. ISO 9001:2015, Cyber Essentials Plus, general liability insurance]]
Issued by: [[certifying body or insurer]]
Number: [[certificate or policy number]]
Valid until: [[expiry date]]
Scope or cover: [[what it covers, e.g. scope statement or cover limit per occurrence]]`,
  },
  saved_answer: {
    title: "[[Question this answers, e.g. How do you protect customer data?]]",
    content: `[[Your approved answer. Lead with a direct answer, then give the specifics: policies, tools, frequencies, responsible roles and any certification that backs it up.]]`,
  },
};
