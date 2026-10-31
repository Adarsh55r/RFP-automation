import type { Metadata } from "next";
import { FreeChecklistTool } from "@/components/marketing/free-checklist-tool";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { FunnelBeacon } from "@/components/marketing/funnel-beacon";

export const metadata: Metadata = {
  title: "Free RFP requirement checklist, no signup",
  description:
    "Upload one RFP and get its mandatory requirements, deadlines, page limits, evaluation criteria and required forms as a checklist. No account; the file is not stored.",
  alternates: { canonical: "/tools/rfp-checklist" },
};

export default function FreeChecklistPage() {
  return (
    <>
      <FunnelBeacon />
      <SiteHeader />
      <main id="main-content" className="relative overflow-hidden">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
        <div className="animate-fade-up relative mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16 md:px-8 md:py-20">
          <header>
            <p className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-brand uppercase">Free tool · No account needed</p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
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
