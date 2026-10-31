import type { Config } from "tailwindcss";

/**
 * DraftBid AI token map — keep in lockstep with `:root` and `.dark` in
 * `app/globals.css`. Colours are CSS variables, so the light and dark themes
 * restyle every component. Do not add ad-hoc colors or fonts here.
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
        "surface-sunken": "var(--surface-sunken)",
        brand: "var(--brand)",
        "brand-2": "var(--brand-2)",
        "brand-dark": "var(--brand-dark)",
        "on-brand": "var(--on-brand)",
        accent: "var(--accent)",
        slate: "var(--slate)",
        border: "var(--border)",
        danger: "var(--danger)",
        success: "var(--success)",
      },
      fontFamily: {
        display: ["var(--font-sora)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "var(--font-ibm-plex-mono)",
          "ui-monospace",
          "Menlo",
          "monospace",
        ],
      },
      borderRadius: {
        card: "16px",
        control: "10px",
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
