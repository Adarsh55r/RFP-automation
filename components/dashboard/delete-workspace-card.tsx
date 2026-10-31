"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteWorkspace } from "@/lib/actions/data-deletion";
import { DELETE_WORKSPACE_CONFIRMATION } from "@/lib/data-deletion";
import { useAlert } from "@/components/ui/sweet-alert";

/** Settings danger zone: deletes all workspace data, then signs out. */
export function DeleteWorkspaceCard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [confirmation, setConfirmation] = useState("");
  const alert = useAlert();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="flex flex-col gap-4 border-danger/30">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Delete workspace</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate">
          Permanently deletes every uploaded RFP file, extracted requirement, draft and library
          item, and your plan details. It cannot be undone. Export anything you need first. Your
          sign-in stays; you can remove it from the account menu afterwards.
        </p>
      </div>
      <label htmlFor="delete-workspace" className="text-sm font-medium text-ink">
        Type {DELETE_WORKSPACE_CONFIRMATION} to confirm
      </label>
      <Input
        id="delete-workspace"
        value={confirmation}
        autoComplete="off"
        onChange={(event) => setConfirmation(event.target.value)}
      />
      <Button
        type="button"
        variant="danger"
        className="w-full sm:w-fit"
        disabled={pending || confirmation.trim() !== DELETE_WORKSPACE_CONFIRMATION}
        onClick={() =>
          startTransition(async () => {
            const result = await deleteWorkspace(confirmation);
            if (!result.ok) {
              alert.error("Couldn't delete the workspace", result.error);
              return;
            }
            // Stop the onboarding page from quietly rebuilding the workspace from saved sign-up data.
            await user?.update({ unsafeMetadata: { ...user.unsafeMetadata, onboardingCompleted: false } }).catch(() => undefined);
            await signOut({ redirectUrl: "/" });
          })
        }
      >
        {pending ? "Deleting…" : "Delete workspace permanently"}
      </Button>
    </Card>
  );
}
