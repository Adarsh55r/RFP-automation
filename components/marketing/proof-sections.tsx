import { Section } from "@/components/marketing/section";
import { COMPARISON, SAMPLE_OUTPUTS, TESTIMONIALS } from "@/lib/marketing-content";

/**
 * Sections built only from real material (lib/marketing-content.ts). Each
 * renders nothing until the founder supplies it, so the site never shows a
 * made-up comparison, sample or testimonial.
 */
export function HowItCompares() {
  if (!COMPARISON) return null;
  return (
    <Section id="compare">
      <p className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-brand uppercase">How it compares</p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink md:text-[2.6rem] md:leading-[1.15]">
        The same RFP in ChatGPT and in DraftBid AI.
      </h2>
      <p className="mt-4 text-sm text-slate">
        RFP used:{" "}
        <a href={COMPARISON.rfpSourceUrl} className="text-brand underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">
          {COMPARISON.rfpTitle}
        </a>
        .{" "}
        <a href={COMPARISON.outputsUrl} className="text-brand underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">
          Read both outputs
        </a>
        .
      </p>
      <div className="mt-8 overflow-x-auto rounded-control border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand/10 text-brand">
            <tr>
              <th className="px-4 py-3">Measure</th>
              <th className="px-4 py-3">ChatGPT</th>
              <th className="px-4 py-3">DraftBid AI</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.rows.map((row) => (
              <tr key={row.measure} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-ink">{row.measure}</td>
                <td className="px-4 py-3 text-slate">{row.chatgpt}</td>
                <td className="px-4 py-3 text-slate">{row.draftbid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function SampleGallery() {
  if (SAMPLE_OUTPUTS.length === 0) return null;
  return (
    <Section id="samples" className="bg-surface">
      <p className="inline-flex items-center rounded-full border border-brand/25 bg-brand/5 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-brand uppercase">Sample outputs</p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink md:text-[2.6rem] md:leading-[1.15]">
        First drafts generated from public RFPs.
      </h2>
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {SAMPLE_OUTPUTS.map((sample) => (
          <li key={sample.outputUrl} className="hover-lift glow-ring rounded-card border border-border bg-surface-raised p-5 shadow-[var(--shadow-md)]">
            <p className="font-mono text-xs text-slate uppercase">{sample.segment}</p>
            <p className="mt-2 font-sans font-semibold text-ink">{sample.title}</p>
            <p className="mt-3 text-sm">
              <a href={sample.outputUrl} className="text-brand underline-offset-2 hover:underline">
                Read the draft
              </a>{" "}
              ·{" "}
              <a href={sample.rfpSourceUrl} className="text-brand underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">
                Source RFP
              </a>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Testimonials() {
  const real = TESTIMONIALS.filter((item) => item.permissionOnFile);
  if (real.length === 0) return null;
  return (
    <Section id="customers">
      <p className="font-mono text-xs tracking-wide text-slate uppercase">From customers</p>
      <ul className="mt-8 grid gap-6 md:grid-cols-2">
        {real.map((item) => (
          <li key={item.name} className="hover-lift glow-ring rounded-card border border-border bg-surface-raised p-6 shadow-[var(--shadow-md)]">
            <blockquote className="text-base leading-relaxed text-ink">“{item.quote}”</blockquote>
            <p className="mt-4 text-sm text-slate">
              {item.name}, {item.role}, {item.company}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
