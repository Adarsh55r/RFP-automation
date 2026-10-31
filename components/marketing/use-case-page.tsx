import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroAtmosphere } from "@/components/marketing/hero-atmosphere";
import { Section } from "@/components/marketing/section";

export type UseCase = {
  eyebrow: string;
  title: string;
  intro: string;
  does: string[];
  doesNot: string[];
  signupSegment?: string;
};

/** A use-case page: what the product does for this kind of bid, and what it does not. */
export function UseCasePage({ useCase }: { useCase: UseCase }) {
  return (
    <>
      <section className="relative -mt-[68px] overflow-hidden pt-[68px]">
        <HeroAtmosphere />
        <div className="animate-fade-up relative mx-auto max-w-content px-6 py-16 md:px-8 md:py-24">
          <p className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-brand uppercase">{useCase.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl md:leading-[1.15]">
            {useCase.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate sm:text-lg">{useCase.intro}</p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link href={`/sign-up?plan=free${useCase.signupSegment ? `&seg=${useCase.signupSegment}` : ""}`}>
                Draft your first proposal free
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <Section>
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">What DraftBid AI does</h2>
            <ul className="mt-6 flex flex-col gap-3">
              {useCase.does.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">What it does not do</h2>
            <ul className="mt-6 flex flex-col gap-3">
              {useCase.doesNot.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate">
                  <Minus aria-hidden className="mt-0.5 size-4 shrink-0 text-slate" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
