import {
  FeatureGrid,
  Hero,
  HowItWorks,
  PositioningStrip,
  PricingTeaser,
  SiteFooter,
  SiteHeader,
} from "@/components/marketing";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <PositioningStrip />
        <HowItWorks />
        <FeatureGrid />
        <PricingTeaser />
      </main>
      <SiteFooter />
    </>
  );
}
