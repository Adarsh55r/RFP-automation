import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <section aria-label="Get started" className="marketing-dark-band">
      <div className="mx-auto flex max-w-content flex-col items-start gap-6 px-6 py-16 md:px-8 md:py-24">
        <h2 className="max-w-3xl font-display text-3xl font-medium leading-snug text-surface-raised md:text-5xl md:leading-tight">
          Have an RFP due soon? Start with the checklist and a first draft.
        </h2>
        <p className="max-w-2xl text-base leading-relaxed text-surface-raised/80 md:text-lg">
          Upload it, confirm the requirements, and get a draft built from your
          own documents, with every gap it finds highlighted for you.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" variant="accent">
            <Link href="/sign-up?plan=free">Draft your first proposal free</Link>
          </Button>
          <p className="text-sm text-surface-raised/70">
            Free trial · No credit card
          </p>
        </div>
      </div>
    </section>
  );
}
