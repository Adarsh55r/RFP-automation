import Link from "next/link";
import { Check, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import type { Segment } from "@/lib/segments";

/** The one landing-page template every segment page uses (config in lib/segments.ts). */
export function SegmentLanding({ segment }: { segment: Segment }) {
  const signup = `/sign-up?plan=free&seg=${segment.slug}`;
  return (
    <>
      <section className="bg-surface">
        <div className="mx-auto max-w-content px-6 py-16 md:px-8 md:py-24">
          <p className="font-mono text-xs tracking-wide text-slate uppercase">For {segment.audience}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium tracking-tight text-ink md:text-5xl md:leading-[1.15]">
            {segment.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate sm:text-lg">{segment.subheadline}</p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="accent">
              <Link href={signup}>Draft your first proposal free</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/tools/rfp-checklist">Try the free RFP checklist</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate">
            Free trial · No credit card ·{" "}
            <Link href="/pricing" className="text-brand underline-offset-2 hover:underline">
              See pricing
            </Link>
          </p>
        </div>
      </section>

      <Section>
        <p className="font-mono text-xs tracking-wide text-slate uppercase">What makes these bids hard</p>
        <ul className="mt-8 grid gap-8 md:grid-cols-2">
          {segment.pains.map((pain) => (
            <li key={pain.title}>
              <h2 className="font-sans text-lg font-semibold text-ink">{pain.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate">{pain.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="bg-surface">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-medium text-ink md:text-3xl">What the checklist picks out</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate">
              From the RFP and any addenda, with the page each item came from, for you to confirm before drafting:
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {segment.checklistCatches.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-ink">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl font-medium text-ink md:text-3xl">What to upload first</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate">
              Drafts are written only from your own documents. These give the first draft the most to work with:
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {segment.uploadFirst.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-ink">
                  <FileUp aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {segment.sampleOutput ? (
        <Section>
          <h2 className="font-display text-2xl font-medium text-ink md:text-3xl">A sample first draft</h2>
          <p className="mt-3 text-sm text-slate">
            <a href={segment.sampleOutput.href} className="text-brand underline-offset-2 hover:underline">
              {segment.sampleOutput.title}
            </a>{" "}
            · generated from a public RFP ({segment.sampleOutput.source}).
          </p>
        </Section>
      ) : null}

      <section className="marketing-dark-band">
        <div className="mx-auto flex max-w-content flex-col items-start gap-6 px-6 py-16 md:px-8 md:py-20">
          <h2 className="max-w-3xl font-display text-3xl font-medium leading-snug text-surface-raised md:text-4xl">
            Try it on the next RFP you are working on.
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-surface-raised/80">
            You review every draft before it goes anywhere. Anything DraftBid AI cannot support from your documents is
            highlighted for you to fill.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="accent">
              <Link href={signup}>Draft your first proposal free</Link>
            </Button>
            <Link href="/tools/rfp-checklist" className="text-sm text-surface-raised/80 underline-offset-2 hover:underline">
              Or get a free requirement checklist, no account needed
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
