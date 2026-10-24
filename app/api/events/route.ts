import { NextResponse } from "next/server";
import { ANONYMOUS_EVENTS, recordEvent, type FunnelEventName } from "@/lib/funnel";

export const runtime = "nodejs";

/**
 * Anonymous page events from the marketing site (visit, pricing view, sign-up
 * started). Only the event name, the page path and the marketing segment are
 * stored; nothing that identifies the visitor.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { event?: unknown; path?: unknown; seg?: unknown } | null;
  const event = body?.event;
  if (typeof event !== "string" || !ANONYMOUS_EVENTS.includes(event as FunnelEventName)) {
    return NextResponse.json({ error: "Unknown event." }, { status: 400 });
  }
  const path = typeof body?.path === "string" && body.path.startsWith("/") ? body.path.split("?")[0] : null;
  await recordEvent(event as FunnelEventName, { path, segment: typeof body?.seg === "string" ? body.seg : null });
  return new NextResponse(null, { status: 204 });
}
