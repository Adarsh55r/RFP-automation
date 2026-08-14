/**
 * Clerk appearance mapped to DraftWin tokens.
 * Keep hex values in sync with `app/globals.css`.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#0F6E5B",
    colorDanger: "#C0432F",
    colorSuccess: "#1E7A4C",
    colorWarning: "#E8A33D",
    colorForeground: "#0B1F33",
    colorMutedForeground: "#445566",
    colorBackground: "#FFFFFF",
    colorInput: "#FFFFFF",
    colorInputForeground: "#0B1F33",
    colorNeutral: "#445566",
    colorBorder: "#E2E8E4",
    borderRadius: "8px",
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    rootBox: "w-full",
    card: "rounded-card border border-border bg-surface-raised shadow-none p-6",
    headerTitle: "font-sans text-xl font-semibold text-ink",
    headerSubtitle: "text-sm text-slate",
    socialButtonsBlockButton:
      "rounded-control border border-border bg-surface-raised text-ink hover:-translate-y-0.5 transition-[transform,border-color] duration-hover ease-out",
    socialButtonsBlockButtonText: "font-sans font-semibold",
    dividerLine: "bg-border",
    dividerText: "font-mono text-xs tracking-wide text-slate uppercase",
    formFieldLabel: "font-sans text-sm font-medium text-ink",
    formFieldInput:
      "h-10 rounded-control border border-border bg-surface-raised px-4 font-sans text-sm text-ink hover:border-brand/60 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-surface",
    formButtonPrimary:
      "rounded-control bg-brand text-surface-raised font-sans font-semibold h-10 shadow-none hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(11_31_51_/_0.12)] transition-[transform,box-shadow] duration-hover ease-out",
    footerActionLink: "font-sans font-semibold text-brand hover:text-brand",
    identityPreviewEditButton: "text-brand",
    formFieldInputShowPasswordButton: "text-slate hover:text-ink",
    otpCodeFieldInput: "rounded-control border-border text-ink",
    alertText: "text-sm text-slate",
    formFieldErrorText: "text-sm text-danger",
    badge: "font-mono text-xs tracking-wide uppercase rounded-control",
  },
};