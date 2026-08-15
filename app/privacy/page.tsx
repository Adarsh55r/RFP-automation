import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How DraftWin collects, uses, stores, and deletes agency and RFP data. Written for Indian IT services agencies.",
};

const sections = [
  {
    title: "Who we are",
    body: [
      "DraftWin is a B2B software product that helps Indian IT services agencies turn private-sector RFP documents into proposal drafts. This policy explains what we collect, why we collect it, who we share it with, and how you can ask us to change or delete it.",
      "DraftWin is built for private-sector vendor empanelment, security questionnaires, and agency pitch packs. It is not a GeM or government-tender portal, and we do not process GeM credentials or tender-portal logins.",
    ],
  },
  {
    title: "Whose data this covers",
    body: [
      "This policy covers people who visit draftwin.in (or our current app domain), create an account, invite teammates, upload RFPs, store library content, or contact support.",
      "If you upload an RFP that names a client, evaluators, or your own staff, you are the controller of that content. You must have a lawful basis to put that information into DraftWin. We process it only to provide the product to your agency.",
    ],
  },
  {
    title: "What we collect",
    body: [
      "Account data: name, work email, authentication identifiers from our sign-in provider (Clerk), agency name, team size, and the plan you choose.",
      "Workspace content: RFP files you upload (PDF or Word), extracted requirements, library items (case studies, bios, stack write-ups, rate-card language), generated draft sections, and exported Word files we generate for download.",
      "Billing data: plan tier, subscription status, and, when payments go live, invoice details such as GSTIN and billing email. We do not store full card numbers on DraftWin servers. Payment processors handle card data under their own policies.",
      "Usage data: pages visited in the app, feature actions such as extract, draft, and export, approximate timestamps, and technical logs needed to keep the service running (browser type, IP address, error traces).",
      "Support data: emails or messages you send us, including any files you attach to a ticket.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "To create and secure your account, remember that you are signed in, and route you through onboarding.",
      "To extract requirements from an uploaded RFP, draft proposal sections from your library, and export a Word file you can send.",
      "To enforce plan limits (for example proposals per month), show billing status, and issue GST invoices on paid plans.",
      "To fix bugs, prevent abuse, and keep the product available during IST business hours.",
      "We do not sell your data. We do not use your RFP files or library content to train public foundation models. Model providers may process prompts and document text solely to return an extraction or draft for your workspace, under their enterprise processing terms.",
    ],
  },
  {
    title: "Legal bases (India)",
    body: [
      "We process personal data to perform our contract with your agency (providing the DraftWin workspace) and for legitimate uses needed to run a B2B SaaS product: security, billing, and support.",
      "Where India’s Digital Personal Data Protection Act, 2023 applies, we process personal data for the specified purpose of delivering DraftWin, with notice as set out in this policy. If we ever need consent for a separate purpose (for example a marketing newsletter), we will ask for it and you can withdraw it.",
    ],
  },
  {
    title: "Who we share it with",
    body: [
      "Infrastructure and subprocessors that host or process data on our behalf: Clerk (authentication), Neon (application database), Supabase (RFP file storage), and our current language-model provider (Google Gemini or Anthropic, depending on configuration) to generate extractions and drafts.",
      "Payment and invoicing partners, when you are on a paid plan, to collect fees and issue GST invoices.",
      "Professional advisers or authorities if the law requires it, or to protect the service against fraud or abuse.",
      "We do not share your workspace with other DraftWin customers. Teammates only see what your agency account is set up to show them.",
    ],
  },
  {
    title: "Where data lives and how long we keep it",
    body: [
      "Application data is stored with our cloud providers. Some subprocessors may process data outside India. We choose vendors that offer contractual protections for customer content.",
      "We keep account and workspace data while your agency uses DraftWin. Proposal history retention follows your plan (for example 90 days on Starter, 12 months on Growth). Source files and drafts are removed when you delete them or when you ask us to delete the workspace, except for limited backups and legal records we must keep for a short period.",
      "Server logs are kept only as long as needed for security and debugging, then deleted or aggregated.",
    ],
  },
  {
    title: "Security",
    body: [
      "Access to production systems is limited to people who operate DraftWin. RFP uploads go to a dedicated storage bucket. Database access uses encrypted connections. Sign-in is handled by Clerk rather than a password database we run ourselves.",
      "No internet service is perfectly secure. You should still treat exported Word files as confidential client material and follow your own agency’s data-handling rules.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can review and edit agency name and team size in Settings, manage library items, and download a generated proposal as DOCX.",
      "You can ask us to correct account details, export workspace content we hold, or delete your account and associated files. Deletion removes source RFPs, library items, and generated drafts from live systems. We may retain invoices and records we are required to keep under Indian tax law.",
      "You can close the account from the product or by emailing privacy@draftwin.in. If a teammate should no longer have access, remove their seat rather than sharing a login.",
    ],
  },
  {
    title: "Cookies and similar technology",
    body: [
      "We use essential cookies and local storage so you stay signed in, so the app can remember a plan you picked before sign-up, and so the product works in the browser. We do not run third-party advertising pixels on the app.",
      "Clerk may set its own cookies to complete sign-in. See Clerk’s privacy documentation for that flow.",
    ],
  },
  {
    title: "Children",
    body: [
      "DraftWin is a workplace tool for agencies. It is not directed at children. We do not knowingly collect personal data from anyone under 18.",
    ],
  },
  {
    title: "Changes",
    body: [
      "If we change this policy in a material way, we will update the date below and, where the change affects how we use existing data, we will notify the account email on file.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Privacy questions, access requests, and deletion requests: privacy@draftwin.in. We aim to reply within two IST business days, and sooner for urgent security issues.",
      "If you are not satisfied with our response, you may raise the matter with the Data Protection Board of India once the relevant rules are in force, or with any other authority that has jurisdiction over your complaint.",
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
            Last updated 15 August 2026. This is how DraftWin handles personal
            and agency data. It is written in plain language for IT services
            teams in India. It is not legal advice.
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
