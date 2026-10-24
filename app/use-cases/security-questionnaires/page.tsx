import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { UseCasePage, type UseCase } from "@/components/marketing/use-case-page";
import { FunnelBeacon } from "@/components/marketing/funnel-beacon";

const useCase: UseCase = {
  eyebrow: "Use case · Security questionnaires",
  title: "Answer security questionnaires from your approved answers.",
  intro:
    "For vendor security and due-diligence questionnaires sent as Excel, CSV, Word or PDF, whether on their own or attached to an RFP.",
  does: [
    "Reads Excel and CSV questionnaires row by row, finds the question and answer columns for you to confirm, and writes each answer back into the buyer's own spreadsheet.",
    "Answers from your saved answers and policies first, and marks each answer with the library passage it came from.",
    "Leaves a highlighted gap where your library does not cover a control, rather than claiming you meet it.",
    "Flags any certification named in an answer that your library does not show, such as SOC 2 or ISO 27001.",
    "Lets you keep reusable answers in your library so the next questionnaire starts further along.",
  ],
  doesNot: [
    "Audit or certify your security, or replace a compliance tool.",
    "Connect to your systems to check controls.",
    "Claim a certification you have not added to your library.",
    "Submit answers to the buyer's portal for you.",
  ],
};

export const metadata: Metadata = {
  title: "Security questionnaire answers from your own policies",
  description:
    "Answer Excel, CSV, Word or PDF security questionnaires from your approved answers, with each answer sourced and written back into the buyer's spreadsheet.",
  alternates: { canonical: "/use-cases/security-questionnaires" },
};

export default function SecurityQuestionnairesPage() {
  return (
    <>
      <FunnelBeacon />
      <SiteHeader />
      <main id="main-content">
        <UseCasePage useCase={useCase} />
      </main>
      <SiteFooter />
    </>
  );
}
