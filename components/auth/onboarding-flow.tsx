"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { completeOnboarding } from "@/lib/actions/onboarding";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";
import {
  INTENDED_PLAN_COOKIE,
  parsePlanId,
} from "@/lib/intended-plan";
import {
  teamSizeOptions,
  type TeamSize,
} from "@/lib/onboarding";

function readStoredPlan(): string | undefined {
  try {
    const fromStorage = window.localStorage.getItem(INTENDED_PLAN_COOKIE);
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${INTENDED_PLAN_COOKIE}=`));
  return match?.split("=")[1];
}

export function OnboardingFlow() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [agencyName, setAgencyName] = useState("");
  const [teamSize, setTeamSize] = useState<TeamSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (user.unsafeMetadata?.onboardingCompleted) {
      router.replace("/dashboard");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    return (
      <Card className="mx-auto max-w-md">
        <p className="font-mono text-sm tracking-wide text-slate">Loading…</p>
      </Card>
    );
  }

  const goNext = () => {
    const trimmed = agencyName.trim();
    if (trimmed.length < 2) {
      setError("Enter your agency’s legal or trading name.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const finish = () => {
    if (!teamSize) {
      setError("Pick a team size so we can size your workspace.");
      return;
    }

    const intendedPlan =
      parsePlanId(String(user.unsafeMetadata?.intendedPlan ?? "")) ??
      parsePlanId(readStoredPlan());

    startTransition(async () => {
      setError(null);

      const result = await completeOnboarding({
        agencyName: agencyName.trim(),
        teamSize,
        intendedPlan,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          intendedPlan: intendedPlan ?? user.unsafeMetadata?.intendedPlan ?? null,
          agencyName: agencyName.trim(),
          teamSize,
          onboardingCompleted: true,
        },
      });

      router.replace("/dashboard");
    });
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="font-mono text-xs tracking-wide text-slate uppercase">
        Onboarding · step {step} of 2
      </p>
      <h1 className="mt-4 font-display text-3xl font-medium text-ink md:text-4xl">
        {step === 1 ? "What is your agency called?" : "How big is the team?"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate">
        {step === 1
          ? "We use this on proposals and invoices. You can change it later."
          : "Helps us pick defaults for seats and library folders. Not a hard limit."}
      </p>

      <Card className="mt-8">
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <label htmlFor="agency-name" className="text-sm font-medium text-ink">
              Agency name
            </label>
            <Input
              id="agency-name"
              name="agency-name"
              autoFocus
              autoComplete="organization"
              placeholder="e.g. Northbeam Digital Pvt Ltd"
              value={agencyName}
              aria-invalid={Boolean(error && step === 1)}
              onChange={(event) => setAgencyName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  goNext();
                }
              }}
            />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="button" onClick={goNext} className="w-full">
              Continue
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Team size">
              {teamSizeOptions.map((option) => {
                const selected = teamSize === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTeamSize(option.value)}
                    className={cn(
                      "rounded-card border px-4 py-4 text-left transition-[border-color,transform] duration-hover ease-out",
                      selected
                        ? "border-brand bg-brand/5"
                        : "border-border bg-surface-raised hover:-translate-y-0.5",
                      focusRing,
                    )}
                  >
                    <span className="block font-sans text-sm font-semibold text-ink">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-sm text-slate">{option.hint}</span>
                  </button>
                );
              })}
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                disabled={pending}
              >
                Back
              </Button>
              <Button
                type="button"
                className="w-full flex-1"
                onClick={finish}
                disabled={pending}
              >
                {pending ? "Saving…" : "Go to dashboard"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
