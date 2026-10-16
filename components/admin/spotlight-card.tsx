"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";

export const riseIn = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } },
};

/** Glass card with a cursor-following glow and a gentle lift on hover. */
export function SpotlightCard({
  className,
  interactive = true,
  children,
  ...props
}: HTMLMotionProps<"div"> & { interactive?: boolean }) {
  const track = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  };

  return (
    <motion.div
      variants={riseIn}
      onMouseMove={interactive ? track : undefined}
      whileHover={interactive ? { y: -3 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      data-interactive={interactive}
      className={cn("admin-card", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Staggers the entrance of every SpotlightCard inside it. */
export function Stagger({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}
