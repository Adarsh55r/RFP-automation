import { describe, expect, it } from "vitest";
import config from "@/next.config";

describe("security headers", () => {
  it("are applied to every route", async () => {
    const rules = await config.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    const keys = all?.headers.map((h) => h.key) ?? [];
    for (const key of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Strict-Transport-Security"]) {
      expect(keys).toContain(key);
    }
    expect(config.poweredByHeader).toBe(false);
  });
});
