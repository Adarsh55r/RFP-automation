"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TermsCheckbox } from "@/components/legal/terms-checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { acceptCurrentTerms } from "@/lib/actions/terms";
import { useAlert } from "@/components/ui/sweet-alert";

/** Shown in place of a dashboard page until the user accepts the current Terms version. */
export function AcceptTermsGate({ updated }: { updated: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const alert = useAlert();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-12">
      <Card className="flex flex-col gap-4">
        <p className="font-mono text-xs tracking-wide text-slate uppercase">One step before you continue</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {updated ? "We have updated our Terms" : "Please review our Terms"}
        </h1>
        <p className="text-sm leading-relaxed text-slate">
          They explain what DraftBid AI does and does not do, who is responsible for what you
          submit to buyers, and how your data is handled. Your RFPs and drafts are unchanged.
        </p>
        <TermsCheckbox checked={checked} onChange={setChecked} />
        <Button
          type="button"
          className="w-full sm:w-fit"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await acceptCurrentTerms(checked);
              if (!result.ok) {
                alert.warning("One more step", result.error);
                return;
              }
              router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Accept and continue"}
        </Button>
      </Card>
    </div>
  );
}
