import type { Metadata } from "next";
import { FreeChecklistTool } from "@/components/marketing/free-checklist-tool";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Free RFP requirement checklist, no signup",
  description:
    "Upload one RFP and get its mandatory requirements, deadlines, page limits, evaluation criteria and required forms as a checklist. No account; the file is not stored.",
  alternates: { canonical: "/tools/rfp-checklist" },
};

export default function FreeChecklistPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="bg-surface">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16 md:px-8 md:py-20">
          <header>
            <p className="font-mono text-xs tracking-wide text-slate uppercase">Free tool · No account needed</p>
            <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ink md:text-5xl">
              Get the requirement checklist for any RFP.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate">
              Upload one RFP, tender or questionnaire. You get its mandatory requirements, deadlines, page limits,
              evaluation criteria, required forms and questions, using the same extraction as the full product.
            </p>
          </header>
          <FreeChecklistTool />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
