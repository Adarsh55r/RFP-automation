import { BadgeDollarSign, BookMarked, ListChecks, ShieldCheck, Stamp } from "lucide-react";
import { Section } from "@/components/marketing/section";

const features = [
  {
    icon: ListChecks,
    title: "Requirements in one checklist",
    body: "Mandatory items, scoring weights, deadlines, page limits and required forms go into one checklist you confirm, with flags where the document is ambiguous. After drafting, a compliance review shows what is covered and what still needs you.",
  },
  {
    icon: BookMarked,
    title: "Written from your own work",
    body: "Drafts are built from your case studies, team bios, certifications and approved answers, and refer to the buyer’s own requirements by name. When a fact is missing, the draft leaves a highlighted gap for you to fill, and certifications your library does not mention are flagged before export.",
  },
  {
    icon: ShieldCheck,
    title: "Public-sector tenders and questionnaires",
    body: "Works with commercial RFPs, US state and local RFPs, UK tenders including Social Value questions, and security questionnaires supplied as PDF or Word. Drafts follow the buyer’s spelling and currency.",
  },
  {
    icon: Stamp,
    title: "Formatted Word and PDF",
    body: "Export a proposal with a cover page, contents, page numbers and clean tables, ready for your final edits.",
  },
  {
    icon: BadgeDollarSign,
    title: "Priced for small teams",
    body: "Start free with no credit card. Paid plans are month-to-month, with the number of proposals each includes shown up front.",
  },
] as const;

export function FeatureGrid() {
  return (
    <Section id="product" className="bg-surface">
      <p className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-brand uppercase">
        Why DraftBid AI
      </p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink md:text-[2.6rem] md:leading-[1.15]">
        The groundwork of a bid response, done before you start writing.
      </h2>
      <ul className="mt-12 divide-y divide-border border-y border-border">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <li
              key={feature.title}
              className="grid gap-4 py-8 md:grid-cols-[auto_1fr] md:items-start md:gap-8"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-gradient text-on-brand shadow-[0_10px_26px_-10px_rgb(var(--glow)/0.8)]">
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate">
                  {feature.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
