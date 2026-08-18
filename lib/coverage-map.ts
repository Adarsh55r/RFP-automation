export type CoverageRow = {
  requirement: string;
  type: string;
  addressedIn: string;
  status: string;
};

export function parseCoverageTable(markdown: string): CoverageRow[] {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));

  const rows: CoverageRow[] = [];

  for (const line of lines) {
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    const heading = cells.join(" ").toLowerCase();
    if (heading.includes("requirement") && heading.includes("status")) continue;

    rows.push({
      requirement: cells[0] ?? "",
      type: cells[1] ?? "",
      addressedIn: cells[2] ?? "",
      status: cells[3] ?? "",
    });
  }

  return rows.filter((row) => row.requirement);
}

export function coverageStatusTone(status: string) {
  const value = status.toLowerCase();
  if (value.includes("gap")) return "danger" as const;
  if (value.includes("partial")) return "accent" as const;
  if (value.includes("address")) return "success" as const;
  return "draft" as const;
}
