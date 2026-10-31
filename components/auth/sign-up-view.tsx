"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Badge } from "@/components/ui/badge";
import { useClerkAppearance } from "@/components/theme/use-clerk-appearance";
import { cn } from "@/lib/cn";
import { textLink } from "@/lib/focus";
import {
  INTENDED_PLAN_COOKIE,
  INTENDED_PLAN_COOKIE_MAX_AGE,
} from "@/lib/intended-plan";
import { isSellablePlan, PLANS } from "@/lib/plans";
import type { PlanId } from "@/types";

function persistIntendedPlan(planId: PlanId) {
  document.cookie = `${INTENDED_PLAN_COOKIE}=${planId}; path=/; max-age=${INTENDED_PLAN_COOKIE_MAX_AGE}; SameSite=Lax`;
  try {
    window.localStorage.setItem(INTENDED_PLAN_COOKIE, planId);
  } catch {
    // private mode / blocked storage — cookie is enough
  }
}

export function SignUpView({ planId, segment }: { planId?: PlanId; segment?: string }) {
  const appearance = useClerkAppearance();
  useEffect(() => {
    if (planId) persistIntendedPlan(planId);
  }, [planId]);

  const plan = planId && isSellablePlan(planId) ? PLANS[planId] : undefined;

  return (
    <AuthShell
      title="Create your free account"
      subtitle="Upload an RFP, check the requirements, and get a first draft written from your own documents. No credit card needed."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className={cn(textLink, "font-semibold")}
          >
            Log in
          </Link>
        </p>
      }
    >
      {plan ? (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-card border border-border bg-surface-raised px-4 py-4">
          <div>
            <p className="font-mono text-xs tracking-wide text-slate uppercase">
              Selected plan
            </p>
            <p className="mt-1 font-sans text-sm font-semibold text-ink">
              {plan.name}
            </p>
          </div>
          {plan.highlighted ? <Badge variant="accent">Recommended</Badge> : null}
        </div>
      ) : null}

      <SignUp
        appearance={appearance}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/onboarding"
        fallbackRedirectUrl="/onboarding"
        unsafeMetadata={{
          intendedPlan: planId ?? null,
          // Which landing page or campaign the sign-up came from (funnel report).
          seg: segment ?? null,
        }}
      />
      <p className="mt-4 text-xs leading-relaxed text-slate">
        Next, you will be asked to accept our{" "}
        <Link href="/terms" className={cn(textLink, "font-semibold")}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className={cn(textLink, "font-semibold")}>
          Privacy Policy
        </Link>{" "}
        before you can upload anything.
      </p>
    </AuthShell>
  );
}
