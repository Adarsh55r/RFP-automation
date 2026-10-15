import type { LibraryItemType } from "@/lib/generated/prisma";

export const libraryTypes: LibraryItemType[] = [
  "case_study",
  "team_bio",
  "certification",
  "company_profile",
  "saved_answer",
];

export const libraryTypeLabel: Record<LibraryItemType, string> = {
  case_study: "Case studies",
  team_bio: "Team bios",
  certification: "Certifications",
  company_profile: "Company profile",
  saved_answer: "Saved answers",
};

export const libraryTypeSingular: Record<LibraryItemType, string> = {
  case_study: "Case study",
  team_bio: "Team bio",
  certification: "Certification",
  company_profile: "Company profile",
  saved_answer: "Saved answer",
};

export const libraryEmptyCopy: Record<
  LibraryItemType,
  { headline: string; description: string }
> = {
  case_study: {
    headline: "No case studies yet",
    description:
      "Add your first one so drafts can reference your real work — clients, outcomes, and past performance that evaluators score.",
  },
  team_bio: {
    headline: "No team bios yet",
    description:
      "Add key people so proposals can introduce the right experts instead of generic “our team” language.",
  },
  certification: {
    headline: "No certifications yet",
    description:
      "List SOC 2, ISO 27001, Cyber Essentials, insurance cover, small-business status, and partner badges so drafts can cite what buyers check for.",
  },
  company_profile: {
    headline: "No company profile yet",
    description:
      "Write one short blurb about your company — who you serve and what you do best — so every draft sounds like you.",
  },
  saved_answer: {
    headline: "No saved answers yet",
    description:
      "Save approved answers to questions you see again and again — data security, accessibility, insurance, GDPR, references — and drafts will reuse them word for word.",
  },
};

export const libraryTypeHint: Record<LibraryItemType, string> = {
  case_study:
    "Include the client (or industry), problem, what you delivered, and a measurable result.",
  team_bio:
    "Name, role, years of experience, and 2–3 strengths relevant to client work.",
  certification:
    "Certification name, issuer, and year if useful (e.g. SOC 2 Type II, ISO 27001, Cyber Essentials Plus, WOSB / SBA 8(a), AWS Partner).",
  company_profile:
    "One clear paragraph: who you are, who you serve, and what makes your company distinct.",
  saved_answer:
    "Title it with the question (e.g. “Describe your incident response process”), then paste the approved answer.",
};

export function isLibraryItemType(value: string): value is LibraryItemType {
  return libraryTypes.includes(value as LibraryItemType);
}
