import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalRedirect } from "@/lib/canonical-host";
import { parsePlanId } from "@/lib/intended-plan";
import { GUIDES, guideVisible } from "@/lib/guides";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("one canonical host", () => {
  const url = (path: string) => new URL(`https://anything${path}`);
  it("redirects only the www/apex twin of the canonical host, keeping path and query, and only when enabled", () => {
    expect(canonicalRedirect(url("/pricing?seg=it-services"), "www.draftbidai.com", "https://draftbidai.com", true)).toBe(
      "https://draftbidai.com/pricing?seg=it-services",
    );
    expect(canonicalRedirect(url("/"), "draftbidai.com", "https://www.draftbidai.com", true)).toBe("https://www.draftbidai.com/");
    // Already canonical, a preview host, or switched off: no redirect (so no loop with Vercel's own redirect).
    expect(canonicalRedirect(url("/"), "draftbidai.com", "https://draftbidai.com", true)).toBeNull();
    expect(canonicalRedirect(url("/"), "draftbidai-git-x.vercel.app", "https://draftbidai.com", true)).toBeNull();
    expect(canonicalRedirect(url("/"), "www.draftbidai.com", "https://draftbidai.com", false)).toBeNull();
  });

  it("SITE_URL follows NEXT_PUBLIC_SITE_URL and ignores invalid values", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.draftbidai.com/");
    expect((await import("@/lib/site")).SITE_URL).toBe("https://www.draftbidai.com");
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://insecure.example");
    expect((await import("@/lib/site")).SITE_URL).toBe("https://draftbidai.com");
  });
});

describe("old sign-up links", () => {
  it("plan=agency (and team, growth) land on the closest current plan; unknown values are ignored", () => {
    expect(parsePlanId("agency")).toBe("pro");
    expect(parsePlanId("team")).toBe("pro");
    expect(parsePlanId("growth")).toBe("starter");
    expect(parsePlanId("starter")).toBe("starter");
    expect(parsePlanId("consultant")).toBeUndefined();
    expect(parsePlanId("nonsense")).toBeUndefined();
  });
});

describe("SEO guide templates", () => {
  it("exist for the brief's topics and every segment, and stay out of production until written", async () => {
    expect(GUIDES.map((guide) => guide.slug)).toEqual([
      "rfp-compliance-checklist",
      "how-to-respond-to-an-rfp-small-business",
      "proposal-template-from-your-portfolio",
      "draftbid-ai-vs-chatgpt-for-rfps",
      "rfp-checklist-it-services",
      "rfp-checklist-consultancies",
      "rfp-checklist-service-contractors",
    ]);
    for (const guide of GUIDES) {
      expect(guide.published).toBe(false);
      expect(guide.description.length).toBeLessThanOrEqual(170);
    }
    vi.stubEnv("VERCEL_ENV", "production");
    expect(guideVisible(GUIDES[0])).toBe(false);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(guideVisible(GUIDES[0])).toBe(true);
    const sitemap = (await import("@/app/sitemap")).default();
    expect(sitemap.some((entry) => entry.url.includes("/guides/"))).toBe(false);
  });
});
