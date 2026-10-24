import { credentialsIn } from "@/lib/claim-checks";
import type { KeyDetail } from "@/lib/key-details";
import type { LibraryItemType } from "@/lib/generated/prisma";

/**
 * How ready the content library is: a setup checklist for new accounts, and
 * for one RFP a "draft strength" rating of how much real material the draft
 * will have to work with. Both are deterministic counts and checks; they
 * never call the AI and never judge quality they cannot measure.
 */

type LibraryStats = { type: LibraryItemType; title: string; content: string }[];

export type SetupStep = { id: string; label: string; hint: string; done: boolean; href: string };

export type LibraryCounts = Partial<Record<LibraryItemType, number>>;

export function setupSteps({ counts, profileLength, rfpCount }: { counts: LibraryCounts; profileLength: number; rfpCount: number }): SetupStep[] {
  const count = (type: LibraryItemType) => counts[type] ?? 0;
  return [
    {
      id: "profile",
      label: "Write your company profile",
      hint: "Who you are, what you do, where, for whom, and since when. 300+ characters.",
      done: profileLength >= 300,
      href: "/dashboard/library?type=company_profile",
    },
    {
      id: "case_studies",
      label: "Add three past proposals or case studies",
      hint: "Upload past proposals as PDF or Word, or write up projects with the client, scope, dates and results.",
      done: count("case_study") >= 3,
      href: "/dashboard/library?type=case_study",
    },
    {
      id: "team",
      label: "Add résumés for the people you would put on a bid",
      hint: "Upload résumés, or write role, experience, qualifications and relevant projects.",
      done: count("team_bio") >= 1,
      href: "/dashboard/library?type=team_bio",
    },
    {
      id: "certifications",
      label: "List your certifications, insurance and registrations",
      hint: "So drafts can claim exactly what you hold, and nothing you do not.",
      done: count("certification") >= 1,
      href: "/dashboard/library?type=certification",
    },
    {
      id: "saved_answers",
      label: "Save three answers you give often",
      hint: "Security, quality, onboarding or support answers you reuse across bids.",
      done: count("saved_answer") >= 3,
      href: "/dashboard/library?type=saved_answer",
    },
    {
      id: "first_rfp",
      label: "Upload your first RFP",
      hint: "PDF, Word, Excel, CSV or a scanned image. Requirements are pulled out for you to check.",
      done: rfpCount > 0,
      href: "/dashboard/rfps/new",
    },
  ];
}

export type DraftStrength = {
  level: "weak" | "fair" | "strong";
  /** 0–100, from the checks below. */
  score: number;
  checks: { label: string; ok: boolean; fix: string }[];
};

/** How much supporting material the library has for this particular RFP. */
export function draftStrength(
  items: LibraryStats,
  rfp: { requirementsText: string; keyDetails: KeyDetail[]; questionCount: number },
): DraftStrength {
  const count = (type: LibraryItemType) => items.filter((item) => item.type === type).length;
  const libraryText = items.map((item) => `${item.title}\n${item.content}`).join("\n");
  const required = credentialsIn(rfp.requirementsText);
  const held = new Set(credentialsIn(libraryText));
  const missing = required.filter((name) => !held.has(name));
  const needsPeople = rfp.keyDetails.some((detail) => detail.category === "key_personnel");

  const checks = [
    {
      label: "Company profile",
      ok: count("company_profile") > 0,
      fix: "Add a company profile so the draft can introduce you accurately.",
    },
    {
      label: count("case_study") >= 2 ? `${count("case_study")} case studies` : "Case studies",
      ok: count("case_study") >= 2,
      fix:
        count("case_study") === 0
          ? "Add case studies; without them the draft cannot show past performance."
          : "Add another case study so the draft has more than one example.",
    },
    {
      label: needsPeople ? "Bios for named roles" : "Team bios",
      ok: count("team_bio") >= (needsPeople ? 2 : 1),
      fix: needsPeople
        ? "This RFP asks for key personnel. Add bios for the people you would propose."
        : "Add a team bio so the draft can describe who will do the work.",
    },
    {
      label: required.length > 0 ? `Credentials the RFP mentions (${required.join(", ")})` : "Credentials",
      ok: missing.length === 0,
      fix: `The RFP mentions ${missing.join(", ")}, which your library does not. Add proof if you hold ${missing.length === 1 ? "it" : "them"}; otherwise the draft will leave a gap.`,
    },
    {
      label: rfp.questionCount > 0 ? `Saved answers for ${rfp.questionCount} questions` : "Saved answers",
      ok: rfp.questionCount === 0 ? count("saved_answer") >= 1 : count("saved_answer") >= Math.min(5, Math.ceil(rfp.questionCount / 10)),
      fix:
        rfp.questionCount > 0
          ? "Save answers you have given before; questionnaires are answered much better from them."
          : "Save a few answers you reuse often.",
    },
  ];
  const weights = [15, 30, 20, 20, 15];
  const score = checks.reduce((sum, check, index) => sum + (check.ok ? weights[index] : 0), 0);
  return { level: score >= 80 ? "strong" : score >= 50 ? "fair" : "weak", score, checks };
}
