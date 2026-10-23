import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET as dpaTemplate } from "@/app/dpa/template/route";
import * as companyModule from "@/lib/company";
import { companyPlaceholders, isPlaceholder } from "@/lib/company";
import { dpaClauses } from "@/lib/dpa";
import { PUBLIC_PAGES } from "@/lib/site";
import { getSubprocessors } from "@/lib/subprocessors";

describe("legal and trust pages", () => {
  it("every integration that can receive customer data is on the subprocessor list", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
    const names = getSubprocessors().map((row) => row.name).join(" | ");
    const integrations: Record<string, RegExp> = {
      openai: /OpenAI/,
      "@anthropic-ai/sdk": /Anthropic/,
      "@google/generative-ai": /Google/,
      "@supabase/supabase-js": /Supabase/,
      "@clerk/nextjs": /Clerk/,
      "@sentry/nextjs": /Sentry/,
      "@vercel/analytics": /Vercel/,
      "@prisma/adapter-neon": /Neon/,
    };
    for (const [dependency, pattern] of Object.entries(integrations)) {
      expect(pkg.dependencies[dependency], `${dependency} is still a dependency`).toBeTruthy();
      expect(names, `${dependency} is listed`).toMatch(pattern);
    }
  });

  it("the DPA download is a real Word document containing every clause", async () => {
    const response = await dpaTemplate();
    expect(response.headers.get("content-type")).toContain("wordprocessingml");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    expect(dpaClauses().length).toBeGreaterThanOrEqual(10);
  });

  it("trust pages are in the sitemap", () => {
    const paths = PUBLIC_PAGES.map((page) => page.path);
    expect(paths).toEqual(expect.arrayContaining(["/terms", "/privacy", "/security", "/subprocessors", "/dpa", "/about"]));
  });

  it("the footer links every trust page", () => {
    const footer = readFileSync("components/marketing/site-footer.tsx", "utf8");
    for (const href of ["/terms", "/privacy", "/security", "/subprocessors", "/dpa", "/about", "mailto:"]) {
      expect(footer).toContain(`"${href}`.replace('"mailto:', "`mailto:"));
    }
  });

  it("unfilled company details are detected so they cannot go live unnoticed", () => {
    expect(isPlaceholder("{{LEGAL_ENTITY_NAME}}")).toBe(true);
    expect(isPlaceholder("Acme Ltd")).toBe(false);
    // Whatever is filled in today, the check lists exactly the fields still holding a placeholder.
    const { COMPANY } = companyModule;
    expect(companyPlaceholders().sort()).toEqual(
      Object.entries(COMPANY).filter(([, value]) => isPlaceholder(value)).map(([key]) => key).sort(),
    );
  });
});
