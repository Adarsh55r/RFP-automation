import type { Metadata } from "next";
import { PricingView } from "@/components/marketing/pricing-view";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { faqStructuredData } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Pricing — RFP Software for Small Teams",
  description:
    "DraftBid AI pricing in US dollars: a free trial proposal, a $149 single-bid pass, Starter at $99 a month and Pro at $249 a month, with two months free on annual plans.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={faqStructuredData()} />
      <SiteHeader />
      <main id="main-content">
        <PricingView />
      </main>
      <SiteFooter />
    </>
  );
}
