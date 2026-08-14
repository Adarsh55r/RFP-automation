import type { Metadata } from "next";
import { PricingView } from "@/components/marketing/pricing-view";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "DraftWin plans in INR: Free, Starter ₹1,999, Growth ₹5,999, and Agency ₹11,999. Annual billing includes two months free. GST invoices on paid plans.",
};

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <PricingView />
      </main>
      <SiteFooter />
    </>
  );
}
