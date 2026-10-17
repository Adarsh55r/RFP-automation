"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, LockOpen, MessageSquareHeart, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PLAN_COLORS } from "@/components/admin/badges";
import { useToast } from "@/components/ui/toast";
import { adminResetAllowance, adminResetReviewPrompt, adminSetPlan, adminUnlockAi } from "@/lib/actions/admin";
import { cn } from "@/lib/cn";

const PLANS = [
  { id: "free", label: "Free" },
  { id: "starter", label: "Starter" },
  { id: "growth", label: "Growth" },
  { id: "agency", label: "Team" },
];

function useAdminAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast({ title: success, variant: "success" });
        router.refresh();
      } else {
        toast({ title: "Couldn't complete that", description: result.error, variant: "error" });
      }
    });
  return { pending, run };
}

export function PlanSwitcher({ userId, tier }: { userId: string; tier: string }) {
  const [target, setTarget] = useState<string | null>(null);
  const { pending, run } = useAdminAction();
  const targetLabel = PLANS.find((plan) => plan.id === target)?.label;

  return (
    <div>
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-(--a-border) bg-white/[0.02] p-1" role="radiogroup" aria-label="Plan">
        {PLANS.map((plan) => {
          const current = plan.id === tier;
          const chosen = plan.id === (target ?? tier);
          return (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={current}
              disabled={pending}
              onClick={() => setTarget(current ? null : plan.id)}
              className={cn(
                "relative rounded-lg px-2 py-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--a-teal)/60 disabled:opacity-60",
                chosen ? "text-(--a-text)" : "text-(--a-text-2) hover:text-(--a-text)",
              )}
            >
              {chosen ? (
                <motion.span
                  layoutId="plan-switch"
                  className="absolute inset-0 rounded-lg ring-1"
                  style={{
                    background: `color-mix(in srgb, ${PLAN_COLORS[plan.id]} 20%, transparent)`,
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${PLAN_COLORS[plan.id]} 45%, transparent)`,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              ) : null}
              <span className="relative">{plan.label}</span>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {target ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-(--a-amber)/30 bg-(--a-amber)/[0.07] p-3 text-xs">
              <span className="text-(--a-text-2)">
                Move this account to <strong className="text-(--a-text)">{targetLabel}</strong>? Limits change immediately.
              </span>
              <span className="flex shrink-0 gap-2">
                <button type="button" onClick={() => setTarget(null)} className="rounded-lg px-2.5 py-1.5 text-(--a-text-2) hover:bg-white/10">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const result = await adminSetPlan(userId, target);
                      if (result.ok) setTarget(null);
                      return result;
                    }, `Moved to ${targetLabel}`)
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-(--a-teal) px-2.5 py-1.5 font-semibold text-[#04201b] transition hover:brightness-110 disabled:opacity-60"
                >
                  {pending ? <Loader2 className="size-3 animate-spin" /> : null}
                  Confirm
                </button>
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function UnlockAiButton({ userId, locked }: { userId: string; locked: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <button
      type="button"
      disabled={!locked || pending}
      onClick={() => run(() => adminUnlockAi(userId), "AI lock cleared")}
      className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--a-border) px-3 py-2.5 text-sm text-(--a-text-2) outline-none transition-all hover:border-(--a-teal)/40 hover:text-(--a-text) focus-visible:ring-2 focus-visible:ring-(--a-teal)/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-(--a-border)"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <LockOpen aria-hidden className="size-4 transition-transform group-hover:-rotate-12" />}
      {locked ? "Clear stuck AI lock" : "No AI task running"}
    </button>
  );
}

export function ResetAllowanceButton({ userId, rfpId, disabled }: { userId: string; rfpId: string; disabled?: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={(event) => {
        event.stopPropagation();
        run(() => adminResetAllowance(userId, rfpId), "Allowance reset for this proposal");
      }}
      title="Give this proposal its extractions, drafts and revisions back"
      className="group inline-flex items-center gap-1.5 rounded-lg border border-(--a-border) px-2.5 py-1.5 text-xs text-(--a-text-2) outline-none transition-all hover:border-(--a-teal)/40 hover:text-(--a-text) focus-visible:ring-2 focus-visible:ring-(--a-teal)/60 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw aria-hidden className="size-3 transition-transform duration-500 group-hover:-rotate-180" />}
      Reset
    </button>
  );
}

export function ResetReviewPromptButton({ userId, asked }: { userId: string; asked: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <button
      type="button"
      disabled={!asked || pending}
      onClick={() => run(() => adminResetReviewPrompt(userId), "Review request reset. It shows after their next export.")}
      className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-(--a-border) px-3 py-2.5 text-sm text-(--a-text-2) outline-none transition-all hover:border-(--a-teal)/40 hover:text-(--a-text) focus-visible:ring-2 focus-visible:ring-(--a-teal)/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-(--a-border)"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareHeart aria-hidden className="size-4 transition-transform group-hover:scale-110" />}
      {asked ? "Reset review request" : "Not asked yet"}
    </button>
  );
}
