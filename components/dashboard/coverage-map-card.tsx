import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SkeletonText } from "@/components/ui/skeleton";
import { coverageStatusTone, parseCoverageTable } from "@/lib/coverage-map";

export function CoverageMapCard({
  markdown,
  streaming,
}: {
  markdown: string;
  streaming?: boolean;
}) {
  const rows = parseCoverageTable(markdown);
  const gapCount = rows.filter((row) =>
    row.status.toLowerCase().includes("gap"),
  ).length;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-slate uppercase">
            Before you send
          </p>
          <h2 className="mt-2 font-sans text-lg font-semibold text-ink">
            Coverage map
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            Every extracted criterion, mapped to a draft section. Gaps need
            agency input before export. This table is not included in the Word
            file.
          </p>
        </div>
        {gapCount > 0 ? (
          <Badge variant="danger" className="w-fit">
            {gapCount} gap{gapCount === 1 ? "" : "s"}
          </Badge>
        ) : rows.length > 0 ? (
          <Badge variant="success" className="w-fit">
            Criteria mapped
          </Badge>
        ) : null}
      </div>

      {streaming && !markdown ? <SkeletonText lines={4} /> : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-sans font-semibold text-ink">
                  Requirement
                </th>
                <th className="py-2 pr-4 font-sans font-semibold text-ink">
                  Type
                </th>
                <th className="py-2 pr-4 font-sans font-semibold text-ink">
                  Addressed in
                </th>
                <th className="py-2 font-sans font-semibold text-ink">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.requirement}-${row.type}`} className="border-b border-border last:border-b-0">
                  <td className="py-3 pr-4 text-ink">{row.requirement}</td>
                  <td className="py-3 pr-4 font-mono text-xs tracking-wide text-slate uppercase">
                    {row.type}
                  </td>
                  <td className="py-3 pr-4 text-slate">{row.addressedIn}</td>
                  <td className="py-3">
                    <Badge variant={coverageStatusTone(row.status)}>
                      {row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : markdown.trim() && !streaming ? (
        <pre className="overflow-x-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">
          {markdown}
        </pre>
      ) : null}
    </Card>
  );
}
