# Upgrade plan

Based on [AUDIT.md](AUDIT.md). Work happens on branch `claude/vigilant-lovelace-c999tq`, in small commits, logged in [UPGRADE_LOG.md](UPGRADE_LOG.md). **Nothing is merged to `main`**, because a merge deploys to production. The founder merges each phase after reviewing its PR and Vercel preview.

## Cross-cutting decisions and risks

| Topic | Decision / default | Risk |
|---|---|---|
| Brand spelling | "DraftBid AI" everywhere (default) | — |
| Deploys | PRs only; production deploys are the founder's merge | — |
| Schema changes | Additive only (new tables, nullable columns), applied by the existing idempotent `lib/schema-upgrade.ts` plus a matching Prisma migration. No drops or renames | **Preview deployments may share production's `DATABASE_URL`.** If they do, a preview build applies additive DDL to the production database before merge. Recommended: give Preview its own Neon branch (FOUNDER_TODO) |
| Payment provider | **Blocked: founder decision.** The repo has no payment integration. Phase 1.7 and Phase 2 checkout need a provider choice and its **test-mode** keys. Merchant-of-record options (Paddle, Lemon Squeezy, Dodo) suit a founder without a registered company better than Stripe India. Everything provider-independent (plan config, entitlements, overage confirmation, enforcement) is built first | Billing cannot be "verified in test mode" until keys exist |
| Teams / seats | Option (b): off every plan and page (default) | — |
| Consultant plan | Hidden until client workspaces ship (default) | — |
| OCR | Use the **existing AI provider's document input** (GPT-4.1 / Claude read PDFs and images), so no new subprocessor is needed. A self-hosted Tesseract worker is the fallback if the founder prefers | OCR text quality is model-dependent and needs the low-confidence warning |
| Legal text | Drafts with an internal "lawyer review required" note in the repo (`docs/legal/README.md`), with `{{PLACEHOLDERS}}` for entity details | Not legal advice |

## Phase 1: Launch blockers

| # | Tasks | Files |
|---|---|---|
| 1.1 | Add `/terms`, `/subprocessors`, `/security`, `/dpa` (with a downloadable DOCX template) and `/about`, sharing one legal-page layout. Company identity constants live in `lib/company.ts` with placeholders. Footer links on every public page. Signup clickwrap: "By creating an account you agree to the Terms and Privacy Policy" on sign-up, plus an explicit checkbox at onboarding that records `termsVersion` and `termsAcceptedAt` on `User`. Existing users are asked once on their next dashboard visit | `app/(legal)/*`, `lib/company.ts`, `lib/legal.ts`, `components/marketing/site-footer.tsx`, `components/auth/*`, `lib/actions/onboarding.ts`, `prisma/schema.prisma`, `lib/schema-upgrade.ts` |
| 1.2 | Privacy: name the entity (placeholder) and the AI providers, link to subprocessors, state the true retention, remove teammates and payment-processor statements until they're live, add a version and date | `app/privacy/page.tsx` |
| 1.2b | Make the retention statements true: let users **delete an RFP** (its file, drafts and text) and **delete their workspace** (all data plus storage objects) from Settings | `lib/actions/rfps.ts`, `lib/actions/account.ts`, settings UI, tests |
| 1.3 | Remove "coming soon" items from plans (optional "On the roadmap" list without dates); replace outcome claims; label the hero mock as illustrative and rename it "City of Example"; standardise the brand name | `lib/plans.ts`, `components/marketing/*`, `lib/site.ts`, `lib/faqs.ts`, `app/layout.tsx`, sign-up view |
| 1.4 | Add cross-user tests for the remaining endpoints (upload complete/abandon, new delete actions, settings, export). Storage stays private with signed URLs (done) | `tests/integration/authorization.test.ts` |
| 1.5 | Reject encrypted PDFs, cap pages (for example 500), add friendly malformed-file errors, keep magic bytes. **Malware scanning:** not feasible on Vercel serverless without a scanning service, so it goes in FOUNDER_TODO; files are never executed (text extraction only) and stay private | `lib/rfp-upload.ts`, `lib/rfp-extract.ts`, upload routes |
| 1.6 | Stop offering unlimited Team to new customers (existing `agency` rows keep their access). Add a daily AI $ ceiling per account with an alert, and an upload rate limit per hour. Add a cost report script giving the average and p95 cost per proposal, plus p95 on `/admin/costs` | `lib/plan-limits.ts`, `lib/ai-guard.ts`, `lib/admin-data.ts`, `scripts/ai-cost-report.ts` |
| 1.7 | **Blocked on the provider decision.** Then: webhook signature verification, idempotency table, lifecycle tests with signed fixtures | — |
| 1.8 | Sentry: drop console and fetch breadcrumbs and scrub messages longer than N characters. Verify no document text reaches logs (a test greps the log calls). Uptime: FOUNDER_TODO (Vercel or BetterStack). Backups: document Neon PITR and script a restore test the founder runs | `lib/monitoring.ts`, `docs/operations.md` |

