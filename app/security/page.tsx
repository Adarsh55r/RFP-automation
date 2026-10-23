import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { AI_NO_TRAINING_CONFIRMED, COMPANY } from "@/lib/company";

// Every statement here must stay true in the code. Do not add certifications that do not exist.

export const metadata: Metadata = {
  title: "Security",
  description: "How DraftBid AI protects RFP files, library content and drafts, and how to report a vulnerability.",
  alternates: { canonical: "/security" },
};

const link = "font-semibold text-brand underline underline-offset-4";

const sections: LegalSection[] = [
  {
    title: "Encryption",
    body: [
      "All traffic to DraftBid AI uses HTTPS, and browsers are told to use HTTPS only (HSTS). Our database and file storage providers encrypt stored data at rest.",
    ],
  },
  {
    title: "Separation between customers",
    body: [
      "Every request is checked on our server against the signed-in account; IDs sent from the browser are never trusted on their own. Requests for another account's RFPs, drafts, library items or files get a \"not found\" response. Automated tests check this for each data endpoint.",
    ],
  },
  {
    title: "Uploaded files",
    body: [
      [
        "Files are stored in private storage. Opening a file creates a link that only works for 60 seconds, and only for the account that owns it.",
        "File type is checked by content, not just by the file name. Only PDF and Word files are accepted, up to 25 MB.",
        "We only read text from files. Macros and embedded content are never run.",
      ],
    ],
  },
  {
    title: "AI processing",
    body: [
      AI_NO_TRAINING_CONFIRMED
        ? "Document text is sent to our AI provider through its business API to extract requirements and draft text. Under the provider's API terms, this data is not used to train its models. We do not train models on your data either."
        : "Document text is sent to our AI provider through its business API to extract requirements and draft text. We do not train models on your data.",
      <>
        The provider in use is listed on the <Link className={link} href="/subprocessors">subprocessors page</Link>. Text from uploaded documents is treated as data, never as instructions to the AI.
      </>,
    ],
  },
  {
    title: "Access by our team",
    body: [
      "Access to production systems is limited to named staff who need it to run the service. The internal admin area is restricted to verified staff email addresses and is hidden from everyone else.",
    ],
  },
  {
    title: "Logs and error reports",
    body: [
      "Error reports include the page, the technical error and your account ID. Request bodies, cookies and the content of your files, library and drafts are removed before a report is sent. We record AI usage (model, token counts, cost) without any document content.",
    ],
  },
  {
    title: "Retention and deletion",
    body: [
      "You can delete an RFP, with its file, extracted text and drafts, at any time, and you can delete your whole workspace from Settings. Deleted data is removed from our live systems straight away.",
      `Database backups are kept for ${"{{BACKUP_RETENTION}}"} and then overwritten.`,
    ],
  },
  {
    title: "Certifications",
    body: [
      "We do not currently hold SOC 2 or ISO 27001 certification. If your buyer requires them, tell us what you need and we will answer your security questionnaire honestly.",
    ],
  },
  {
    title: "Reporting a vulnerability",
    body: [
      `Email ${COMPANY.securityEmail} with the details and steps to reproduce. Please do not access other customers' data or disrupt the service while testing. We will acknowledge your report and keep you updated while we fix it.`,
    ],
  },
];

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust"
      title="Security"
      meta="Last updated October 23, 2026"
      intro="What we do to protect the RFPs, company content and drafts you put into DraftBid AI. Everything on this page describes how the product works today."
      sections={sections}
    />
  );
}
