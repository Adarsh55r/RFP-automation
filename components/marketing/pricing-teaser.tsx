import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { formatInr, plans, signupHref } from "@/lib/plans";

export function PricingTeaser() {
  return (
    <Section id="pricing">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            Pricing
          </p>
          <h2 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
            Rupee plans. No per-seat surprise in USD.
          </h2>
        </div>
        <Button asChild variant="secondary" className="w-full md:w-auto">
          <Link href="/pricing">See full pricing</Link>
        </Button>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              "flex h-full flex-col transition-shadow duration-hover ease-out hover:shadow-[0_8px_24px_rgb(11_31_51_/_0.08)]",
              plan.highlighted && "border-accent shadow-[0_8px_24px_rgb(11_31_51_/_0.08)]",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-sans text-lg font-semibold text-ink">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm text-slate">{plan.summary}</p>
              </div>
              {plan.highlighted ? (
                <Badge variant="accent">Most popular</Badge>
              ) : null}
            </div>
            <p className="mt-6 font-display text-4xl font-medium text-ink">
              {formatInr(plan.monthlyInr)}
              <span className="ml-1 font-sans text-sm font-medium text-slate">
                {plan.monthlyInr === 0 ? "forever" : "/mo"}
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
