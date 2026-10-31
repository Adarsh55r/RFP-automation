/**
 * Clerk appearance mapped to DraftBid AI tokens. Clerk needs real colour
 * values for its variables, so there is one set per theme (keep the hex values
 * in sync with `:root` and `.dark` in app/globals.css); the element classes use
 * the theme tokens and follow the theme on their own.
 */
const palette = {
  light: {
    colorPrimary: "#0D7A63",
    colorDanger: "#C93C37",
    colorSuccess: "#15803D",
    colorWarning: "#F0A01F",
    colorForeground: "#0B1324",
    colorMutedForeground: "#536176",
    colorBackground: "#FFFFFF",
    colorInput: "#FFFFFF",
    colorInputForeground: "#0B1324",
    colorNeutral: "#536176",
    colorBorder: "#E2E8EF",
  },
  dark: {
    colorPrimary: "#2FD3B0",
    colorDanger: "#F87171",
    colorSuccess: "#4ADE80",
    colorWarning: "#FBBF24",
    colorForeground: "#E8EEF7",
    colorMutedForeground: "#93A3B9",
    colorBackground: "#0C1424",
    colorInput: "#08101D",
    colorInputForeground: "#E8EEF7",
    colorNeutral: "#93A3B9",
    colorBorder: "#1B2740",
  },
} as const;

export function clerkAppearanceFor(theme: "light" | "dark") {
  return {
    variables: {
      ...palette[theme],
      borderRadius: "10px",
      fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
      fontFamilyButtons: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
      fontSize: "14px",
    },
    elements: {
      rootBox: "w-full",
      card: "rounded-card border border-border bg-surface-raised shadow-[var(--shadow-lg)] p-6",
      headerTitle: "font-display text-xl font-semibold text-ink",
      headerSubtitle: "text-sm text-slate",
      socialButtonsBlockButton:
        "rounded-control border border-border bg-surface-raised text-ink hover:-translate-y-0.5 hover:border-brand/50 transition-[transform,border-color] duration-hover ease-out",
      socialButtonsBlockButtonText: "font-sans font-semibold",
      dividerLine: "bg-border",
      dividerText: "font-mono text-xs tracking-wide text-slate uppercase",
      formFieldLabel: "font-sans text-sm font-medium text-ink",
      formFieldInput:
        "h-11 rounded-control border border-border bg-surface-raised px-4 font-sans text-sm text-ink hover:border-brand/60 focus:border-brand focus:ring-4 focus:ring-brand/15",
      formButtonPrimary:
        "btn-shine h-11 rounded-control bg-brand-gradient text-on-brand font-sans font-semibold shadow-[0_8px_24px_-8px_rgb(var(--glow)/0.6)] hover:-translate-y-0.5 transition-[transform,box-shadow] duration-hover ease-out",
      footerActionLink: "font-sans font-semibold text-brand hover:text-brand",
      identityPreviewEditButton: "text-brand",
      formFieldInputShowPasswordButton: "text-slate hover:text-ink",
      otpCodeFieldInput: "rounded-control border-border text-ink",
      alertText: "text-sm text-slate",
      formFieldErrorText: "text-sm text-danger",
      badge: "font-mono text-xs tracking-wide uppercase rounded-control",
    },
  };
}

/** The light appearance, for places rendered before the theme is known. */
export const clerkAppearance = clerkAppearanceFor("light");
