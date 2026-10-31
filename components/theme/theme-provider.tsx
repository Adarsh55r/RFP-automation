"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { THEME_STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

type ThemeContextValue = {
  choice: ThemeChoice;
  resolved: "light" | "dark";
  setChoice: (choice: ThemeChoice) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Holds the theme choice; the head script has already applied it before paint. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    let stored: ThemeChoice = "system";
    try {
      const value = localStorage.getItem(THEME_STORAGE_KEY);
      if (value === "light" || value === "dark" || value === "system") stored = value;
    } catch {
      // Storage can be blocked; the theme then follows the device.
    }
    setChoiceState(stored);
    setResolved(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  // While following the device, react when its setting changes.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      apply(media.matches);
      setResolved(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    const dark = next === "dark" || (next === "system" && systemPrefersDark());
    // Briefly switch off transitions so the whole page changes theme at once.
    const root = document.documentElement;
    root.classList.add("theme-switching");
    apply(dark);
    window.setTimeout(() => root.classList.remove("theme-switching"), 60);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore: the choice still applies for this visit.
    }
    setChoiceState(next);
    setResolved(dark ? "dark" : "light");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ choice, resolved, setChoice, toggle: () => setChoice(resolved === "dark" ? "light" : "dark") }),
    [choice, resolved, setChoice],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
