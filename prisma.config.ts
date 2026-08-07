import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config({ path: ".env" });

const datasourceUrl =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!datasourceUrl) {
  // Allow `prisma generate` without a live Neon URL; migrate still needs one.
  console.warn(
    "[prisma.config] DATABASE_URL (or DIRECT_URL) is not set. Migrations will fail until you add your Neon connection string to .env.local.",
  );
}

/**
 * Prisma CLI (migrate / generate) prefers DIRECT_URL (non-pooled Neon).
 * App queries use DATABASE_URL via the Neon adapter in `lib/db.ts`.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      datasourceUrl ||
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
