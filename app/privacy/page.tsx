import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How DraftBid AI collects, uses, stores, and deletes company and RFP data, including your rights under GDPR, UK GDPR, and US state privacy laws such as the CCPA.",
  alternates: { canonical: "/privacy" },
};

const sections = [
  {
    title: "Who we are",
    body: [
      "DraftBid AI is a B2B software product that helps small and mid-sized businesses turn RFPs, public-sector tenders, and security questionnaires into proposal drafts. This policy explains what we collect, why we collect it, who we share it with, and how you can ask us to change or delete it.",
      "DraftBid AI is a drafting tool. It is not a procurement portal, and we do not ask for or store your logins to government or buyer procurement portals.",
    ],
  },
  {
    title: "Whose data this covers",
    body: [
      "This policy covers people who visit our website, sign up for an account, or use DraftBid AI on behalf of their company.",
      "If you upload an RFP that names a buyer, evaluators, or your own staff, your company is the controller (or “business”) for that content and DraftBid AI acts as your processor (or “service provider”). You must have a lawful basis to put that information into DraftBid AI. We process it only to provide the product to your company. A data processing addendum (DPA) is available on request.",
    ],
  },
  {
    title: "What we collect",
    body: [
      "Account data: name, work email, authentication identifiers from our sign-in provider (Clerk), company name, team size, and the plan you choose.",
      "Workspace content: RFP files you upload, the requirements DraftBid AI extracts, library items (case studies, bios, certifications, saved answers, company profile), and generated drafts.",
      "Billing data: plan tier, subscription status, and invoice details such as billing address and VAT number. We do not store full card numbers on DraftBid AI servers. Our payment processor handles card data under its own policies and PCI DSS.",
      "Usage data: basic logs such as IP address, browser type, and timestamps, used for security and debugging.",
      "Product analytics and error reports: privacy-friendly, cookie-free page-view statistics (Vercel Web Analytics) and technical error reports (Sentry). Error reports include your account ID, the page, and the technical error, never your RFP files, library content, or drafts.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "To run the product: store your uploads, extract requirements, draft proposal sections, and export Word files.",
      "To enforce plan limits (for example proposals per month), show billing status, and issue invoices on paid plans.",
      "To fix bugs, prevent abuse, and keep the product available.",
      "We do not sell your personal information, we do not share it for cross-context behavioural advertising, and neither we nor our AI providers use your workspace content to train models.",
    ],
  },
  {
    title: "Legal bases (UK and EU)",
    body: [
      "Where the UK GDPR or EU GDPR applies, we process personal data to perform our contract with your company (providing the DraftBid AI workspace), for our legitimate interests in running a secure B2B service (security, fraud prevention, support), and to meet legal obligations such as tax record-keeping.",
      "If we ever need consent for a separate purpose (for example a marketing newsletter), we will ask for it and you can withdraw it at any time.",
    ],
  },
  {
    title: "Who we share it with",
    body: [
      "Subprocessors that host and run DraftBid AI: hosting and analytics (Vercel), error monitoring (Sentry), authentication (Clerk), database hosting, file storage, and AI model providers that process document text to extract requirements and draft sections under terms that prohibit training on your data.",
      "Payment and invoicing partners, when you are on a paid plan, to collect fees and issue invoices.",
      "Authorities, when we are legally required to, and only to the extent required.",
      "We do not share your workspace with other DraftBid AI customers. Teammates only see what your company account is set up to show them.",
    ],
  },
  {
    title: "International transfers, storage, and retention",
    body: [
      "Application data is stored with cloud providers primarily in the United States. Where personal data from the UK or EEA is transferred, we rely on appropriate safeguards such as the EU Standard Contractual Clauses, the UK International Data Transfer Addendum, or the EU–US / UK–US Data Privacy Framework where our providers are certified.",
      "We keep account and workspace data while your company uses DraftBid AI. Proposal history retention follows your plan (for example 90 days on Starter, 12 months on Growth). Source files and drafts are removed when you delete them or when you ask us to delete the workspace, except for limited backups and records we must keep for tax or legal reasons.",
    ],
  },
  {
    title: "Security",
    body: [
      "Data is encrypted in transit and at rest with our infrastructure providers. Access to production systems is limited to people who need it to run the service.",
      "No internet service is perfectly secure. You should still treat exported Word files as confidential client material and follow your own company’s data-handling rules.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can review and edit your company name and team size in Settings, manage library items, and download a generated proposal as DOCX.",
      "Depending on where you live, you may have the right to access, correct, delete, or port your personal data, to object to or restrict certain processing, and to withdraw consent. California and other US state residents may request to know, delete, or correct personal information, and we will not discriminate against you for exercising these rights.",
      "To make a request, email us using the contact details below. We may need to verify your identity. Deletion removes source RFPs, library items, and generated drafts from live systems; we may retain invoices and records we are legally required to keep.",
    ],
  },
  {
    title: "Cookies",
    body: [
      "We use cookies that are strictly necessary for sign-in and security. We do not use advertising cookies. If we add analytics that require consent, we will ask first where the law requires it.",
    ],
  },
  {
    title: "Children",
    body: [
      "DraftBid AI is a workplace tool for businesses. It is not directed at children. We do not knowingly collect personal data from anyone under 18.",
    ],
  },
  {
    title: "Changes to this policy",
    body: [
      "If we change this policy in a material way, we will update the date below and, where the change affects how we use existing data, we will notify the account email on file.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Privacy questions, access requests, and deletion requests: privacy@draftbidai.com. We aim to reply within two business days, and in any case within the time limits set by applicable law.",
      "If you are in the UK, you can complain to the Information Commissioner’s Office (ico.org.uk). If you are in the EU, you can complain to your local data protection authority. We would appreciate the chance to resolve your concern first.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="bg-surface">
        <article className="mx-auto max-w-content px-6 py-16 md:px-8 md:py-24">
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            Legal
          </p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ink md:text-5xl">
            Privacy policy
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate md:text-base">
            Last updated October 22, 2026. This is how DraftBid AI handles personal
            and company data. It is written in plain language for businesses in
            the US, UK, and elsewhere. It is not legal advice.
          </p>

          <div className="mt-12 flex flex-col gap-12">
            {sections.map((section, index) => (
              <section key={section.title} className="max-w-3xl">
                <h2 className="font-sans text-lg font-semibold text-ink">
                  <span className="mr-3 font-mono text-xs tracking-wide text-slate">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </h2>
                <div className="mt-4 flex flex-col gap-4">
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="text-sm leading-relaxed text-slate md:text-base"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
