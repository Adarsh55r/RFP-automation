"use client";

import { useTheme } from "@/components/theme/theme-provider";
import { clerkAppearanceFor } from "@/lib/clerk-appearance";

/** Clerk's appearance for the current theme. */
export function useClerkAppearance() {
  return clerkAppearanceFor(useTheme().resolved);
}
