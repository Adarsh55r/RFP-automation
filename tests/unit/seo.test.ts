import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as llmsTxt } from "@/app/llms.txt/route";
import { JsonLd } from "@/components/seo/json-ld";
import { faqs } from "@/lib/faqs";
import { plans, publicPlans } from "@/lib/plans";
import { faqStructuredData, homeStructuredData } from "@/lib/structured-data";

describe("search engine and AI crawler files", () => {
  it("robots.txt keeps signed-in areas out, points to the sitemap, and does not reveal the admin panel", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    for (const rule of rules) {
      expect(rule.disallow).toEqual(expect.arrayContaining(["/dashboard", "/onboarding", "/api/"]));
    }
    expect(JSON.stringify(result)).not.toContain("/admin");
    expect(result.sitemap).toBe("https://draftbidai.com/sitemap.xml");
    expect(rules.flatMap((rule) => [rule.userAgent].flat())).toEqual(expect.arrayContaining(["*", "GPTBot", "ClaudeBot", "PerplexityBot"]));
  });

  it("sitemap lists only public pages, on the main domain, with real dates", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(expect.arrayContaining(["https://draftbidai.com", "https://draftbidai.com/pricing", "https://draftbidai.com/privacy"]));
    for (const entry of sitemap()) {
      expect(entry.url.startsWith("https://draftbidai.com")).toBe(true);
      expect(entry.url).not.toMatch(/dashboard|admin|onboarding|api|sign-in/);
      expect(Number.isNaN(new Date(entry.lastModified as Date).getTime())).toBe(false);
    }
  });

  it("llms.txt describes the product with the same prices and FAQs as the site", async () => {
    const response = llmsTxt();
    expect(response.headers.get("content-type")).toContain("text/plain");
    const text = await response.text();
    expect(text.startsWith("# DraftBid AI")).toBe(true);
    for (const plan of publicPlans) expect(text).toContain(`${plan.name}: $${plan.monthly.usd}`);
    // A plan no longer sold must not be advertised to AI assistants.
    for (const plan of plans.filter((item) => item.retired)) expect(text).not.toContain(`${plan.name}: $`);
    for (const faq of faqs) expect(text).toContain(faq.question);
  });

  it("structured data matches the plans and FAQs, and cannot break out of its script tag", () => {
    const software = homeStructuredData()["@graph"].find((node) => node["@type"] === "SoftwareApplication") as {
      offers: { price: number }[];
    };
    expect(software.offers.map((offer) => offer.price)).toEqual(publicPlans.map((plan) => plan.monthly.usd));
    expect(faqStructuredData().mainEntity).toHaveLength(faqs.length);

    const element = JsonLd({ data: { text: "</script><script>alert(1)</script>" } });
    const html = (element.props as { dangerouslySetInnerHTML: { __html: string } }).dangerouslySetInnerHTML.__html;
    expect(html).not.toContain("<");
    expect(JSON.parse(html)).toEqual({ text: "</script><script>alert(1)</script>" });
  });
});
