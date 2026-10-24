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
      <p className="font-mono text-xs tracking-wide text-slate uppercase">Who it&apos;s for</p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium text-ink md:text-4xl">
        Small teams that answer RFPs alongside their day job.
      </h2>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SEGMENTS.map((segment) => (
          <li key={segment.slug}>
            <Link
              href={`/for/${segment.slug}`}
              className={cn(
                "group flex h-full flex-col justify-between gap-4 rounded-card border border-border bg-surface-raised p-5 transition-colors hover:border-brand/50",
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
