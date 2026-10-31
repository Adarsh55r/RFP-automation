import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/marketing/reveal";
import { Button } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <section aria-label="Get started" className="px-4 py-16 md:px-8 md:py-24">
      <Reveal className="marketing-dark-band relative mx-auto max-w-content overflow-hidden rounded-[28px] shadow-[0_30px_80px_-30px_rgb(var(--glow)/0.55)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_30%_0%,#000_20%,transparent_70%)]" />
        <div className="relative flex flex-col items-start gap-6 px-8 py-14 md:px-14 md:py-20">
          <h2 className="max-w-3xl font-display text-3xl font-semibold leading-snug tracking-tight text-white md:text-5xl md:leading-tight">
            Have an RFP due soon? Start with the checklist and a first draft.
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
            Upload it, confirm the requirements, and get a draft built from your own documents, with every gap it finds
            highlighted for you.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="accent" className="group">
              <Link href="/sign-up?plan=free">
                Draft your first proposal free
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
              </Link>
            </Button>
            <p className="text-sm text-white/70">Free trial · No credit card</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
