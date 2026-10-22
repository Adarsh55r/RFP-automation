import { BadgeDollarSign, BookMarked, ListChecks, ShieldCheck, Stamp } from "lucide-react";
import { Section } from "@/components/marketing/section";

const features = [
  {
    icon: ListChecks,
    title: "Never miss a requirement",
    body: "Every mandatory item, scoring weight, deadline, page limit, and required form goes into one checklist. After drafting, an evaluator-style review shows exactly what’s covered and what still needs you — before the buyer finds it.",
  },
  {
    icon: BookMarked,
    title: "Sounds like you — not like AI",
    body: "Drafts are built from your case studies, team bios, certifications, and approved answers, and cite the buyer’s own requirements by name. When a fact is missing, DraftBid AI flags it for you instead of making it up.",
  },
  {
    icon: ShieldCheck,
    title: "Ready for public sector and security reviews",
    body: "Handles US state and local RFPs, UK tenders with Social Value questions, and security questionnaires (SOC 2, ISO 27001, Cyber Essentials, HIPAA). Every draft matches the buyer’s spelling, currency, and terminology.",
  },
  {
    icon: Stamp,
    title: "Professional Word and PDF",
    body: "Export a professional proposal with cover page, contents, page numbers, and clean tables — no reformatting at midnight.",
  },
  {
    icon: BadgeDollarSign,
    title: "Priced for small teams",
    body: "Enterprise RFP platforms sell five-figure annual contracts. DraftBid AI starts free and runs month-to-month. Growth, at $149 (£119) a month, covers a team that bids every week.",
  },
] as const;

export function FeatureGrid() {
  return (
    <Section id="product" className="bg-surface">
      <p className="font-mono text-xs tracking-wide text-slate uppercase">
        Why DraftBid AI
      </p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium text-ink md:text-4xl">
        Everything a bid manager does — at a small-business price.
      </h2>
      <ul className="mt-12 divide-y divide-border border-y border-border">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <li
              key={feature.title}
              className="grid gap-4 py-8 md:grid-cols-[auto_1fr] md:items-start md:gap-8"
            >
              <div className="flex size-10 items-center justify-center rounded-control bg-brand/10 text-brand">
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-sans text-lg font-semibold text-ink">
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
