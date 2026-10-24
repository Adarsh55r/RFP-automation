import type { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export type LegalSection = {
  title: string;
  /** Paragraphs; a string array renders as a bulleted list. */
  body: (ReactNode | string[])[];
};

/** Shared layout for Terms, Privacy, Security, Subprocessors, DPA and About. */
export function LegalPage({
  eyebrow = "Legal",
  title,
  meta,
  intro,
  sections,
  children,
}: {
  eyebrow?: string;
  title: string;
  /** For example "Version 2026-10-23 · Last updated October 23, 2026". */
  meta?: string;
  intro?: ReactNode;
  sections?: LegalSection[];
  children?: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="bg-surface">
        <article className="mx-auto max-w-content px-6 py-16 md:px-8 md:py-24">
          <p className="font-mono text-xs tracking-wide text-slate uppercase">{eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
          {meta ? <p className="mt-4 font-mono text-xs tracking-wide text-slate">{meta}</p> : null}
          {intro ? (
            <div className="mt-4 max-w-2xl text-sm leading-relaxed text-slate md:text-base">{intro}</div>
          ) : null}

          {sections?.length ? (
            <div className="mt-12 flex flex-col gap-12">
              {sections.map((section, index) => (
                <section key={section.title} className="max-w-3xl">
                  <h2 className="font-sans text-lg font-semibold text-ink">
                    <span className="mr-3 font-mono text-xs tracking-wide text-slate">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </h2>
                  <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-slate md:text-base">
                    {section.body.map((part, partIndex) =>
                      Array.isArray(part) ? (
                        <ul key={partIndex} className="list-disc space-y-2 pl-5">
                          {part.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p key={partIndex}>{part}</p>
                      ),
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : null}
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
