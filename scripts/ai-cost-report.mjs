#!/usr/bin/env node
/**
 * AI cost per proposal, from the AiUsage table. Read-only; prints no document
 * content (the table holds none).
 *
 *   DATABASE_URL=postgresql://... node scripts/ai-cost-report.mjs [--days 30]
 */
import pg from "pg";

const daysArg = process.argv.indexOf("--days");
const days = daysArg > -1 ? Number(process.argv[daysArg + 1]) : 30;
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL (a read-only connection string is enough).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const usd = (value) => (value === null || value === undefined ? "n/a" : `$${Number(value).toFixed(3)}`);

try {
  const { rows: [perProposal] } = await client.query(
    `SELECT COUNT(*)::int AS proposals, AVG(cost) AS avg,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY cost) AS p50,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY cost) AS p95, MAX(cost) AS max
       FROM (SELECT "rfpId", SUM("costMicros") / 1e6 AS cost FROM "AiUsage"
              WHERE "createdAt" >= $1 AND "rfpId" IS NOT NULL GROUP BY "rfpId") t`,
    [since],
  );
  const { rows: byStep } = await client.query(
    `SELECT action, COUNT(*)::int AS calls, AVG("costMicros") / 1e6 AS avg_call,
            AVG("inputTokens")::int AS avg_in, AVG("outputTokens")::int AS avg_out
       FROM "AiUsage" WHERE "createdAt" >= $1 GROUP BY action ORDER BY action`,
    [since],
  );
  const { rows: byModel } = await client.query(
    `SELECT model, COUNT(*)::int AS calls, SUM("costMicros") / 1e6 AS total
       FROM "AiUsage" WHERE "createdAt" >= $1 GROUP BY model ORDER BY total DESC`,
    [since],
  );

  console.log(`AI cost report, last ${days} days (since ${since.toISOString().slice(0, 10)})\n`);
  console.log(`Proposals: ${perProposal.proposals}`);
  console.log(`Per proposal: average ${usd(perProposal.avg)} · median ${usd(perProposal.p50)} · p95 ${usd(perProposal.p95)} · max ${usd(perProposal.max)}\n`);
  console.log("By pipeline step:");
  for (const row of byStep) {
    console.log(`  ${row.action.padEnd(12)} ${String(row.calls).padStart(6)} calls · ${usd(row.avg_call)} per call · ~${row.avg_in} in / ${row.avg_out} out tokens`);
  }
  console.log("\nBy model:");
  for (const row of byModel) console.log(`  ${row.model.padEnd(24)} ${String(row.calls).padStart(6)} calls · ${usd(row.total)} total`);
} finally {
  await client.end();
}
