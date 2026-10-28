import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/legal-page";
import { AI_NO_TRAINING_CONFIRMED, COMPANY } from "@/lib/company";
import { PRIVACY_UPDATED, PRIVACY_VERSION } from "@/lib/legal";

// DRAFT: must be reviewed by a lawyer in the company's jurisdiction before use. See docs/legal/README.md.
// Every retention statement here must match what the code does (see AUDIT.md).

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How DraftBid AI collects, uses, stores, and deletes company and RFP data, including your rights under GDPR, UK GDPR, and US state privacy laws such as the CCPA.",
  alternates: { canonical: "/privacy" },
};

const link = "font-semibold text-brand underline underline-offset-4";

const sections: LegalSection[] = [
  {
    title: "Who we are",
    body: [
      `${COMPANY.productName} is an independent B2B software product, built and run by its founder ("we", "us"), that helps businesses turn RFPs, public-sector tenders and questionnaires into proposal drafts.`,
      "DraftBid AI is a drafting tool. It is not a procurement portal, and we do not ask for or store your logins to government or buyer procurement portals.",
    ],
  },
  {
    title: "Our role: controller and processor",
    body: [
      "For account data (who you are, your sign-in, your plan), we are the controller.",
      <>
        For the content you put into your workspace (RFPs, library items, drafts), your company is the controller (or &ldquo;business&rdquo;) and we act as its processor (or &ldquo;service provider&rdquo;). You must have a lawful basis to upload any personal data in those documents. Our <Link className={link} href="/dpa">Data Processing Addendum</Link> sets out our processor commitments.
      </>,
    ],
  },
  {
    title: "What we collect",
    body: [
      [
        "Account data: your email address and the sign-in details held by our authentication provider (Clerk), your company name, team size, and the plan on your account.",
        "Workspace content: RFP files you upload, the full text read from them, the requirements extracted from them, your library items (case studies, bios, certifications, saved answers, company profile), and generated drafts.",
        "Usage records: which plan allowances you have used, and for each AI request the model, the number of tokens and the cost. These records never contain document text.",
        "Product events, kept in our own database: milestones on your account such as your first upload, first draft and first export, the page or campaign you signed up from, and your optional answer to the industry question. Marketing pages also record anonymous page views (the page and campaign only, with no cookie or identifier). None of these contain document content.",
        "Payment data: payments are taken by Dodo Payments, our reseller and merchant of record, which collects your card or other payment details and billing address directly. We never receive full card numbers. We keep the Dodo customer and subscription IDs, the plan you bought, its status and renewal date, and payment IDs for extra proposals.",
        "Technical data: IP address, browser type and timestamps in our hosting provider's logs, used for security and debugging.",
        "Free checklist tool (no account): the file you upload is read in memory to build the checklist and sent to our AI provider for that purpose; it is not stored. To apply the daily limit we keep a one-way hash of your IP address, never the address itself. If you choose to leave your email there, we keep it with the date you agreed to be contacted.",
        "Website import: if you ask us to import your company website, we read its public pages and send their text to our AI provider to draft library items for you.",
        "Analytics and error reports: cookie-free page-view statistics (Vercel Web Analytics) and technical error reports (Sentry). Error reports include your account ID, the page and the technical error; request bodies, cookies and document content are removed before sending.",
      ],
    ],
  },
  {
    title: "How we use it",
    body: [
      [
        "To run the product: store your uploads, read their text, extract requirements, draft proposal sections, and export Word or PDF files.",
        "To enforce plan limits and AI usage ceilings, and to show you what you have used.",
        "To fix bugs, prevent abuse, and keep the service available.",
        "To contact you about your account and important changes to the service or these policies.",
      ],
      AI_NO_TRAINING_CONFIRMED
        ? "We do not sell your personal information or share it for cross-context behavioural advertising. We do not use your workspace content to train AI models, and under our AI providers' API terms they do not either."
        : "We do not sell your personal information or share it for cross-context behavioural advertising. We do not use your workspace content to train AI models.",
    ],
  },
  {
    title: "Legal bases (UK and EU)",
    body: [
      "Where the UK GDPR or EU GDPR applies, we process personal data to perform our contract with your company, for our legitimate interests in running a secure B2B service (security, fraud prevention, support), and to meet legal obligations such as tax record-keeping.",
      "If we ever need consent for a separate purpose, such as a marketing newsletter, we will ask for it, and you can withdraw it at any time.",
    ],
  },
  {
    title: "Who we share it with",
    body: [
      <>
        Our subprocessors, each listed with its purpose and location on the <Link className={link} href="/subprocessors">subprocessors page</Link>: Vercel (hosting and analytics), Neon (database), Supabase (file storage), Clerk (sign-in), Sentry (error reports), Dodo Payments (payments, as merchant of record), and our AI provider. The AI provider is OpenAI by default; Anthropic or Google (Gemini) is used only if configured instead. The AI provider receives the document text needed for each request.
      </>,
      "Authorities, when we are legally required to, and only to the extent required.",
      "We do not share your workspace with other customers. DraftBid AI does not currently offer shared team workspaces, so your workspace is visible only to your own account.",
    ],
  },
  {
    title: "International transfers",
    body: [
      "Our providers store data primarily in the United States (regions are on the subprocessors page). Where personal data from the UK or EEA is transferred, we rely on appropriate safeguards such as the EU Standard Contractual Clauses and the UK International Data Transfer Addendum, or an adequacy decision.",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      [
        "Uploaded RFP files, their extracted text and requirements, and drafts: until you delete that RFP or your workspace. Deletion removes them from our live systems straight away.",
        "Library items: until you delete them or your workspace.",
        "Free checklist tool: the file is not kept at all; hashed IP records are deleted after 30 days; an email you left there is kept until you ask us to delete it.",
        "Account data and usage records: while you have a workspace; deleted when you delete your workspace.",
        "We do not create embeddings or other derived copies of your documents beyond the extracted text and requirements described above.",
        "Database backups: held by our database provider for its restore window, then overwritten.",
        "Hosting logs and error reports: kept by Vercel and Sentry for the retention period of our plan with each provider, then deleted.",
        "AI provider: document text sent for a request may be kept by the provider for a limited period under its API data policy (for example for abuse monitoring), then deleted.",
        "Payment records: Dodo Payments keeps invoices and payment records for the period the law requires; we keep the billing IDs and plan history above for as long as your account exists.",
      ],
    ],
  },
  {
    title: "Security",
    body: [
      <>
        Data is encrypted in transit and at rest, files are private and open only through short-lived links, and every request is checked against the signed-in account. Details are on our <Link className={link} href="/security">security page</Link>. You should still treat exported files as confidential client material.
      </>,
    ],
  },
  {
    title: "Your rights and choices",
    body: [
      "You can edit your company name and team size in Settings, delete individual RFPs, manage your library, export your proposals, and delete your whole workspace from Settings at any time.",
      "Depending on where you live, you may also have the right to access, correct, delete or port your personal data, to object to or restrict certain processing, and to withdraw consent. California and other US state residents may request to know, delete or correct personal information, and we will not discriminate against you for exercising these rights.",
      `To make a request, email ${COMPANY.privacyEmail}. We may need to verify your identity.`,
    ],
  },
  {
    title: "Cookies",
    body: [
      "We use cookies that are strictly necessary for sign-in and security, set by our authentication provider, and one functional cookie that remembers the plan you picked on the pricing page for 30 days. We do not use advertising cookies, and our analytics do not use cookies.",
    ],
  },
  {
    title: "Children",
    body: [
      "DraftBid AI is a workplace tool for businesses. It is not directed at children, and we do not knowingly collect personal data from anyone under 18.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "If we change this policy in a material way, we will update the version and date at the top and, where the change affects how we use existing data, notify the email address on your account.",
    ],
  },
  {
    title: "Contact",
    body: [
      `Privacy questions, access requests and deletion requests: ${COMPANY.privacyEmail}. We aim to reply within two business days, and in any case within the time limits set by applicable law.`,
      "If you are in the UK, you can complain to the Information Commissioner's Office (ico.org.uk). If you are in the EU, you can complain to your local data protection authority. We would appreciate the chance to resolve your concern first.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      meta={`Version ${PRIVACY_VERSION} · Last updated ${PRIVACY_UPDATED}`}
      intro="How DraftBid AI handles personal and company data, in plain language, for businesses in the US, UK and elsewhere."
      sections={sections}
    />
  );
}
