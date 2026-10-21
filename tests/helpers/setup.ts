import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma";

// lib/db.ts reuses globalThis.prisma when present, so tests can point the app
// at a local Postgres through the plain pg driver instead of Neon's adapter.
const url = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ??= url ?? "postgresql://test:test@localhost:5432/unused";
if (url) {
  (globalThis as unknown as { prisma: PrismaClient }).prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
}
