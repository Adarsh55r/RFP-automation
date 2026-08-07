import { BookMarked, IndianRupee, PencilLine, Stamp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";

const features = [
  {
    icon: BookMarked,
    title: "Your own content library",
    body: "Keep case studies, leadership bios, tech-stack pages, and rate-card language in one place. New drafts pull from that library instead of writing proof you do not have.",
  },
  {
    icon: PencilLine,
    title: "Extraction you can edit",
    body: "Every requirement is a row you can rewrite, split, or ignore. Drafting waits until the checklist matches the RFP you actually intend to answer.",
  },
  {
    icon: Stamp,
    title: "Export with your letterhead",
    body: "Paid plans export DOCX with your header, footer, and signatory block. The file should look like it came from your shared drive, not from a vendor portal.",
  },
  {
    icon: IndianRupee,
    title: "India-first pricing",
    body: "Rupee plans sized for boutique and mid-size IT agencies — not USD enterprise seats. Start at ₹0. Most teams land on Growth at ₹5,999 / month.",
  },
] as const;

export function FeatureGrid() {
  return (
    <Section id="product" className="bg-surface">
      <p className="font-mono text-xs tracking-wide text-slate uppercase">
        Product
      </p>
      <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium text-ink md:text-4xl">
        Built around how pre-sales teams in India actually chase RFPs.
      </h2>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <div className="flex size-10 items-center justify-center rounded-control bg-surface text-brand">
                <Icon aria-hidden className="size-6" strokeWidth={1.75} />
              </div>
              <h3 className="mt-6 font-sans text-lg font-semibold text-ink">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                {feature.body}
              </p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
