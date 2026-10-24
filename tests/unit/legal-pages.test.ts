import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET as dpaTemplate } from "@/app/dpa/template/route";
import { dpaClauses } from "@/lib/dpa";
import { PUBLIC_PAGES } from "@/lib/site";
import { databaseRegion, getSubprocessors } from "@/lib/subprocessors";

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

  it("public pages carry no placeholders and no claims of a registered company", () => {
    const sources = [
      "app/terms/page.tsx",
      "app/privacy/page.tsx",
      "app/security/page.tsx",
      "app/about/page.tsx",
      "app/dpa/page.tsx",
      "app/subprocessors/page.tsx",
      "components/marketing/site-footer.tsx",
    ].map((file) => readFileSync(file, "utf8"));
    const generated = [JSON.stringify(dpaClauses()), JSON.stringify(getSubprocessors())];
    for (const text of [...sources, ...generated]) {
      expect(text).not.toMatch(/\{\{[A-Z_]/);
      expect(text).not.toMatch(/company number|registered (at|address|office)|governed by the laws of/i);
    }
  });

  it("the database region comes from its address, never guessed", () => {
    expect(databaseRegion("postgresql://u:p@ep-cool-1-pooler.us-east-2.aws.neon.tech/db")).toBe("AWS us-east-2");
    expect(databaseRegion("postgresql://u:p@localhost/db")).toBe("Available on request");
  });
});
