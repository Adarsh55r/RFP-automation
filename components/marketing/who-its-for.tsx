import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";
import { SEGMENTS } from "@/lib/segments";

/** Links to the segment landing pages; the product is the same for all of them. */
export function WhoItsFor() {
  return (
    <Section id="who-its-for">
      <p className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-brand uppercase">Who it&apos;s for</p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink md:text-[2.6rem] md:leading-[1.15]">
        Small teams that answer RFPs alongside their day job.
      </h2>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SEGMENTS.map((segment) => (
          <li key={segment.slug}>
            <Link
              href={`/for/${segment.slug}`}
              className={cn(
                "group flex h-full flex-col justify-between gap-4 hover-lift glow-ring rounded-card border border-border bg-surface-raised/80 p-5 backdrop-blur hover:border-brand/40",
                focusRing,
              )}
            >
              <span>
                <span className="block font-sans text-base font-semibold text-ink">{segment.name}</span>
                <span className="mt-1 block text-sm leading-relaxed text-slate">For {segment.audience}.</span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                See how it works for you
                <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-slate">
        Also used for{" "}
        <Link href="/use-cases/uk-tenders" className="text-brand underline-offset-2 hover:underline">
          UK public-sector tenders
        </Link>{" "}
        and{" "}
        <Link href="/use-cases/security-questionnaires" className="text-brand underline-offset-2 hover:underline">
          security questionnaires
        </Link>
        .
      </p>
    </Section>
  );
}
