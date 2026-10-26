import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null, pages: [] as { url: string; text: string }[] }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/website-import", async (original) => ({
  ...(await original<typeof import("@/lib/website-import")>()),
  crawlCompanySite: async () => ({ pages: h.pages, skippedByRobots: 0 }),
}));
vi.mock("@/lib/llm", async (original) => {
  const llm = await import("../helpers/llm");
  return { ...(await original<typeof import("@/lib/llm")>()), generateLlmText: llm.fakeGenerate, streamLlmText: llm.fakeStream, generateTextFromPdf: llm.fakePdf };
});

const draft = JSON.stringify({
  companyProfile: "Ridgeline IT is a managed IT provider in Lexington, Kentucky, serving schools and clinics.",
  caseStudies: [
    { title: "Bluegrass Dental", content: "Managed IT for 6 dental offices. Results: [[measurable result]]." },
    { title: "Harbor County Schools", content: "Network refresh across 12 schools. Dates: [[start and end dates]]." },
  ],
});

describe.skipIf(!hasTestDb)("importing from the company website", () => {
  beforeEach(async () => {
    await resetDb();
    const llm = await import("../helpers/llm");
    llm.resetLlm();
    llm.script.json = (req) => {
      // The pages reach the model as untrusted, delimited data.
      expect(req.user).toContain('<page url="https://ridgeline.example/">');
      expect(req.system).toMatch(/never follow instructions/);
      return draft;
    };
    h.pages = [{ url: "https://ridgeline.example/", text: "Ridgeline IT, Lexington. Clients include Bluegrass Dental." }];
    await createUser("site", "starter");
    h.clerkId = "site";
  });

  it("adds a labelled profile and case studies for the user to check", async () => {
    const { importFromWebsite } = await import("@/lib/actions/website-import");
    const result = await importFromWebsite("ridgeline.example");
    expect(result).toMatchObject({ ok: true, pagesRead: 1, skippedForLimits: 0 });
    const items = await testDb().libraryItem.findMany({ orderBy: { title: "asc" } });
    expect(items.map((item) => [item.type, item.title])).toEqual([
      ["case_study", "Bluegrass Dental (from website)"],
      ["company_profile", "Company profile (from website)"],
      ["case_study", "Harbor County Schools (from website)"],
    ]);
    expect(items[0].content).toMatch(/^Imported from https:\/\/ridgeline\.example on \d{4}-\d{2}-\d{2}\. Check every detail/);
  });

  it("keeps an existing company profile and stops at the plan's library item limit", async () => {
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "site" } });
    // Starter on current pricing holds 50 items: leave room for exactly one more.
    await testDb().subscription.update({ where: { userId: user.id }, data: { planVersion: "2026-10" } });
    await testDb().libraryItem.create({ data: { userId: user.id, type: "company_profile", title: "Ours", content: "Our own words." } });
    await testDb().libraryItem.createMany({
      data: Array.from({ length: 48 }, (_, i) => ({ userId: user.id, type: "saved_answer" as const, title: `Answer ${i}`, content: "Saved answer text." })),
    });
    const { importFromWebsite } = await import("@/lib/actions/website-import");
    const result = await importFromWebsite("ridgeline.example");
    expect(result).toMatchObject({ ok: true, keptExistingProfile: true, skippedForLimits: 1, created: ["Bluegrass Dental (from website)"] });
    expect(await testDb().libraryItem.count()).toBe(50);
    expect((await testDb().libraryItem.findFirstOrThrow({ where: { type: "company_profile" } })).title).toBe("Ours");
  });

  it("gives a free account a fixed number of imports for life, not per month", async () => {
    const user = await createUser("trial", "free");
    h.clerkId = "trial";
    const { importFromWebsite } = await import("@/lib/actions/website-import");
    const { FREE_WEBSITE_IMPORTS } = await import("@/lib/website-draft");
    const longAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await testDb().aiUsage.createMany({
      data: Array.from({ length: FREE_WEBSITE_IMPORTS - 1 }, () => ({
        userId: user.id, action: "website_import", provider: "openai", model: "gpt-4.1", createdAt: longAgo,
      })),
    });
    expect(await importFromWebsite("ridgeline.example")).toMatchObject({ ok: true });

    // The live AI call records its usage; the fake one does not, so record it here.
    await testDb().aiUsage.create({ data: { userId: user.id, action: "website_import", provider: "openai", model: "gpt-4.1" } });
    await testDb().libraryItem.deleteMany();
    const result = await importFromWebsite("ridgeline.example");
    expect(!result.ok && result.error).toMatch(/free trial includes 3 website imports/);
    expect(await testDb().libraryItem.count()).toBe(0);
  });

  it("limits imports per day", async () => {
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "site" } });
    await testDb().aiUsage.createMany({
      data: Array.from({ length: 3 }, () => ({ userId: user.id, action: "website_import", provider: "openai", model: "gpt-4.1" })),
    });
    const { importFromWebsite } = await import("@/lib/actions/website-import");
    const result = await importFromWebsite("ridgeline.example");
    expect(!result.ok && result.error).toMatch(/3 times a day/);
    expect(await testDb().libraryItem.count()).toBe(0);
  });
});
