import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIp, hashIp } from "@/lib/free-tool";
import { isSegmentSlug } from "@/lib/segments";

export const runtime = "nodejs";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const LEADS_PER_IP_PER_DAY = 5;

/** Stores an email from someone who asked to hear from us after using a free tool. Consent is required. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; consent?: unknown; segment?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (body?.consent !== true) return NextResponse.json({ error: "Tick the box to agree to be contacted." }, { status: 400 });

  const ipHash = hashIp(clientIp(request));
  const dayStart = new Date(new Date().toISOString().slice(0, 10));
  const recent = await prisma.toolUsage.count({ where: { tool: "lead", ipHash, createdAt: { gte: dayStart } } });
  if (recent >= LEADS_PER_IP_PER_DAY) return NextResponse.json({ error: "Please try again tomorrow." }, { status: 429 });

  await prisma.toolUsage.create({ data: { tool: "lead", ipHash } });
  const existing = await prisma.lead.findFirst({ where: { email, source: "rfp-checklist" } });
  if (!existing) {
    await prisma.lead.create({
      data: { email, source: "rfp-checklist", segment: isSegmentSlug(body?.segment) ? body.segment : null, consentAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true });
}
