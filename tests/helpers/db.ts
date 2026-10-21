import { PrismaClient } from "@/lib/generated/prisma";

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

export function testDb() {
  return (globalThis as unknown as { prisma: PrismaClient }).prisma;
}

export async function resetDb() {
  await testDb().$executeRawUnsafe(
    `TRUNCATE "AiUsage", "Draft", "LibraryItem", "Rfp", "Subscription", "User" RESTART IDENTITY CASCADE`,
  );
}

export async function createUser(clerkId: string, tier: "free" | "starter" | "growth" | "agency" = "starter") {
  return testDb().user.create({
    data: {
      clerkId,
      email: `${clerkId}@example.test`,
      agencyName: `${clerkId} Co`,
      subscription: { create: { tier, status: "active" } },
    },
  });
}
