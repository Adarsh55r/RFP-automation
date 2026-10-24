import { describe, expect, it } from "vitest";
import { PUBLIC_PAGES } from "@/lib/site";
import { SEGMENTS } from "@/lib/segments";
import { libraryTemplates } from "@/lib/library-templates";

describe("segment landing pages", () => {
  it("has the four segments from the brief, each complete", () => {
    expect(SEGMENTS.map((segment) => segment.slug)).toEqual(["it-services", "consultancies", "service-contractors", "consultants"]);
    for (const segment of SEGMENTS) {
      expect(segment.pains.length, segment.slug).toBeGreaterThanOrEqual(3);
      expect(segment.pains.length, segment.slug).toBeLessThanOrEqual(5);
      expect(segment.checklistCatches.length).toBeGreaterThan(0);
      expect(segment.uploadFirst.length).toBeGreaterThan(0);
      expect(segment.description.length).toBeLessThanOrEqual(170);
      if (segment.templateSet) expect(libraryTemplates.some((t) => t.segment === segment.templateSet)).toBe(true);
    }
  });

  it("makes no outcome promises and no unshipped claims", () => {
    const text = JSON.stringify(SEGMENTS);
    expect(text).not.toMatch(/win more|winning|guarantee[sd]? (a|an|your|to|that)\b|save \d|\d+% (faster|more)|hours saved|trusted by/i);
    // Client workspaces are not built, so the consultants page must not offer them.
    expect(text).not.toMatch(/client workspaces?/i);
    // Sample outputs stay empty until real ones are supplied.
    expect(SEGMENTS.every((segment) => segment.sampleOutput === null)).toBe(true);
  });

  it("every segment and use-case page is in the sitemap", () => {
    const paths = PUBLIC_PAGES.map((page) => page.path as string);
    for (const segment of SEGMENTS) expect(paths).toContain(`/for/${segment.slug}`);
    expect(paths).toEqual(expect.arrayContaining(["/use-cases/uk-tenders", "/use-cases/security-questionnaires"]));
  });
});
