#!/usr/bin/env node
/**
 * Restore test: compares a database restored from backup (for example a Neon
 * point-in-time branch) with the live one. Read-only on both; prints counts
 * and latest timestamps only, never row contents.
 *
 *   PRIMARY_DATABASE_URL=... RESTORE_DATABASE_URL=... node scripts/verify-restore.mjs
 */
import pg from "pg";

const TABLES = ["User", "Subscription", "Rfp", "Draft", "LibraryItem", "AiUsage", "ProposalUsage"];
const urls = { primary: process.env.PRIMARY_DATABASE_URL, restore: process.env.RESTORE_DATABASE_URL };
if (!urls.primary || !urls.restore) {
  console.error("Set PRIMARY_DATABASE_URL and RESTORE_DATABASE_URL.");
  process.exit(1);
}

async function snapshot(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = {};
    for (const table of TABLES) {
      const hasCreatedAt = table !== "Subscription";
      const { rows } = await client.query(
        `SELECT COUNT(*)::int AS count${hasCreatedAt ? `, MAX("createdAt") AS latest` : ""} FROM "${table}"`,
      );
      result[table] = rows[0];
    }
    return result;
  } finally {
    await client.end();
  }
}

const [primary, restore] = await Promise.all([snapshot(urls.primary), snapshot(urls.restore)]);
let problems = 0;
console.log("Table".padEnd(16), "Live".padStart(8), "Restored".padStart(10), "  Latest restored row");
for (const table of TABLES) {
  const live = primary[table];
  const restored = restore[table];
  const flag = restored.count === 0 && live.count > 0 ? "  <- empty in restore" : "";
  if (flag) problems += 1;
  console.log(table.padEnd(16), String(live.count).padStart(8), String(restored.count).padStart(10), " ", restored.latest?.toISOString?.() ?? "-", flag);
}
console.log(problems ? `\n${problems} table(s) look wrong in the restore.` : "\nRestore looks complete (counts differ only by activity since the restore point).");
process.exit(problems ? 1 : 0);
