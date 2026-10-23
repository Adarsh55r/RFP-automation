"use client";

import type { ReactNode } from "react";
import { trackCheckoutStarted } from "@/lib/actions/funnel";

/** A plan request link that records the funnel step before following it. */
export function PlanRequestLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} onClick={() => void trackCheckoutStarted()}>
      {children}
    </a>
  );
}
