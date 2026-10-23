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

/** Null when the run may go ahead, otherwise a message for the visitor. */
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

/** Counts a run before the AI starts, so failed attempts count towards the limits too. */
export async function startFreeToolRun(ipHash: string) {
  return (await prisma.toolUsage.create({ data: { tool: FREE_TOOL.name, ipHash } })).id;
}

/** Stores the run's AI cost and removes records past the retention period. */
export async function finishFreeToolRun(id: string, costMicros: number) {
  await prisma.toolUsage.update({ where: { id }, data: { costMicros } });
  const cutoff = new Date(Date.now() - FREE_TOOL.retentionDays * 86_400_000);
  await prisma.toolUsage.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
