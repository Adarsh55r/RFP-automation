import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "About",
  description: "Why DraftBid AI exists, who builds it, and how to reach us.",
  alternates: { canonical: "/about" },
};

const sections: LegalSection[] = [
  {
    title: "Why DraftBid AI exists",
    body: [
      "Small businesses answer requests for proposals without a bid team. DraftBid AI reads the full RFP, builds a compliance checklist you confirm, and drafts a first response from your own case studies, team bios, certifications and past answers, highlighting anything it cannot support so you fill it in rather than guess.",
    ],
  },
  {
    title: "Who builds it",
    body: ["DraftBid AI is an independent product, built and run by its founder."],
  },
  {
    title: "Contact",
    body: [`Questions, sales, privacy requests and security reports: ${COMPANY.contactEmail}.`],
  },
];

export default function AboutPage() {
  return <LegalPage eyebrow="Company" title="About DraftBid AI" sections={sections} />;
}
