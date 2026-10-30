"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useAlert } from "@/components/ui/sweet-alert";
import { deleteRfp } from "@/lib/actions/data-deletion";

/** Deletes one RFP after confirmation, then returns to the RFP list. */
export function DeleteRfpButton({ rfpId, title }: { rfpId: string; title: string }) {
  const router = useRouter();
  const alert = useAlert();
  const [pending, startTransition] = useTransition();

  const remove = async () => {
    const confirmed = await alert.confirm({
      title: `Delete “${title}”?`,
      text: "This permanently deletes the uploaded file, the extracted requirements and every draft for this RFP. It cannot be undone. Deleting does not give back the proposal it used on your plan.",
      confirmLabel: "Delete permanently",
      destructive: true,
    });
    if (!confirmed) return;
    startTransition(async () => {
      const result = await deleteRfp(rfpId);
      if (!result.ok) {
        alert.error("Couldn't delete the RFP", result.error);
        return;
      }
      alert.success("RFP deleted");
      router.replace("/dashboard/rfps");
    });
  };

  return (
    <Button type="button" variant="ghost" size="sm" className="w-fit text-danger" disabled={pending} onClick={remove}>
      <Trash2 aria-hidden className="size-4" />
      {pending ? "Deleting…" : "Delete RFP"}
    </Button>
  );
}
