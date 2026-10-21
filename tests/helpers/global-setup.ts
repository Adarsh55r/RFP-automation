import { execSync } from "node:child_process";

/**
 * Integration tests run against a disposable local Postgres named by
 * TEST_DATABASE_URL (never the production database). Without it, the
 * integration suites skip themselves.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  if (/neon\.tech|supabase\.co|vercel/i.test(url)) {
    throw new Error("TEST_DATABASE_URL must point at a local, disposable database.");
  }
  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
