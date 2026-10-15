import { BadgeDollarSign, BookMarked, ListChecks, ShieldCheck, Stamp } from "lucide-react";
import { Section } from "@/components/marketing/section";

const features = [
  {
    icon: BookMarked,
    title: "Your own answer library",
    body: "Keep case studies, past performance, team bios, certifications, and approved answers in one place. New drafts pull from that library instead of writing proof you do not have — and the 40th security questionnaire takes minutes, not days.",
  },
  {
    icon: ListChecks,
    title: "A compliance checklist you can edit",
    body: "Mandatory requirements, scoring weights, page limits, required forms, Q&A deadlines, and addenda land in one checklist. Most small-business bids are thrown out on compliance, not quality — this is where you stop that.",
  },
  {
    icon: ShieldCheck,
    title: "Public sector and security reviews included",
    body: "Works for US state, local, and education RFPs, UK tenders with Social Value questions, and vendor security questionnaires (SOC 2, ISO 27001, Cyber Essentials, HIPAA). Drafts follow the buyer’s spelling, currency, and terminology.",
  },
  {
    icon: Stamp,
    title: "Export with your letterhead",
    body: "Export to Word or PDF with a cover page, contents, page numbers, and clean tables. Paid plans add your header, footer, and signatory block. The file should look like it came from your shared drive, not from a vendor portal.",
  },
  {
    icon: BadgeDollarSign,
    title: "Small-business pricing",
    body: "Enterprise RFP platforms are sold on five-figure annual contracts. DraftWin starts at $0, month-to-month. Most teams land on Growth at $149 (£119) a month.",
  },
] as const;

export function FeatureGrid() {
  return (
    <Section id="product" className="bg-surface">
      <p className="font-mono text-xs tracking-wide text-slate uppercase">
        Product
      </p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium text-ink md:text-4xl">
        Built for teams where the founder, a sales lead, or an ops manager writes the proposal.
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