## Phase 2: Pricing and packaging

| Task | Files |
|---|---|
| A single plan config holding the new plans (Free trial with 1 lifetime proposal, Single-bid $149, Starter $99/$990, Pro $249/$2,490, Consultant hidden, Setup add-on $500, private Pilot $299). Each plan has limits, overage price, visibility and an optional GBP `{{GBP_PRICE_*}}`. Legacy tiers (`starter`, `growth`, `agency`) map to grandfathered entitlements with their current limits | `lib/plans.ts` → `lib/pricing/config.ts`, `lib/entitlements.ts` |
| Server-side enforcement from the config: lifetime vs monthly proposals, pass expiry, overage confirmation before generating beyond the limit (the overage is recorded; charging waits on the provider) | upload/extract/draft routes, `lib/ai-guard.ts` |
| Remaining proposals in the dashboard header; upgrade prompts at the limit, at a second live RFP on Free, and at a second proposal on the pass | dashboard components |
| USD default; GBP hidden when unset | pricing components |
| Rewrite the pricing FAQ, adding fair "vs ChatGPT" and "vs DeepRFP / Pelican Bid" answers with no competitor prices | `lib/faqs.ts` |
| Checkout in test mode for each plan: **after the provider decision** | — |

Schema (additive): `Subscription.plan` (new plan ID string, nullable), `Subscription.passExpiresAt`, an `OverageCharge` table, and `User.lifetimeProposals` (or derived by count).

## Phase 3: Product upgrades (in priority order)

1. **Citations and gap flags.** Split library items and RFP text into numbered passages; prompts must cite `[S12]` markers; the server validates the markers and stores `Draft.citations` (JSON: sentence → passage IDs). Sentences without a valid citation are flagged "needs your input". The "ready" state is blocked while gaps remain unless dismissed. Add a coverage view (addressed / partial / missing per requirement). Export has an internal review copy (citations as an appendix) and a clean submission copy.
2. **Formats.**
   - OCR through the AI provider's document input, triggered when the text layer is empty or thin, with a confidence warning.
   - XLSX/CSV questionnaires via `exceljs`: column mapping UI → row-by-row answers → export into the same workbook.
   - Multiple files per bid (`RfpFile` table), re-extraction on an addendum with a diff of new and changed requirements.
3. **Extraction fields:**
   - always: page/word limits, formatting, submission method, deadline and time zone, clarification deadline, weights, attachments, references, key personnel, pricing format, pass/fail;
   - public sector: forms, insurance, bonding, preferences, registrations;
   - commercial: security, SLAs, legal terms, timelines;
   - each with a type tag and source page. No industry hard-coding.
4. **Onboarding and library:** a guided checklist with a progress meter, general templates, optional segment starter sets, and a "draft strength" indicator. Website import (user-initiated, robots.txt respected).
5. **Prompt injection:** hidden-text detection where the parser exposes it (DOCX hidden or white text via mammoth styles; PDF tiny or white text is limited in pdf-parse, so best effort); a fixture set with assertions.
6. **Export validation:** DOCX schema and round-trip checks, a page-limit warning. Letterhead stays off unless it is complete.
7. **Outcome tracking:** fields on `Rfp` (submitted, outcome, contract value, notes, hours saved) and a small dashboard.
8. **Teams:** off (option b).

## Phase 4: Website and conversion

- A new homepage from the supplied copy.
- A config-driven `/for/[segment]` template with it-services, consultancies, service-contractors and consultants pages. `/use-cases/uk-tenders` and `/use-cases/security-questionnaires`.
- `/tools/rfp-checklist`:
  - no signup;
  - per-IP and global daily limits in the database;
  - a file cap;
  - nothing stored after processing;
  - an email-capture CTA.
- SEO:
  - pick one canonical host to match Vercel's primary domain;
  - SEO template pages;
  - fix `plan=agency` (accept `plan=team` as an alias).
- Funnel events stored **in our own database** (`FunnelEvent`, no content and no third party) with `?seg=` attribution persisted through signup, plus an optional industry question at onboarding. Funnel report by segment at `/admin/funnel`.

## Phase 5: Benchmark

`scripts/benchmark/run.ts` reads `benchmark/rfps/*` and `benchmark/gold/*.json`, runs the real extraction, and computes precision, recall and mandatory recall with fuzzy matching, plus time and cost. It writes `benchmark/results/<date>.md`, broken down by segment tag. Scoring is unit-tested; real runs need an AI key and the founder's gold data.

## Phase 6: Final

Full suite, typecheck, lint and build. A manual walkthrough on a preview deployment (the founder, or me with test credentials). FINAL_REPORT.md, FOUNDER_TODO.md.

## Realistic scope note

Phases 1–2 (excluding provider-dependent billing) and the Phase 4 pages are days of work. Phase 3.1–3.2 (citations, OCR, Excel, addenda) are the largest items and will be delivered as separate PRs. Each phase ends with a PR for review rather than a merge.
