import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Limits for the free, no-signup checklist tool (/tools/rfp-checklist).
 * Anyone can use it, so every limit is enforced on the server: per visitor
 * (by a salted hash of their IP, never the IP itself), across all visitors,
 * and on AI spend. Files are processed in memory and never stored.
 */
export const FREE_TOOL = {
  name: "rfp-checklist",
  perIpPerDay: Number(process.env.FREE_TOOL_PER_IP_PER_DAY ?? 3),
  runsPerDay: Number(process.env.FREE_TOOL_RUNS_PER_DAY ?? 200),
  spendPerDayUsd: Number(process.env.FREE_TOOL_SPEND_PER_DAY_USD ?? 25),
  maxBytes: 4 * 1024 * 1024,
  maxPages: 80,
  /** Characters of the document read; longer documents are read up to here and the result says so. */
  maxChars: 200_000,
  retentionDays: 30,
};

/** The visitor's IP from the platform's forwarding headers. */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function hashIp(ip: string) {
  const salt = process.env.FREE_TOOL_IP_SALT?.trim() || "draftbidai-free-tool";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Quick check before the upload is read: turns away most visitors over a limit
 * without parsing their file. Not the guard itself: `reserveFreeToolRun` is.
 */
export async function freeToolLimit(ipHash: string, now = new Date()) {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [mine, all, spend] = await Promise.all([
    prisma.toolUsage.count({ where: { tool: FREE_TOOL.name, ipHash, createdAt: { gte: dayStart } } }),
    prisma.toolUsage.count({ where: { tool: FREE_TOOL.name, createdAt: { gte: dayStart } } }),
    prisma.toolUsage.aggregate({ where: { tool: FREE_TOOL.name, createdAt: { gte: dayStart } }, _sum: { costMicros: true } }),
  ]);
  if (mine >= FREE_TOOL.perIpPerDay) {
    return `The free checklist can be used ${FREE_TOOL.perIpPerDay} times a day. Create a free account to keep going.`;
  }
  if (all >= FREE_TOOL.runsPerDay || (spend._sum.costMicros ?? 0) / 1_000_000 >= FREE_TOOL.spendPerDayUsd) {
    return "The free checklist is at capacity for today. Try again tomorrow, or create a free account.";
  }
  return null;
}

/**
 * The most one run can cost, held against the daily budget until the real
 * cost is known: about 50,000 tokens in and at most 32,768 out at GPT-4.1
 * prices is $0.36, rounded up. Runs still in progress therefore count in full,
 * and a run that fails without reporting its cost keeps this amount.
 */
export const RESERVED_RUN_COST_MICROS = 400_000;

/** Any constant, unique to this lock: serialises free-tool reservations across server instances. */
const FREE_TOOL_LOCK_KEY = 724_012;

/**
 * Checks every limit and records the run in one step, under a database lock,
 * so requests sent at the same moment queue up instead of all passing a count
 * taken before any of them was recorded. The run is recorded at its reserved
 * cost; `finishFreeToolRun` replaces that with the real cost.
 */
export async function reserveFreeToolRun(ipHash: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FREE_TOOL_LOCK_KEY})`;
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const today = { tool: FREE_TOOL.name, createdAt: { gte: dayStart } };
    const [mine, all, spend] = await Promise.all([
      tx.toolUsage.count({ where: { ...today, ipHash } }),
      tx.toolUsage.count({ where: today }),
      tx.toolUsage.aggregate({ where: today, _sum: { costMicros: true } }),
    ]);
    const spent = spend._sum.costMicros ?? 0;
    if (mine >= FREE_TOOL.perIpPerDay) {
      return { ok: false as const, error: `The free checklist can be used ${FREE_TOOL.perIpPerDay} times a day. Create a free account to keep going.` };
    }
    // The run is only allowed if its worst case still fits in today's budget.
    if (all >= FREE_TOOL.runsPerDay || spent + RESERVED_RUN_COST_MICROS > FREE_TOOL.spendPerDayUsd * 1_000_000) {
      return { ok: false as const, error: "The free checklist is at capacity for today. Try again tomorrow, or create a free account." };
    }
    const run = await tx.toolUsage.create({ data: { tool: FREE_TOOL.name, ipHash, costMicros: RESERVED_RUN_COST_MICROS } });
    return { ok: true as const, id: run.id };
  });
}

/** Stores the run's real AI cost in place of the reservation, and removes records past the retention period. */
export async function finishFreeToolRun(id: string, costMicros: number) {
  await prisma.toolUsage.update({ where: { id }, data: { costMicros } });
  const cutoff = new Date(Date.now() - FREE_TOOL.retentionDays * 86_400_000);
  await prisma.toolUsage.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
