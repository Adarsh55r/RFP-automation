"use client";

import { useEffect } from "react";
import { scrollToHash } from "@/lib/smooth-scroll";

export function HashScroll() {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const frame = window.requestAnimationFrame(() => {
      scrollToHash(hash);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return null;
}
