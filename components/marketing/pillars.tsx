import { FileSearch, ListChecks, Library } from "lucide-react";
import { Section } from "@/components/marketing/section";

const pillars = [
  {
    icon: ListChecks,
    title: "Never miss a requirement.",
    body: "Mandatory questions, forms, page limits, deadlines and scoring weights in one checklist, including addenda. Each item shows the page it came from.",
  },
  {
    icon: FileSearch,
    title: "Nothing invented.",
    body: "Every statement about your company links to the document it came from; anything unsupported is highlighted for you, not guessed.",
  },
  {
    icon: Library,
    title: "Written from your own work.",
    body: "Your past proposals, case studies, team and certifications become a library every new bid draws on.",
  },
] as const;

export function Pillars() {
  return (
    <Section id="product">
      <p className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-brand uppercase">Why DraftBid AI</p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink md:text-[2.6rem] md:leading-[1.15]">
        A first draft you can check, built from documents you trust.
      </h2>
      <ul className="mt-12 grid gap-5 md:grid-cols-3">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <li
              key={pillar.title}
              className="hover-lift glow-ring flex flex-col gap-4 rounded-card border border-border bg-surface-raised/80 p-7 shadow-[var(--shadow-md)] backdrop-blur"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-gradient text-on-brand shadow-[0_10px_26px_-10px_rgb(var(--glow)/0.8)]">
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-lg font-semibold text-ink">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-slate">{pillar.body}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
