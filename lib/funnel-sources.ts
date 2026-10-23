import { SEGMENTS } from "@/lib/segments";

/** Segments we attribute sign-ups to: the landing pages plus the free checklist tool. Safe for the browser. */
export const ATTRIBUTION_SOURCES = [...SEGMENTS.map((segment) => segment.slug), "checklist-tool"];

export function isAttributionSource(value: unknown): value is string {
  return typeof value === "string" && ATTRIBUTION_SOURCES.includes(value);
}

/** Answers to the optional "What industry are you in?" onboarding question. */
export const INDUSTRIES = [
  "IT services or managed services",
  "Engineering or professional consultancy",
  "Facilities or service contracting",
  "Proposal or bid consulting",
  "Other",
] as const;

export const isIndustry = (value: unknown): value is (typeof INDUSTRIES)[number] =>
  typeof value === "string" && (INDUSTRIES as readonly string[]).includes(value);
