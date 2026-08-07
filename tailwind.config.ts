import type { Config } from "tailwindcss";

/**
 * DraftWin token map — keep in lockstep with `:root` in `app/globals.css`
 * and `.cursor/rules/design-system.md`. Do not add ad-hoc colors or fonts here.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        brand: "var(--brand)",
        "brand-dark": "var(--brand-dark)",
        accent: "var(--accent)",
        slate: "var(--slate)",
        border: "var(--border)",
        danger: "var(--danger)",
        success: "var(--success)",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "var(--font-ibm-plex-mono)",
          "ui-monospace",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        card: "10px",
        control: "8px",
      },
      maxWidth: {
        content: "1200px",
      },
      transitionDuration: {
        hover: "180ms",
      },
    },
  },
};

export default config;
