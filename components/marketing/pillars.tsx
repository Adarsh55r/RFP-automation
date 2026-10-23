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
    body: "Your past proposals, case studies, team and certifications become a library every new bid draws on, with your first bid set up with you if you want help.",
  },
] as const;

export function Pillars() {
  return (
    <Section id="product" className="bg-surface">
      <p className="font-mono text-xs tracking-wide text-slate uppercase">Why DraftBid AI</p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium text-ink md:text-4xl">
        A first draft you can check, built from documents you trust.
      </h2>
      <ul className="mt-12 grid gap-8 md:grid-cols-3">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <li key={pillar.title} className="flex flex-col gap-4">
              <div className="flex size-10 items-center justify-center rounded-control bg-brand/10 text-brand">
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
              </div>
              <h3 className="font-sans text-lg font-semibold text-ink">{pillar.title}</h3>
              <p className="text-sm leading-relaxed text-slate">{pillar.body}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
