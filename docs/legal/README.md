# Legal pages: internal note

**DRAFT: these texts must be reviewed by a lawyer in the founder's jurisdiction before they are relied on.** They were written by an AI assistant from the product's actual behaviour. They are not legal advice.

| Page | Source file | Status |
|---|---|---|
| Terms of Service | `app/terms/page.tsx` | Draft: lawyer review required |
| Privacy Policy | `app/privacy/page.tsx` | Draft: lawyer review required |
| Data Processing Addendum | `lib/dpa.ts` (page `/dpa`, Word file `/dpa/template`) | Draft: lawyer review required |
| Subprocessors | `lib/subprocessors.ts` | Draft: confirm entities; regions are general where not known |
| Security | `app/security/page.tsx` | Factual: keep in sync with the code |

Before going live:

1. DraftBid AI is run by an independent founder with no registered company, so the pages contain no legal-entity name, address, company number or governing-law clause, and no `{{PLACEHOLDER}}` values. A test (`tests/unit/legal-pages.test.ts`) fails if either comes back. If a company is formed, add its details (see `FOUNDER_TODO.md`).
2. Have a lawyer review the Terms, Privacy Policy and DPA, in particular:
   - liability caps;
   - whether to add a governing-law clause (there is none today);
   - the refund policy;
   - transfer mechanisms;
   - consumer-law carve-outs in your country.
3. When the Terms or Privacy Policy change in substance, bump `TERMS_VERSION` / `PRIVACY_VERSION` in `lib/legal.ts`. Users are asked to accept a new Terms version on their next visit.
