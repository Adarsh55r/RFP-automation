import { describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: h.clerkId }), currentUser: async () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

describe.skipIf(!hasTestDb)("cover page details", () => {
  it("keep only what the bidder changed, so an old drafted value never sticks", async () => {
    await resetDb();
    const user = await createUser("cover-owner");
    const rfp = await testDb().rfp.create({
      data: {
        userId: user.id,
        title: "Managed IT",
        status: "drafted",
        draftPlan: {
          buyerName: "City of Harrison",
          projectTitle: "Managed IT Services",
          solicitationNumber: "",
          dueDate: "September 4, 2026",
          // A value saved by the old editor, which stored everything it showed.
          cover: { solicitationNumber: "RFP-2026-00123" },
        },
      },
    });
    h.clerkId = "cover-owner";
    const { saveCoverDetails } = await import("@/lib/actions/rfp-cover");
    const result = await saveCoverDetails({
      rfpId: rfp.id,
      cover: {
        projectTitle: "Managed IT Services", // unchanged from the draft
        buyerName: "City of Harrison", // unchanged
        solicitationNumber: "", // cleared by the bidder
        contactName: "Dana Whitfield", // typed by the bidder
        dueDate: "September 4, 2026",
      },
    });
    expect(result.ok).toBe(true);
    const saved = await testDb().rfp.findUniqueOrThrow({ where: { id: rfp.id } });
    expect((saved.draftPlan as { cover: object }).cover).toEqual({ contactName: "Dana Whitfield" });
  });
});
