import type { Metadata } from "next";
import {
  ClosingCta,
  FeatureGrid,
  HashScroll,
  Hero,
  HowItWorks,
  PositioningStrip,
  PricingTeaser,
  SiteFooter,
  SiteHeader,
} from "@/components/marketing";
import { JsonLd } from "@/components/seo/json-ld";
import { homeStructuredData } from "@/lib/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <JsonLd data={homeStructuredData()} />
      <HashScroll />
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <PositioningStrip />
        <HowItWorks />
        <FeatureGrid />
        <PricingTeaser />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
