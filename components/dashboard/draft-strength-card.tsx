import Link from "next/link";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { textLink } from "@/lib/focus";
import type { DraftStrength } from "@/lib/library-readiness";

const levelCopy = {
  weak: { label: "Weak", variant: "danger", text: "The draft will have little of your own material and many gaps." },
  fair: { label: "Fair", variant: "accent", text: "The draft can use some of your material; filling the gaps below will help." },
  strong: { label: "Strong", variant: "success", text: "Your library covers what this RFP asks for." },
} as const;

/** How much of the bidder's own material a draft for this RFP will have to work with. */
export function DraftStrengthCard({ strength }: { strength: DraftStrength }) {
  const copy = levelCopy[strength.level];
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">Draft strength</p>
          <p className="mt-1 text-sm text-slate">{copy.text}</p>
        </div>
        <Badge variant={copy.variant}>
          {copy.label} · {strength.score}/100
        </Badge>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {strength.checks.map((check) => (
          <li key={check.label} className="flex items-start gap-2">
            {check.ok ? (
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-label="Covered" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Missing" />
            )}
            <span className={cn(check.ok ? "text-slate" : "text-ink")}>
              {check.label}
              {!check.ok ? <span className="block text-xs text-slate">{check.fix}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {strength.level !== "strong" ? (
        <Link href="/dashboard/library" className={cn(textLink, "w-fit text-sm")}>
          Add to your library
        </Link>
      ) : null}
    </Card>
  );
}
