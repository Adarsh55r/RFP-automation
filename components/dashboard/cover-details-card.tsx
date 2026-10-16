"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown } from "lucide-react";
import { saveCoverDetails } from "@/lib/actions/rfp-cover";
import type { CoverDetails } from "@/lib/rfp-draft";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

const fields: { key: keyof CoverDetails; label: string; placeholder: string; wide?: boolean }[] = [
  { key: "projectTitle", label: "Proposal title", placeholder: "e.g. Managed IT Services for the City of Maple Grove", wide: true },
  { key: "solicitationNumber", label: "Solicitation / tender number", placeholder: "e.g. RFP 2026-IT-041" },
  { key: "dueDate", label: "Response due", placeholder: "e.g. October 30, 2026, 2:00 PM CST" },
  { key: "buyerName", label: "Prepared for (buyer)", placeholder: "e.g. City of Maple Grove" },
  { key: "buyerAddress", label: "Buyer address", placeholder: "e.g. 12800 Arbor Lakes Pkwy, Maple Grove, MN 55369" },
  { key: "bidderName", label: "Your company's legal name", placeholder: "e.g. Northbeam Digital LLC" },
  { key: "contactName", label: "Contact name", placeholder: "e.g. Jordan Lee" },
  { key: "contactTitle", label: "Contact title", placeholder: "e.g. Managing Director" },
  { key: "contactEmail", label: "Contact email", placeholder: "e.g. bids@northbeam.com" },
  { key: "contactPhone", label: "Contact phone", placeholder: "e.g. +1 612 555 0100" },
];

export function CoverDetailsCard({
  rfpId,
  initialCover,
}: {
  rfpId: string;
  initialCover: CoverDetails;
}) {
  const missingContact = !initialCover.contactName || !initialCover.contactEmail;
  const [open, setOpen] = useState(missingContact);
  const [cover, setCover] = useState(initialCover);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveCoverDetails({ rfpId, cover });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    });
  };

  return (
    <Card className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cn("flex w-full items-start justify-between gap-4 text-left", focusRing)}
      >
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">Cover page</p>
          <h2 className="mt-2 font-sans text-lg font-semibold text-ink">Cover page details</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            {missingContact
              ? "Add your contact details so the cover page and header look finished. We filled in what we found in the RFP."
              : "What prints on the cover page and in the running header of your Word and PDF exports."}
          </p>
        </div>
        <ChevronDown
          className={cn("mt-1 h-5 w-5 shrink-0 text-slate transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <label
                key={field.key}
                className={cn("flex flex-col gap-1.5", field.wide && "sm:col-span-2")}
              >
                <span className="text-sm font-medium text-ink">{field.label}</span>
                <Input
                  value={cover[field.key]}
                  placeholder={field.placeholder}
                  maxLength={500}
                  onChange={(event) =>
                    setCover((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save cover details"}
            </Button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-sm text-success" aria-live="polite">
                <Check className="h-4 w-4" aria-hidden />
                Saved
              </span>
            ) : null}
            {error ? <span className="text-sm text-danger">{error}</span> : null}
          </div>
        </form>
      ) : null}
    </Card>
  );
}
