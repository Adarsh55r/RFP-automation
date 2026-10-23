"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteRfp } from "@/lib/actions/data-deletion";

/** Deletes one RFP after confirmation, then returns to the RFP list. */
export function DeleteRfpButton({ rfpId, title }: { rfpId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-fit text-danger">
          <Trash2 aria-hidden className="size-4" />
          Delete RFP
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{title}”?</DialogTitle>
          <DialogDescription>
            This permanently deletes the uploaded file, the extracted requirements and every draft
            for this RFP. It cannot be undone. Deleting does not give back the proposal it used on
            your plan this month.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await deleteRfp(rfpId);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
                router.replace("/dashboard/rfps");
              })
            }
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
