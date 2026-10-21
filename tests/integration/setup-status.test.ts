import { describe, expect, it, vi } from "vitest";
import { hasTestDb } from "../helpers/db";

vi.mock("@/lib/supabase/admin", async () => await import("../helpers/fake-supabase"));

describe.skipIf(!hasTestDb)("admin setup status", () => {
  it("raises a red flag when the RFP storage bucket is public", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.local";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-not-real";
    const fake = await import("../helpers/fake-supabase");
    const { getSetupStatus } = await import("@/lib/setup-status");

    fake.bucketState.public = true;
    let check = (await getSetupStatus()).checks.find((c) => c.id === "bucket-privacy");
    expect(check?.state).toBe("invalid");

    fake.bucketState.public = false;
    check = (await getSetupStatus()).checks.find((c) => c.id === "bucket-privacy");
    expect(check?.state).toBe("on");
  });
});
