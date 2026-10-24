import { describe, expect, it } from "vitest";
import { summarizeOutcomes } from "@/lib/outcomes";

const row = (outcome: string | null, extra: Partial<{ submittedAt: Date; contractValueCents: number; contractCurrency: string; hoursSaved: number }> = {}) => ({
  submittedAt: extra.submittedAt ?? null,
  outcome,
  contractValueCents: extra.contractValueCents ?? null,
  contractCurrency: extra.contractCurrency ?? null,
  hoursSaved: extra.hoursSaved ?? null,
});

describe("bid outcome summary", () => {
  it("counts results, win rate over decided bids only, value per currency and self-reported hours", () => {
    const summary = summarizeOutcomes([
      row("won", { contractValueCents: 12_000_000, contractCurrency: "USD", hoursSaved: 10 }),
      row("won", { contractValueCents: 5_000_000, contractCurrency: "GBP" }),
      row("lost", { hoursSaved: 6 }),
      row("pending", { submittedAt: new Date() }),
      row("withdrawn"),
      row(null, { submittedAt: new Date() }),
    ]);
    expect(summary).toMatchObject({ tracked: 6, submitted: 5, pending: 1, won: 2, lost: 1, hoursSavedTotal: 16, hoursReported: 2 });
    expect(summary.winRate).toBeCloseTo(2 / 3);
    expect(summary.wonValue).toEqual({ USD: 120_000, GBP: 50_000 });
  });

  it("shows no win rate until a bid is decided", () => {
    expect(summarizeOutcomes([row("pending")]).winRate).toBeNull();
    expect(summarizeOutcomes([]).tracked).toBe(0);
  });
});
