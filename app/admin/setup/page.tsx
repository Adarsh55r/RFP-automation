import { AlertTriangle, CheckCircle2, CircleDashed, GitCommitHorizontal, Info, XCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/admin-shell";
import { SpotlightCard, Stagger } from "@/components/admin/spotlight-card";
import { CardHeader, Pill } from "@/components/admin/ui";
import { cn } from "@/lib/cn";
import { getSetupStatus, type CheckState, type SetupCheck } from "@/lib/setup-status";

const STATE_META: Record<CheckState, { label: string; icon: typeof CheckCircle2; tone: string }> = {
  on: { label: "On", icon: CheckCircle2, tone: "text-(--a-green) bg-(--a-green)/12 ring-(--a-green)/25" },
  missing: { label: "Missing", icon: XCircle, tone: "text-(--a-red) bg-(--a-red)/12 ring-(--a-red)/25" },
  invalid: { label: "Check value", icon: AlertTriangle, tone: "text-(--a-amber) bg-(--a-amber)/12 ring-(--a-amber)/25" },
  off: { label: "Off", icon: CircleDashed, tone: "text-(--a-text-2) bg-white/[0.05] ring-white/10" },
  info: { label: "Check Vercel", icon: Info, tone: "text-[#93c5fd] bg-[#3987e5]/15 ring-[#3987e5]/30" },
};

const GROUPS: { id: SetupCheck["group"]; description: string }[] = [
  { id: "Core", description: "Required for DraftBid AI to work at all" },
  { id: "Growth", description: "Features that help you sell and get reviews" },
  { id: "Monitoring", description: "So you hear about problems before customers do" },
];

function CheckRow({ check }: { check: SetupCheck }) {
  const meta = STATE_META[check.state];
  const Icon = meta.icon;
  return (
    <li className="flex gap-4 border-b border-(--a-border) py-4 last:border-0">
      <span className={cn("mt-0.5 inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium ring-1", meta.tone)}>
        <Icon aria-hidden className="size-3.5" />
        {meta.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium text-(--a-text)">{check.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-(--a-muted)">
            {check.required ? "Required" : "Optional"}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-(--a-text-2)">{check.detail}</p>
        {check.fix && check.state !== "on" ? (
          <p className="mt-1 text-xs text-(--a-muted)">
            <span className="text-(--a-teal)">How to fix:</span> {check.fix}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default async function AdminSetupPage() {
  const status = await getSetupStatus();
  const onCount = status.checks.filter((check) => check.state === "on").length;

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Setup status"
        description="What this deployment is running with. Values are never shown, only whether each setting is on. After you change a setting in Vercel, redeploy, then refresh this page."
        actions={
          <div className="flex flex-wrap gap-2">
            <Pill>
              <GitCommitHorizontal aria-hidden className="size-3.5" />
              {status.deployment.environment}
              {status.deployment.commit ? ` · ${status.deployment.commit}` : ""}
            </Pill>
            <Pill>
              {onCount} of {status.checks.length} on
            </Pill>
          </div>
        }
      />

      {status.blocking > 0 ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-(--a-red)/30 bg-(--a-red)/[0.07] p-4 text-sm">
          <XCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-(--a-red)" />
          <p className="text-(--a-text)">
            {status.blocking} required setting{status.blocking === 1 ? " is" : "s are"} missing or failing. Customers will hit errors
            until {status.blocking === 1 ? "it is" : "they are"} fixed.
          </p>
        </div>
      ) : (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-(--a-green)/25 bg-(--a-green)/[0.06] p-4 text-sm">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-(--a-green)" />
          <p className="text-(--a-text)">
            Everything DraftBid AI needs to run is on.
            {status.optionalOff > 0
              ? ` ${status.optionalOff} optional feature${status.optionalOff === 1 ? " is" : "s are"} off or need a fix below.`
              : ""}
          </p>
        </div>
      )}

      <Stagger className="grid gap-4 xl:grid-cols-3">
        {GROUPS.map((group) => (
          <SpotlightCard key={group.id} className="p-5" interactive={false}>
            <CardHeader title={group.id} description={group.description} />
            <ul>
              {status.checks
                .filter((check) => check.group === group.id)
                .map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
            </ul>
          </SpotlightCard>
        ))}
      </Stagger>
    </>
  );
}
