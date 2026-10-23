import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/lib/company";
import { dpaClauses } from "@/lib/dpa";
import { DPA_VERSION } from "@/lib/legal";

// DRAFT: must be reviewed by a lawyer in the company's jurisdiction before use. See docs/legal/README.md.

export const metadata: Metadata = {
  title: "Data Processing Addendum",
  description: "Download DraftBid AI's Data Processing Addendum template for UK GDPR and EU GDPR.",
  alternates: { canonical: "/dpa" },
};

export default function DpaPage() {
  return (
    <LegalPage
      title="Data Processing Addendum"
      meta={`Template version ${DPA_VERSION}`}
      intro={
        <>
          <p>
            If your company needs a DPA for UK GDPR or EU GDPR, download the template, fill in your
            company details, sign it and email it to {COMPANY.privacyEmail}. We will countersign
            and send it back.
          </p>
          <div className="mt-6">
            <Button asChild>
              <a href="/dpa/template" download>
                Download the DPA (Word)
              </a>
            </Button>
          </div>
        </>
      }
      sections={dpaClauses().map((clause) => ({ title: clause.title.replace(/^\d+\.\s*/, ""), body: clause.paragraphs }))}
    />
  );
}
