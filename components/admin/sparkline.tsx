"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const id = useId();
  const reduceMotion = useReducedMotion();
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const width = 120;
  const height = 36;
  const points = values.map((value, index) => [
    (index / (values.length - 1)) * width,
    height - 2 - (value / max) * (height - 6),
  ]);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg aria-hidden viewBox={`0 0 ${width} ${height}`} className="h-9 w-28 overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#${id})`}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
