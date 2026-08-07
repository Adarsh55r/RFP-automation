"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Badge } from "@/components/ui/badge";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";
import {
  INTENDED_PLAN_COOKIE,
  INTENDED_PLAN_COOKIE_MAX_AGE,
} from "@/lib/intended-plan";
import { plans } from "@/lib/plans";
import type { PlanId } from "@/types";

function persistIntendedPlan(planId: PlanId) {
  document.cookie = `${INTENDED_PLAN_COOKIE}=${planId}; path=/; max-age=${INTENDED_PLAN_COOKIE_MAX_AGE}; SameSite=Lax`;
  try {
    window.localStorage.setItem(INTENDED_PLAN_COOKIE, planId);
  } catch {
    // private mode / blocked storage — cookie is enough
  }
}

export function SignUpView({ planId }: { planId?: PlanId }) {
  useEffect(() => {
    if (planId) persistIntendedPlan(planId);
  }, [planId]);

  const plan = plans.find((item) => item.id === planId);

  return (
    <AuthShell
      title="Create your DraftWin account"
      subtitle="Agency name and team size come next — this step is just you."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className={cn("font-semibold text-brand", focusRing, "rounded-control")}
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
          {plan.highlighted ? <Badge variant="accent">Most popular</Badge> : null}
        </div>
      ) : null}

      <SignUp
        appearance={clerkAppearance}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/onboarding"
        fallbackRedirectUrl="/onboarding"
        unsafeMetadata={{
          intendedPlan: planId ?? null,
        }}
      />
    </AuthShell>
  );
}
