import { NextResponse } from "next/server";
import { handleDodoEvent, type DodoEvent } from "@/lib/billing";
import { verifyWebhook } from "@/lib/dodo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dodo Payments webhooks (Developer → Webhooks in the Dodo dashboard). The
 * signature is checked against the raw body before anything is read from it.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const headers = {
    id: request.headers.get("webhook-id"),
    timestamp: request.headers.get("webhook-timestamp"),
    signature: request.headers.get("webhook-signature"),
  };
  if (!verifyWebhook(rawBody, headers)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: DodoEvent;
  try {
    event = JSON.parse(rawBody) as DodoEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (typeof event?.type !== "string" || !event.data || typeof event.data !== "object") {
    return NextResponse.json({ error: "Not a Dodo Payments event." }, { status: 400 });
  }

  try {
    const result = await handleDodoEvent(headers.id!, event);
    return NextResponse.json({ received: true, result });
  } catch {
    // A 5xx makes Dodo retry the delivery later.
    return NextResponse.json({ error: "Could not process the event." }, { status: 500 });
  }
}
