import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { displayPrice, formatPrice, publicPlans, signupHref } from "@/lib/plans";

export function PricingTeaser() {
  return (
    <Section id="pricing">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-brand uppercase">
            Pricing
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink md:text-[2.6rem] md:leading-[1.15]">
            Priced for small teams.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate">
            Start free with a full proposal. Upgrade when you bid more often.
            Paid plans are month-to-month.
          </p>
        </div>
        <Button asChild variant="secondary" className="w-full md:w-auto">
          <Link href="/pricing">Compare all plans</Link>
        </Button>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {publicPlans.map((plan) => (
          <Card
            key={plan.id}
            data-highlight={plan.highlighted ? "true" : undefined}
            className={cn(
              "hover-lift glow-ring relative flex h-full flex-col overflow-hidden",
              plan.highlighted && "border-brand/50 shadow-[0_20px_50px_-20px_rgb(var(--glow)/0.55)]",
            )}
          >
            {plan.highlighted ? (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(70%_100%_at_50%_0%,rgb(var(--glow)/0.16),transparent)]" />
            ) : null}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm text-slate">{plan.summary}</p>
              </div>
              {plan.highlighted ? (
                <Badge variant="accent">Recommended</Badge>
              ) : null}
            </div>
            <p className="relative mt-6 font-display text-4xl font-semibold tracking-tight text-ink">
              {formatPrice(displayPrice(plan, "usd", "monthly").amount, "usd")}
              <span className="ml-1 font-sans text-sm font-medium text-slate">
                {plan.billing.kind === "free" ? "no card needed" : displayPrice(plan, "usd", "monthly").suffix}
              </span>
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-2 text-sm leading-relaxed text-slate">
              {plan.features.slice(0, 4).map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <Button
              asChild
              className="mt-8 w-full"
              variant={plan.highlighted ? "primary" : "secondary"}
            >
              <Link href={signupHref(plan.id)}>{plan.ctaLabel}</Link>
            </Button>
          </Card>
        ))}
      </div>
    </Section>
  );
}
