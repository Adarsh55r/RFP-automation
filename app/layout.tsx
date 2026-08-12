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
  // #region agent log
  fetch("http://127.0.0.1:7300/ingest/e0510c8a-6039-4418-bcce-da7cd1d3581a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "91d1a9",
    },
    body: JSON.stringify({
      sessionId: "91d1a9",
      location: "app/layout.tsx:43",
      message: "root layout rendered",
      data: {},
      timestamp: Date.now(),
      hypothesisId: "H4",
      runId: "dev-manifest",
    }),
  }).catch(() => {});
  // #endregion

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
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
