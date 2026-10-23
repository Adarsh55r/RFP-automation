import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import { SentryUser } from "@/components/sentry-user";
import { ToastProvider } from "@/components/ui/toast";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { SITE_NAME, SITE_URL } from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DraftBid AI — RFP Response Software for Small Businesses",
    template: "%s · DraftBid AI",
  },
  description:
    "DraftBid AI turns an RFP, tender or questionnaire into a requirements checklist and a first draft written from your own documents, flagging anything it cannot support. Export to Word or PDF. Start free.",
  openGraph: {
    title: "DraftBid AI — Compliant first drafts from your own documents",
    description:
      "RFP response software for small businesses: a requirements checklist, drafts written from your own work with gaps flagged, and Word or PDF export. Start free.",
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: { card: "summary_large_image" },
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
          <SentryUser />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
