import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkId }),
  currentUser: async () => null,
}));
vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));

const FILE = "https://fake.supabase.local/storage/v1/object/public/rfp-uploads/a/r/file.pdf";
const SECRET_TEXT = "FULL-DOCUMENT-TEXT ".repeat(2000);

describe.skipIf(!hasTestDb)("dashboard data loading", () => {
  let aliceRfpId = "";

  beforeEach(async () => {
    await resetDb();
    const alice = await createUser("alice");
    const bob = await createUser("bob");
    const rfp = await testDb().rfp.create({
      data: { userId: alice.id, title: "Alice drafting", status: "drafting", originalFileUrl: FILE, sourceText: SECRET_TEXT },
    });
    aliceRfpId = rfp.id;
    await testDb().rfp.create({ data: { userId: alice.id, title: "Alice uploaded", originalFileUrl: FILE } });
    // A large upload that never finished: no file, so it must not show or count.
    await testDb().rfp.create({ data: { userId: alice.id, title: "Alice abandoned" } });
    await testDb().rfp.create({ data: { userId: bob.id, title: "Bob drafting", status: "drafting", originalFileUrl: FILE } });
    // A finished upload records one use of the plan (as completeRfpUpload does); abandoned ones do not.
    for (const finished of await testDb().rfp.findMany({ where: { originalFileUrl: { not: null } } })) {
      await testDb().proposalUsage.create({ data: { userId: finished.userId, rfpId: finished.id } });
    }
    await testDb().libraryItem.create({ data: { userId: alice.id, type: "case_study", title: "Alice case", content: "Alice results here" } });
    await testDb().libraryItem.create({ data: { userId: bob.id, type: "case_study", title: "Bob case", content: "Bob results here" } });
    h.clerkId = "alice";
  });

  it("dashboard home counts only the signed-in user's finished uploads", async () => {
    const { getDashboardHomeData } = await import("@/lib/dashboard");
    const data = await getDashboardHomeData();
    expect(data?.agencyName).toBe("alice Co");
    expect(data?.stats.rfpsThisMonth).toBe(2);
    expect(data?.stats.draftsInProgress).toBe(1);
    expect(data?.recentRfps.map((rfp) => rfp.title).sort()).toEqual(["Alice drafting", "Alice uploaded"]);
  });

  it("dashboard home returns nothing for a signed-in user who has not finished onboarding", async () => {
    h.clerkId = "stranger";
    const { getDashboardHomeData } = await import("@/lib/dashboard");
    expect(await getDashboardHomeData()).toBeNull();
  });

  it("RFP list and library load by Clerk ID without leaking other users' rows", async () => {
    const { getRfpsForClerkUser } = await import("@/lib/rfps");
    const { getLibraryItemsForClerkUser } = await import("@/lib/library-data");
    expect((await getRfpsForClerkUser("alice")).map((rfp) => rfp.title).sort()).toEqual(["Alice drafting", "Alice uploaded"]);
    expect((await getRfpsForClerkUser("nobody"))).toEqual([]);
    expect((await getLibraryItemsForClerkUser("alice")).map((item) => item.title)).toEqual(["Alice case"]);
  });

  it("RFP pages never load or send the full document text", async () => {
    const { getRfpForUser } = await import("@/lib/rfps");
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "alice" } });
    const rfp = await getRfpForUser(aliceRfpId, user.id);
    expect(rfp?.title).toBe("Alice drafting");
    expect(rfp).not.toHaveProperty("sourceText");

    const { default: RfpDetailPage } = await import("@/app/dashboard/rfps/[id]/page");
    const page = await RfpDetailPage({ params: Promise.resolve({ id: aliceRfpId }) });
    const sent = propsTextOf(page);
    expect(sent).toContain("Alice drafting");
    expect(sent).not.toContain("FULL-DOCUMENT-TEXT");
  });
});

/** Every value passed as a prop anywhere in a rendered element tree, as text. */
function propsTextOf(node: unknown, seen = new Set<unknown>()): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  if (seen.has(node)) return "";
  seen.add(node);
  if (Array.isArray(node)) return node.map((child) => propsTextOf(child, seen)).join(" ");
  if (node instanceof Date) return node.toISOString();
  const props = (node as { props?: Record<string, unknown> }).props;
  const values = props ? Object.values(props) : Object.values(node as Record<string, unknown>);
  return values.map((value) => propsTextOf(value, seen)).join(" ");
}
