import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { COMPANY } from "@/lib/company";
import { getSubprocessors } from "@/lib/subprocessors";

// DRAFT: must be reviewed by a lawyer in the company's jurisdiction before use. See docs/legal/README.md.

export const metadata: Metadata = {
  title: "Subprocessors",
  description: "Every third party that processes customer data for DraftBid AI, what it does, and where.",
  alternates: { canonical: "/subprocessors" },
};

export default function SubprocessorsPage() {
  const rows = getSubprocessors();
  return (
    <LegalPage
      title="Subprocessors"
      meta="Last updated October 23, 2026"
      intro={
        <p>
          These are the companies that process customer data so {COMPANY.productName} can run. We
          give each one only the data it needs for the purpose shown. We will update this page
          before adding a new subprocessor that handles customer files or drafts; to be told by
          email, write to {COMPANY.privacyEmail}.
        </p>
      }
    >
      <div className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-xs tracking-wide text-slate uppercase">
              <th className="py-3 pr-4">Company</th>
              <th className="py-3 pr-4">Purpose</th>
              <th className="py-3 pr-4">Data it handles</th>
              <th className="py-3 pr-4">Location</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-b border-border align-top text-slate">
                <td className="py-4 pr-4 font-semibold text-ink">{row.name}</td>
                <td className="py-4 pr-4">{row.purpose}</td>
                <td className="py-4 pr-4">{row.data}</td>
                <td className="py-4 pr-4">{row.location}</td>
                <td className="py-4">{row.inUse ? "In use" : "Not currently used"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LegalPage>
  );
}
