import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { TERMS_UPDATED, TERMS_VERSION } from "@/lib/legal";

// DRAFT: must be reviewed by a lawyer in the company's jurisdiction before use. See docs/legal/README.md.

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when a business uses DraftBid AI.",
  alternates: { canonical: "/terms" },
};

const link = "font-semibold text-brand underline underline-offset-4";

const sections: LegalSection[] = [
  {
    title: "Who we are and who these terms are with",
    body: [
      `These Terms of Service ("Terms") are an agreement between ${COMPANY.legalName} (company number ${COMPANY.companyNumber}), registered at ${COMPANY.registeredAddress} ("we", "us"), and the business that creates a ${COMPANY.productName} account ("you").`,
      "You accept these Terms when you tick the acceptance box while creating or setting up your account, or when you accept an updated version we show you. If you accept on behalf of a company, you confirm you are authorised to bind it. DraftBid AI is for businesses only; it is not offered to consumers.",
    ],
  },
  {
    title: "The service",
    body: [
      "DraftBid AI is software that reads requests for proposals, tenders and questionnaires you upload, extracts their requirements into a checklist you can edit, and drafts proposal text from the documents you provide, which you can review, edit and export.",
      "DraftBid AI is a drafting tool. It does not submit bids, does not log into procurement portals, and is not a procurement, legal or compliance service. We may change, add or remove features over time; we will not remove a core feature you pay for during a paid period without notice.",
    ],
  },
  {
    title: "Your account",
    body: [
      "Give accurate account information and keep your sign-in details secure. You are responsible for everything done through your account. Tell us promptly if you think your account has been accessed without permission.",
    ],
  },
  {
    title: "You review, own and are responsible for what you submit",
    body: [
      "You decide what to submit to a buyer. Before you submit anything, you must review it and confirm that it is accurate and complete, including facts about your company, people, past work, certifications, insurance, pricing and legal commitments.",
      "You are solely responsible for every proposal, answer and document you submit, and for meeting the buyer's instructions, deadlines and rules.",
    ],
  },
  {
    title: "AI output",
    body: [
      "Requirement checklists and drafts are produced by AI models and may be incomplete, inaccurate or out of date, even when they cite your documents. The service flags gaps it detects, but it cannot detect every error.",
      "Nothing produced by the service is professional, legal, financial, tax or procurement advice. We do not promise that a draft is compliant with a particular RFP, or that you will win any bid; outcomes depend on factors we do not control, such as price, relationships and fit.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "You must not:",
      [
        "upload or create content that is unlawful, infringing, defamatory or harmful;",
        "upload personal data or confidential information unless you have a lawful basis and any permission you need to do so;",
        "use the service to misrepresent your qualifications, certifications or experience to a buyer;",
        "reverse engineer, decompile or try to extract the source code, models or prompts of the service, except where the law allows it;",
        "probe, scan or test the security of the service, or access other customers' data;",
        "get around usage limits, share accounts to avoid limits, or use automated means to overload the service;",
        "resell or provide the service to third parties except as your plan allows.",
      ],
    ],
  },
  {
    title: "Your data",
    body: [
      "You own the files, library content, drafts and other material you put into or create with the service (\"Customer Data\"). You give us a limited licence to host, copy, process and transmit Customer Data only to provide, secure and support the service for you, including sending it to the subprocessors listed on our subprocessors page.",
      <>
        We handle personal data as described in our <Link className={link} href="/privacy">Privacy Policy</Link> and, where you need one, our <Link className={link} href="/dpa">Data Processing Addendum</Link>. Our current subprocessors are listed on the <Link className={link} href="/subprocessors">subprocessors page</Link>.
      </>,
      "We do not use Customer Data to train AI models. We may use aggregated, non-identifying usage statistics (such as counts of proposals or features used) to run and improve the service; these never include the content of your documents.",
    ],
  },
  {
    title: "Confidentiality",
    body: [
      "Each party will keep the other's confidential information confidential, use it only for this agreement, and protect it with at least reasonable care. This does not apply to information that is public, already known to the recipient, independently developed, or that must be disclosed by law (with notice where allowed).",
    ],
  },
  {
    title: "Fees, billing and renewals",
    body: [
      <>
        Paid plans, one-time purchases and their limits are described on the <Link className={link} href="/pricing">pricing page</Link> at the time you buy. Subscriptions are billed in advance for each monthly or annual period and renew automatically until cancelled. Prices exclude taxes, which are added where required.
      </>,
      `Payments are processed by our payment provider; we do not store full card numbers. We may change prices for future periods with at least ${"{{PRICE_CHANGE_NOTICE_DAYS}}"} days' notice; the change applies from your next renewal.`,
    ],
  },
  {
    title: "Cancellation, refunds and plan changes",
    body: [
      "You can cancel a subscription at any time from your account or by emailing us. Cancellation takes effect at the end of the current paid period, and you keep access until then.",
      `${"{{REFUND_POLICY}}"} Nothing in these Terms limits any refund right you have by law.`,
      "If you upgrade, the new limits apply straight away and any price difference is charged as shown at checkout. If you downgrade, the change applies from the next renewal.",
    ],
  },
  {
    title: "Usage limits and overages",
    body: [
      "Each plan includes the limits shown on the pricing page, such as the number of proposals. Before you start work that goes beyond your plan's limit, the service tells you the extra cost and asks you to confirm; nothing extra is charged without that confirmation.",
      "To keep the service reliable and costs fair, we apply rate limits and AI usage ceilings, and we may temporarily slow or pause activity that looks automated or abusive.",
    ],
  },
  {
    title: "Suspension and termination",
    body: [
      "We may suspend access if you materially breach these Terms, do not pay, or your use puts the service or other customers at risk. Where reasonable we will warn you first and give you a chance to fix the issue.",
      "Either party may end this agreement: you by cancelling and deleting your account, and we with 30 days' notice, or immediately for a serious breach. If we end it without cause, we will refund any prepaid fees for the unused period.",
    ],
  },
  {
    title: "Your data when the agreement ends",
    body: [
      `You can export your proposals at any time while your account is active. When you delete your workspace, or ${"{{DATA_RETENTION_AFTER_TERMINATION}}"} after the agreement ends, we delete Customer Data from our live systems. Backups are overwritten on their normal cycle (${"{{BACKUP_RETENTION}}"}).`,
    ],
  },
  {
    title: "Our intellectual property",
    body: [
      "We own the service, including its software, design and documentation. These Terms give you a right to use the service during your subscription; they do not transfer any of our intellectual property. If you send us feedback, we may use it without obligation to you.",
    ],
  },
  {
    title: "Warranty disclaimer",
    body: [
      "We will provide the service with reasonable skill and care. Apart from that, and to the extent the law allows, the service is provided \"as is\" and \"as available\", and we disclaim all other warranties, including fitness for a particular purpose, accuracy of AI output, and uninterrupted or error-free operation.",
    ],
  },
  {
    title: "Limitation of liability",
    body: [
      "To the extent the law allows, neither party is liable for indirect or consequential loss, or for loss of profits, revenue, contracts (including bids not won), goodwill or data, however caused.",
      `To the extent the law allows, each party's total liability arising out of or in connection with these Terms in any 12-month period is limited to the greater of the fees you paid us in the 12 months before the event giving rise to the claim and ${"{{MINIMUM_LIABILITY_CAP}}"}.`,
      "Nothing in these Terms limits liability that cannot be limited by law, such as liability for fraud, or for death or personal injury caused by negligence.",
    ],
  },
  {
    title: "Indemnities",
    body: [
      "You will defend and indemnify us against third-party claims arising from Customer Data you upload without the rights you need, from your submissions to buyers, or from your breach of the acceptable use rules.",
      "We will defend and indemnify you against third-party claims that the service itself (excluding Customer Data and AI output built from it) infringes their intellectual property rights.",
    ],
  },
  {
    title: "Governing law and venue",
    body: [
      `These Terms are governed by the laws of ${COMPANY.governingLaw}. The courts of ${COMPANY.venue} have exclusive jurisdiction, except that either party may seek urgent relief in any competent court.`,
    ],
  },
  {
    title: "Changes to these Terms",
    body: [
      "We may update these Terms. For material changes we will give at least 30 days' notice by email or in the app, and ask you to accept the new version before you continue using the service. If you do not agree, you can cancel before the change takes effect.",
    ],
  },
  {
    title: "General",
    body: [
      "These Terms, together with the Privacy Policy, any DPA you sign, and any order you place, are the whole agreement between us about the service. Neither party is liable for delays caused by events beyond its reasonable control. If any part of these Terms is unenforceable, the rest still applies. You may not transfer this agreement without our consent; we may transfer it to a successor of our business with notice.",
    ],
  },
  {
    title: "Contact",
    body: [`Questions about these Terms: ${COMPANY.contactEmail}. Notices to us: ${COMPANY.legalName}, ${COMPANY.registeredAddress}.`],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      meta={`Version ${TERMS_VERSION} · Last updated ${TERMS_UPDATED}`}
      intro="These terms apply when a business uses DraftBid AI. Please read them; they explain what the service does and does not do, and who is responsible for what you submit to buyers."
      sections={sections}
    />
  );
}
