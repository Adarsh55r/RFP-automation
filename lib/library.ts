import type { LibraryItemType } from "@/lib/generated/prisma";

export const libraryTypes: LibraryItemType[] = [
  "case_study",
  "team_bio",
  "certification",
  "company_profile",
];

export const libraryTypeLabel: Record<LibraryItemType, string> = {
  case_study: "Case studies",
  team_bio: "Team bios",
  certification: "Certifications",
  company_profile: "Company profile",
};

export const libraryTypeSingular: Record<LibraryItemType, string> = {
  case_study: "Case study",
  team_bio: "Team bio",
  certification: "Certification",
  company_profile: "Company profile",
};

export const libraryEmptyCopy: Record<
  LibraryItemType,
  { headline: string; description: string }
> = {
  case_study: {
    headline: "No case studies yet",
    description:
      "Add your first one so drafts can reference your real work — clients, outcomes, and proof that wins deals.",
  },
  team_bio: {
    headline: "No team bios yet",
    description:
      "Add key people so proposals can introduce the right experts instead of generic “our team” language.",
  },
  certification: {
    headline: "No certifications yet",
    description:
      "List ISO, SOC 2, partner badges, and domain certs so drafts can cite credentials buyers look for.",
  },
  company_profile: {
    headline: "No company profile yet",
    description:
      "Write one short blurb about your agency — who you serve and what you do best — so every draft sounds like you.",
  },
};

export const libraryTypeHint: Record<LibraryItemType, string> = {
  case_study:
    "Include the client (or industry), problem, what you delivered, and a measurable result.",
  team_bio:
    "Name, role, years of experience, and 2–3 strengths relevant to client work.",
  certification:
    "Certification name, issuer, and year if useful (e.g. ISO 27001, AWS Advanced Partner).",
  company_profile:
    "One clear paragraph: who you are, who you serve, and what makes your agency distinct.",
};

export function isLibraryItemType(value: string): value is LibraryItemType {
  return libraryTypes.includes(value as LibraryItemType);
}
