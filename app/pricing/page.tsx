import type { Metadata } from "next";
import { PricingView } from "@/components/marketing/pricing-view";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { faqStructuredData } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Pricing — RFP Software for Small Teams",
  description:
    "DraftBid AI plans in USD and GBP: Free, Starter $49 (£39), Growth $149 (£119), and Team $349 (£279) per month. Month-to-month, with two months free on annual billing.",
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
