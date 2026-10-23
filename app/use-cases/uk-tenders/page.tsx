import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { UseCasePage, type UseCase } from "@/components/marketing/use-case-page";

const useCase: UseCase = {
  eyebrow: "Use case · UK public-sector tenders",
  title: "Draft UK tender responses from your own past bids.",
  intro:
    "For invitations to tender and selection questionnaires from councils, NHS trusts, universities and other public bodies, including notices from Find a Tender and Contracts Finder.",
  does: [
    "Reads the ITT, specification and any clarifications or addenda you add, and lists award questions, word limits, weightings, mandatory forms and the submission deadline for you to confirm.",
    "Drafts each award question from your library in UK English and pounds sterling, aiming at the question's stated word limit and giving evidence for each scoring point. Check the word count before you submit.",
    "Covers Social Value questions with commitments taken from your library, and leaves a highlighted gap where you need to add a measurable commitment.",
    "Marks every statement about your company with the document it came from, and flags certifications such as Cyber Essentials or ISO standards that your library does not show.",
    "Exports a formatted Word or PDF response, or fills the answers into the buyer's own Excel response template.",
  ],
  doesNot: [
    "Log in to procurement portals or submit for you.",
    "Find or alert you to new tenders.",
    "Decide your pricing or complete financial standing checks.",
    "Guarantee a score or an award.",
  ],
};

export const metadata: Metadata = {
  title: "UK tender responses from your own past bids",
  description:
    "Draft responses to UK public-sector tenders and selection questionnaires from your own documents, with word limits, Social Value and mandatory forms tracked.",
  alternates: { canonical: "/use-cases/uk-tenders" },
};

export default function UkTendersPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <UseCasePage useCase={useCase} />
      </main>
      <SiteFooter />
    </>
  );
}
