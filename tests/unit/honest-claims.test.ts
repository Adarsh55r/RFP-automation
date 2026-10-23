import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { plans, publicPlans } from "@/lib/plans";

/** Every file whose text a visitor or an AI crawler can read. */
function publicCopyFiles() {
  const roots = ["components/marketing", "components/auth", "app", "lib/site.ts", "lib/faqs.ts", "lib/plans.ts"];
  const files: string[] = [];
  const walk = (entry: string) => {
    if (statSync(entry).isDirectory()) {
      for (const child of readdirSync(entry)) {
        if (child === "admin" || child === "api") continue;
        walk(path.join(entry, child));
      }
    } else if (/\.(tsx?|md)$/.test(entry)) files.push(entry);
  };
  roots.forEach(walk);
  return files;
}

// Outcome promises the product cannot control, and a real municipality used in a mock.
const BANNED = [
  /win more rfps/i,
  /winning (proposal|bid)/i,
  /win rate/i,
  /bid team you can/i,
  /fifty-person/i,
  /everything a bid manager does/i,
  /maple grove/i,
  /trusted by/i,
];

describe("public claims stay honest", () => {
  it("no page promises outcomes or names a real buyer in an example", () => {
    const offenders: string[] = [];
    for (const file of publicCopyFiles()) {
      const text = readFileSync(file, "utf8");
      for (const pattern of BANNED) if (pattern.test(text)) offenders.push(`${file}: ${pattern}`);
    }
    expect(offenders).toEqual([]);
  });

  it("no plan a customer can buy lists an unshipped feature", () => {
    for (const plan of publicPlans) {
      for (const feature of plan.features) {
        expect(feature, `${plan.name}: ${feature}`).not.toMatch(/coming soon|roadmap|seat(s)? \(/i);
      }
    }
  });

  it("the unlimited plan is no longer sold but still exists for accounts already on it", () => {
    expect(publicPlans.some((plan) => plan.features.some((feature) => /unlimited proposals/i.test(feature)))).toBe(false);
    expect(plans.find((plan) => plan.id === "agency")?.visibility).toBe("retired");
  });
});
