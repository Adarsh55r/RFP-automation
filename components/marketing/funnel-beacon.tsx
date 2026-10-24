"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isAttributionSource } from "@/lib/funnel-sources";

/**
 * Sends one anonymous page event (no cookies, no identifiers) and carries the
 * ?seg= marketing segment onto the page's internal links, so it reaches
 * sign-up through the URL instead of being stored in the browser.
 */
function Beacon({ event = "visit" }: { event?: "visit" | "visit_pricing" | "start_signup" }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const seg = params.get("seg");

  useEffect(() => {
    const payload = JSON.stringify({ event, path: pathname, seg: isAttributionSource(seg) ? seg : null });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
    else void fetch("/api/events", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
  }, [event, pathname, seg]);

  useEffect(() => {
    if (!isAttributionSource(seg)) return;
    for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href^='/']")) {
      const url = new URL(link.href, window.location.origin);
      if (url.pathname.startsWith("/api") || url.searchParams.has("seg")) continue;
      url.searchParams.set("seg", seg);
      link.setAttribute("href", url.pathname + url.search + url.hash);
    }
  }, [seg, pathname]);

  return null;
}

/** Static pages need a Suspense boundary around search-param reads. */
export function FunnelBeacon(props: { event?: "visit" | "visit_pricing" | "start_signup" }) {
  return (
    <Suspense fallback={null}>
      <Beacon {...props} />
    </Suspense>
  );
}
