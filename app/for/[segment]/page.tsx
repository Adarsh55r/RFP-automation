import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SegmentLanding } from "@/components/marketing/segment-landing";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getSegment, SEGMENTS } from "@/lib/segments";

type Props = { params: Promise<{ segment: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SEGMENTS.map((segment) => ({ segment: segment.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const segment = getSegment((await params).segment);
  if (!segment) return {};
  return {
    title: segment.title,
    description: segment.description,
    alternates: { canonical: `/for/${segment.slug}` },
    openGraph: { title: segment.title, description: segment.description, url: `/for/${segment.slug}` },
  };
}

export default async function SegmentPage({ params }: Props) {
  const segment = getSegment((await params).segment);
  if (!segment) notFound();
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <SegmentLanding segment={segment} />
      </main>
      <SiteFooter />
    </>
  );
}
