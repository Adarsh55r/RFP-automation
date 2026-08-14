import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DraftWin",
    template: "%s · DraftWin",
  },
  description:
    "Turn private-sector RFPs into proposals your IT services agency can send. Vendor empanelment, security questionnaires, and pitch decks — not GeM tenders.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
    >
      <html
        lang="en"
        className={`scroll-smooth ${fraunces.variable} ${manrope.variable} ${ibmPlexMono.variable}`}
      >
        <body className="min-h-screen bg-surface font-sans text-ink antialiased">
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
