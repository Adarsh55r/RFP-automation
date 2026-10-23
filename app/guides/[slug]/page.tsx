import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getGuide, guideVisible, GUIDES } from "@/lib/guides";
import { getSegment } from "@/lib/segments";
import { FunnelBeacon } from "@/components/marketing/funnel-beacon";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description, url: `/guides/${guide.slug}`, type: "article" },
    ...(guide.published ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function GuidePage({ params }: Props) {
  const guide = getGuide((await params).slug);
  if (!guide || !guideVisible(guide)) notFound();
  const segment = guide.segment ? getSegment(guide.segment) : null;
  return (
    <>
      <FunnelBeacon />
      <SiteHeader />
      <main id="main-content" className="bg-surface">
        <article className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16 md:px-8 md:py-20">
          {!guide.published ? (
            <p role="note" className="rounded-control border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-ink">
              Draft template: not published, not indexed, and not shown in production. Replace the {"{{GUIDE_COPY}}"} placeholders
              in <code>lib/guides.ts</code>, then set <code>published: true</code>.
            </p>
          ) : null}
          <header>
            <p className="font-mono text-xs tracking-wide text-slate uppercase">Guide</p>
            <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ink md:text-5xl">{guide.title}</h1>
            <p className="mt-4 text-base leading-relaxed text-slate">{guide.description}</p>
          </header>
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-sans text-xl font-semibold text-ink">{section.heading}</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-slate">{section.body}</p>
            </section>
          ))}
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-6">
            <p className="font-sans text-base font-semibold text-ink">Build this checklist from your own RFP</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="accent">
                <Link href="/tools/rfp-checklist">Free checklist, no account</Link>
              </Button>
              {segment ? (
                <Button asChild variant="secondary">
                  <Link href={`/for/${segment.slug}`}>DraftBid AI for {segment.name.toLowerCase()}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
