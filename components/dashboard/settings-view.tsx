"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateAgencySettings } from "@/lib/actions/settings";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";
import { teamSizeOptions, type TeamSize } from "@/lib/onboarding";

export function SettingsView({
  agencyName,
  teamSize,
  email,
}: {
  agencyName: string;
  teamSize: string | null;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(agencyName);
  const [size, setSize] = useState<TeamSize | "">(
    teamSizeOptions.some((option) => option.value === teamSize)
      ? (teamSize as TeamSize)
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Enter your agency’s legal or trading name (at least 2 characters).");
      setSaved(false);
      return;
    }
    if (!size) {
      setError("Pick a team size so we can size your workspace.");
      setSaved(false);
      return;
    }

    startTransition(async () => {
      setError(null);
      setSaved(false);
      const result = await updateAgencySettings({
        agencyName: trimmed,
        teamSize: size,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <Card className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="settings-email" className="text-sm font-medium text-ink">
          Email
        </label>
        <Input id="settings-email" value={email} readOnly disabled />
        <p className="text-xs text-slate">Managed by your sign-in account.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="settings-agency" className="text-sm font-medium text-ink">
          Agency name
        </label>
        <Input
          id="settings-agency"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSaved(false);
          }}
          aria-invalid={Boolean(error && name.trim().length < 2)}
          disabled={pending}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink">Team size</legend>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Team size">
          {teamSizeOptions.map((option) => {
            const selected = size === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={pending}
                onClick={() => {
                  setSize(option.value);
                  setSaved(false);
                }}
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
      </fieldset>

      {error ? (
        <p className="rounded-control border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-success">Settings saved.</p>
      ) : null}

      <Button
        type="button"
        onClick={handleSave}
        disabled={pending}
        className="w-full sm:w-fit"
      >
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </Card>
  );
}
