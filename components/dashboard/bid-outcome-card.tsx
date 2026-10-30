"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateBidOutcome } from "@/lib/actions/outcomes";
import { CURRENCIES, OUTCOMES } from "@/lib/outcomes";
import { useAlert } from "@/components/ui/sweet-alert";

export type BidOutcomeValues = {
  submittedAt: string;
  outcome: string;
  contractValue: string;
  contractCurrency: string;
  notes: string;
  hoursSaved: string;
};

const labelClass = "flex flex-col gap-2 text-sm font-medium text-ink";

/** Where the bid went: submitted, won or lost, its value, and the user's own time-saved estimate. */
export function BidOutcomeCard({ rfpId, initial }: { rfpId: string; initial: BidOutcomeValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const alert = useAlert();
  const set = (key: keyof BidOutcomeValues) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateBidOutcome({
        rfpId,
        submittedAt: values.submittedAt || null,
        outcome: values.outcome || null,
        contractValue: values.contractValue || null,
        contractCurrency: values.contractCurrency || null,
        notes: values.notes || null,
        hoursSaved: values.hoursSaved || null,
      });
      if (result.ok) alert.success("Bid outcome saved");
      else alert.error("Couldn't save the outcome", result.error);
      if (result.ok) router.refresh();
    });
  };

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="font-sans text-lg font-semibold text-ink">Bid outcome</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate">
          Keep track of where this bid went. Only you see this; it feeds the summary on your dashboard.
        </p>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass} htmlFor="outcome-submitted">
            Submitted on
            <Input id="outcome-submitted" type="date" value={values.submittedAt} onChange={set("submittedAt")} disabled={pending} />
          </label>
          <label className={labelClass} htmlFor="outcome-result">
            Outcome
            <Select id="outcome-result" value={values.outcome} onChange={set("outcome")} disabled={pending}>
              <option value="">Not recorded</option>
              {Object.entries(OUTCOMES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <label className={labelClass} htmlFor="outcome-value">
            Contract value (optional)
            <div className="flex gap-2">
              <Input id="outcome-value" inputMode="decimal" value={values.contractValue} onChange={set("contractValue")} disabled={pending} />
              <div className="w-28 shrink-0">
                <Select aria-label="Currency" value={values.contractCurrency} onChange={set("contractCurrency")} disabled={pending}>
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </label>
          <label className={labelClass} htmlFor="outcome-hours">
            Hours saved, your estimate (optional)
            <Input id="outcome-hours" inputMode="decimal" value={values.hoursSaved} onChange={set("hoursSaved")} disabled={pending} />
          </label>
        </div>
        <label className={labelClass} htmlFor="outcome-notes">
          Notes (optional)
          <Textarea
            id="outcome-notes"
            rows={3}
            maxLength={2000}
            value={values.notes}
            onChange={set("notes")}
            placeholder="Feedback from the buyer, scores, what to do differently next time"
            disabled={pending}
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save outcome"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
