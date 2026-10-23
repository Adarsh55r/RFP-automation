import type { Metadata } from "next";
import {
  ClosingCta,
  HashScroll,
  Hero,
  HowItCompares,
  HowItWorks,
  Pillars,
  PricingTeaser,
  SampleGallery,
  SiteFooter,
  SiteHeader,
  Testimonials,
  WhoItsFor,
} from "@/components/marketing";
import { JsonLd } from "@/components/seo/json-ld";
import { homeStructuredData } from "@/lib/structured-data";
import { FunnelBeacon } from "@/components/marketing/funnel-beacon";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <JsonLd data={homeStructuredData()} />
      <HashScroll />
      <FunnelBeacon />
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <Pillars />
        <WhoItsFor />
        <HowItWorks />
        <HowItCompares />
        <SampleGallery />
        <Testimonials />
        <PricingTeaser />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
