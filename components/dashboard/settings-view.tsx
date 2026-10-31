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
import { useAlert } from "@/components/ui/sweet-alert";

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
  const alert = useAlert();
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Enter your company’s legal or trading name (at least 2 characters).");
      return;
    }
    if (!size) {
      setError("Pick a team size so we can size your workspace.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await updateAgencySettings({
        agencyName: trimmed,
        teamSize: size,
      });
      if (!result.ok) {
        alert.error("Couldn't save your settings", result.error);
        return;
      }
      alert.success("Settings saved");
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
          Company name
        </label>
        <Input
          id="settings-agency"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
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
                }}
                className={cn(
                  "rounded-card border px-4 py-4 text-left transition-all duration-200 ease-out",
                  selected
                    ? "border-brand bg-brand/10 shadow-[0_0_0_4px_rgb(var(--glow)/0.12)]"
                    : "border-border bg-surface-raised hover:-translate-y-0.5 hover:border-brand/40",
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

      {error ? <p className="text-sm text-danger">{error}</p> : null}

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
