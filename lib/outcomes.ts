/**
 * Bid outcomes the user records for each RFP, and a summary of them for
 * their own dashboard. These are the user's numbers about their own bids;
 * they are never published or used in marketing.
 */

export const OUTCOMES = {
  pending: "Waiting for a decision",
  won: "Won",
  lost: "Lost",
  no_decision: "Cancelled or no award",
  withdrawn: "We did not submit",
} as const;

export type Outcome = keyof typeof OUTCOMES;

export const CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD"] as const;

export const isOutcome = (value: unknown): value is Outcome => typeof value === "string" && Object.hasOwn(OUTCOMES, value);

type OutcomeRow = {
  submittedAt: Date | null;
  outcome: string | null;
  contractValueCents: number | null;
  contractCurrency: string | null;
  hoursSaved: number | null;
};

export function summarizeOutcomes(rows: OutcomeRow[]) {
  const submitted = rows.filter((row) => row.submittedAt || (row.outcome && row.outcome !== "withdrawn"));
  const won = rows.filter((row) => row.outcome === "won");
  const lost = rows.filter((row) => row.outcome === "lost");
  const decided = won.length + lost.length;
  const wonValue: Record<string, number> = {};
  for (const row of won) {
    if (row.contractValueCents && row.contractCurrency) {
      wonValue[row.contractCurrency] = (wonValue[row.contractCurrency] ?? 0) + row.contractValueCents / 100;
    }
  }
  const hours = rows.map((row) => row.hoursSaved).filter((value): value is number => typeof value === "number");
  return {
    tracked: rows.filter((row) => row.submittedAt || row.outcome).length,
    submitted: submitted.length,
    pending: rows.filter((row) => row.outcome === "pending").length,
    won: won.length,
    lost: lost.length,
    /** Only shown once there are decided bids; based on won ÷ (won + lost). */
    winRate: decided > 0 ? won.length / decided : null,
    wonValue,
    hoursSavedTotal: hours.length > 0 ? hours.reduce((sum, value) => sum + value, 0) : null,
    hoursReported: hours.length,
  };
}
