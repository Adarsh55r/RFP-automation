import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { textLink } from "@/lib/focus";
import { groupKeyDetails, type KeyDetail } from "@/lib/key-details";

const kindBadge = {
  mandatory: { label: "Must", variant: "danger" },
  scored: { label: "Scored", variant: "accent" },
  info: null,
} as const;

/**
 * Key details found in the solicitation, by category, each with the page its
 * wording was found on. A detail whose wording could not be found in the
 * document is labelled "Check".
 */
export function KeyDetailsCard({ rfpId, details }: { rfpId: string; details: KeyDetail[] }) {
  const groups = groupKeyDetails(details);
  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Key details</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate">
          Limits, forms, deadlines and terms found in the document. Page numbers come from finding each
          detail&apos;s wording in the file; anything marked “Check” could not be matched, so confirm it yourself.
        </p>
      </div>
      <dl className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.category} className="flex flex-col gap-2">
            <dt className="font-mono text-xs tracking-wide text-slate uppercase">{group.label}</dt>
            {group.items.map((item, index) => {
              const kind = kindBadge[item.kind];
              return (
                <dd key={index} className="flex flex-wrap items-baseline gap-2 text-sm text-ink">
                  {kind ? <Badge variant={kind.variant}>{kind.label}</Badge> : null}
                  <span className="min-w-0 flex-1">{item.detail}</span>
                  {item.page ? (
                    <a
                      href={`/api/rfps/${rfpId}/file#page=${item.page}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.quote ? `“${item.quote}”` : undefined}
                      className={cn(textLink, "font-mono text-xs whitespace-nowrap")}
                    >
                      p. {item.page}
                    </a>
                  ) : null}
                  {!item.verified ? (
                    <Badge variant="draft" title="The wording could not be found in the document">
                      Check
                    </Badge>
                  ) : null}
                </dd>
              );
            })}
          </div>
        ))}
      </dl>
    </Card>
  );
}
