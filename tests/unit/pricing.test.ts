import { describe, expect, it } from "vitest";
import { computeAllowance, decideUpload } from "@/lib/entitlements";
import { gbpAvailable, isSellablePlan, PLANS, publicPlans, resolvePlan } from "@/lib/plans";

const DAY = 24 * 60 * 60 * 1000;

describe("plan config", () => {
  it("sells the free trial, single-bid pass, Starter and Pro, and hides the rest", () => {
    expect(publicPlans.map((plan) => plan.id)).toEqual(["free", "single_bid", "starter", "pro"]);
    expect(isSellablePlan("consultant")).toBe(false); // client workspaces not built
    expect(isSellablePlan("agency")).toBe(false); // retired unlimited plan
    expect(isSellablePlan("pilot")).toBe(true); // private link only, never on the pricing page
    expect(publicPlans.some((plan) => plan.id === "pilot")).toBe(false);
  });

  it("annual billing is two months free", () => {
    for (const id of ["starter", "pro"] as const) {
      const billing = PLANS[id].billing;
      if (billing.kind !== "subscription") throw new Error("expected a subscription");
      expect(billing.annual.usd).toBe(billing.monthly.usd * 10);
    }
  });

  it("matches the agreed prices and limits", () => {
    expect(PLANS.starter.billing).toMatchObject({ monthly: { usd: 99 }, annual: { usd: 990 } });
    expect(PLANS.pro.billing).toMatchObject({ monthly: { usd: 249 }, annual: { usd: 2490 } });
    expect(PLANS.single_bid.billing).toMatchObject({ price: { usd: 149 }, accessDays: 30 });
    expect([PLANS.free.proposals, PLANS.starter.proposals, PLANS.pro.proposals]).toEqual([
      { limit: 1, per: "lifetime" },
      { limit: 4, per: "month" },
      { limit: 12, per: "month" },
    ]);
    expect([PLANS.starter.overage?.usd, PLANS.pro.overage?.usd]).toEqual([29, 25]);
  });

  it("hides GBP until every public price has a confirmed GBP amount", () => {
    expect(gbpAvailable).toBe(false);
  });

  it("keeps grandfathered subscriptions on their original terms", () => {
    expect(resolvePlan({ tier: "starter", planVersion: "legacy" }).proposals).toEqual({ limit: 5, per: "month" });
    expect(resolvePlan({ tier: "free", planVersion: "legacy" }).proposals).toEqual({ limit: 1, per: "month" });
    expect(resolvePlan({ tier: "agency", planVersion: "legacy" }).proposals.limit).toBeNull();
    expect(resolvePlan({ tier: "starter", planVersion: "2026-10" }).proposals).toEqual({ limit: 4, per: "month" });
  });
});

describe("upload decisions", () => {
  const current = (tier: keyof typeof PLANS, extra: Record<string, unknown> = {}) => ({ tier, planVersion: "2026-10", ...extra });

  it("the free trial allows one proposal, ever", () => {
    expect(decideUpload(computeAllowance(current("free"), 0)).ok).toBe(true);
    const second = decideUpload(computeAllowance(current("free"), 1));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.status).toBe(403);
  });

  it("past the limit, Starter asks to confirm the exact price, then records it", () => {
    const allowance = computeAllowance(current("starter"), 4);
    const ask = decideUpload(allowance);
    expect(ask).toMatchObject({ ok: false, status: 402, overagePriceUsd: 29 });
    expect(decideUpload(allowance, 25).ok).toBe(false); // the wrong price is not consent
    expect(decideUpload(allowance, 29)).toEqual({ ok: true, overageCents: 2900 });
    expect(decideUpload(computeAllowance(current("starter"), 3))).toEqual({ ok: true, overageCents: null });
  });

  it("a single-bid pass allows one proposal while it is valid, and none after it ends", () => {
    const now = new Date();
    const valid = current("single_bid", { accessEndsAt: new Date(now.getTime() + 10 * DAY) });
    expect(decideUpload(computeAllowance(valid, 0, now)).ok).toBe(true);
    expect(decideUpload(computeAllowance(valid, 1, now)).ok).toBe(false);
    const ended = current("single_bid", { accessEndsAt: new Date(now.getTime() - DAY) });
    const decision = decideUpload(computeAllowance(ended, 0, now));
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.error).toMatch(/pass has ended/);
  });

  it("legacy Team stays unlimited for the accounts that have it", () => {
    expect(decideUpload(computeAllowance({ tier: "agency", planVersion: "legacy" }, 500)).ok).toBe(true);
  });
});
