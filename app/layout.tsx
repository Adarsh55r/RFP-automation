import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import { SentryUser } from "@/components/sentry-user";
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
  metadataBase: new URL("https://draftbidai.com"),
  title: {
    default: "DraftBid AI — RFP Response Software for Small Businesses",
    template: "%s · DraftBid AI",
  },
  description:
    "Win more RFPs without a bid team. DraftBid AI turns any RFP, tender, or security questionnaire into a compliant first-draft proposal in minutes — written from your own past work. Export to Word or PDF. Start free.",
  openGraph: {
    title: "DraftBid AI — Win more RFPs, without a bid team",
    description:
      "AI proposal software for small businesses: every requirement checked, drafts written from your own work, export to Word or PDF. Start free.",
    type: "website",
    siteName: "DraftBid AI",
    url: "/",
  },
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
