import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY, isPlaceholder } from "@/lib/company";

export const metadata: Metadata = {
  title: "About",
  description: "Who builds DraftBid AI, the company behind it, and how to reach us.",
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
    body: [`${COMPANY.founderName}. ${COMPANY.founderBio}`],
  },
  {
    title: "The company",
    body: [
      [
        `Legal name: ${COMPANY.legalName}`,
        `Company number: ${COMPANY.companyNumber}`,
        `Registered address: ${COMPANY.registeredAddress}`,
      ],
    ],
  },
  {
    title: "Contact",
    body: [
      [
        `General and sales: ${COMPANY.contactEmail}`,
        `Privacy requests: ${COMPANY.privacyEmail}`,
        `Security reports: ${COMPANY.securityEmail}`,
      ],
    ],
  },
];

export default function AboutPage() {
  return (
    <LegalPage eyebrow="Company" title="About DraftBid AI" sections={sections}>
      {isPlaceholder(COMPANY.founderPhotoUrl) ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={COMPANY.founderPhotoUrl}
          alt={COMPANY.founderName}
          className="mt-12 size-32 rounded-full object-cover"
        />
      )}
    </LegalPage>
  );
}
