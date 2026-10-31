"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/focus";

/** Switches between light and dark, with the icon spinning into place. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const reduceMotion = useReducedMotion();
  // The server cannot know the visitor's theme: render a neutral button until mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative inline-flex size-10 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-raised/70 text-ink shadow-sm backdrop-blur transition-colors duration-hover hover:border-brand/50 hover:text-brand",
        focusRing,
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "moon" : "sun"}
          initial={reduceMotion ? false : { rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={reduceMotion ? undefined : { rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="inline-flex"
        >
          {dark ? <Moon className="size-[18px]" strokeWidth={2} aria-hidden /> : <Sun className="size-[18px]" strokeWidth={2} aria-hidden />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
