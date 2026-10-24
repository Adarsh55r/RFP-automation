import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUser, hasTestDb, resetDb, testDb } from "../helpers/db";

const h = vi.hoisted(() => ({ clerkId: null as string | null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.clerkId }),
  currentUser: async () =>
    h.clerkId ? { primaryEmailAddress: { emailAddress: `${h.clerkId}@example.test` }, emailAddresses: [] } : null,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

describe.skipIf(!hasTestDb)("Terms of Service acceptance", () => {
  beforeEach(async () => {
    await resetDb();
    h.clerkId = "newcomer";
  });

  it("onboarding refuses to create a workspace until the Terms are accepted", async () => {
    const { completeOnboarding } = await import("@/lib/actions/onboarding");
    const refused = await completeOnboarding({ agencyName: "Acme Co", teamSize: "1-10", acceptTerms: false });
    expect(refused.ok).toBe(false);
    expect(await testDb().user.count()).toBe(0);
  });

  it("records the accepted Terms version and time at onboarding", async () => {
    const { completeOnboarding } = await import("@/lib/actions/onboarding");
    const { TERMS_VERSION } = await import("@/lib/legal");
    const before = Date.now();
    expect((await completeOnboarding({ agencyName: "Acme Co", teamSize: "1-10", acceptTerms: true })).ok).toBe(true);
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "newcomer" } });
    expect(user.termsVersion).toBe(TERMS_VERSION);
    expect(user.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("repairing a missing workspace does not count as acceptance", async () => {
    const { saveOnboarding } = await import("@/lib/onboarding-store");
    expect((await saveOnboarding({ agencyName: "Acme Co", teamSize: "1-10" }, false)).ok).toBe(true);
    const user = await testDb().user.findUniqueOrThrow({ where: { clerkId: "newcomer" } });
    expect(user.termsVersion).toBeNull();
    expect(user.termsAcceptedAt).toBeNull();
  });

  it("existing users see the acceptance screen until they accept the current version", async () => {
    await createUser("veteran");
    h.clerkId = "veteran";
    const { default: DashboardLayout } = await import("@/app/dashboard/layout");
    const { AcceptTermsGate } = await import("@/components/dashboard/accept-terms-gate");
    const child = "dashboard-content";

    const gated = await DashboardLayout({ children: child });
    expect(gated.props.children.type).toBe(AcceptTermsGate);

    const { acceptCurrentTerms } = await import("@/lib/actions/terms");
    expect((await acceptCurrentTerms(false)).ok).toBe(false);
    expect((await acceptCurrentTerms(true)).ok).toBe(true);

    const open = await DashboardLayout({ children: child });
    expect(open.props.children).toBe(child);
  });
});
