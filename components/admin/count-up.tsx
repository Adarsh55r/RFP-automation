"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export type CountFormat = "int" | "usd" | "usd0" | "pct" | "compact";

function render(value: number, format: CountFormat) {
  switch (format) {
    case "usd":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
    case "usd0":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
    case "pct":
      return `${value.toFixed(1)}%`;
    case "compact":
      return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
    default:
      return Math.round(value).toLocaleString("en-US");
  }
}

/** Counts up from zero the first time it scrolls into view. */
export function CountUp({ value, format = "int", duration = 1.1 }: { value: number; format?: CountFormat; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [inView, value, duration, reduceMotion]);

  return (
    <span ref={ref} className="tabular-nums">
      {render(display, format)}
    </span>
  );
}
