# DraftBid AI upgrade: final report

Branch `claude/vigilant-lovelace-c999tq`, draft PR [Adarsh55r/RFP-automation#17](https://github.com/Adarsh55r/RFP-automation/pull/17). **Nothing has been merged or deployed**, and no live billing, production data or secrets were touched.

**Contents:**
- [Status at a glance](#status-at-a-glance)
- [What changed, by phase](#what-changed-by-phase)
- [How it was verified](#how-it-was-verified)
- [What could not be verified here](#what-could-not-be-verified-here)
- [AI cost per proposal](#ai-cost-per-proposal)
- [Benchmark](#benchmark)
- [Remaining risks](#remaining-risks)
- [Recommended next steps](#recommended-next-steps)

The details of every change and the reasons for it are in `UPGRADE_LOG.md`. Everything only you can supply or decide is in `FOUNDER_TODO.md`.

## Status at a glance

| Phase | Status |
| --- | --- |
| Step 0: audit and plan | Done (`AUDIT.md`, `UPGRADE_PLAN.md`) |
| 1: launch blockers | Done, **except billing tests (1.7): blocked on your choice of payment provider and test keys** |
| 2: pricing from one config | Done, **except checkout: same blocker**. Paid plans are set by an admin until then. |
| 3: product upgrades | Done. One deviation needs your confirmation (no separate "ready" state; see below). |
| 4: website, segment pages, free tool, SEO, funnel | Done. Comparison, sample gallery, testimonials and SEO guide copy wait for your real content. |
| 5: benchmark harness | Done. **No results yet:** it needs your 20 public RFPs, gold lists and an AI key. |
| 6: verification and reports | Done here. A real click-through on a preview deployment is still to do (FOUNDER_TODO). |

Checks at the end: **224 tests in 42 files pass** (integration tests against a local Postgres). Typecheck, lint and the production build are clean, and a migration diff against the schema is empty.

## What changed, by phase

Links go to each commit.

### Step 0 and Phase 1: launch blockers

| Area | Change |
| --- | --- |
| Audit and plan ([d18b6d0](https://github.com/Adarsh55r/RFP-automation/commit/d18b6d0)) | Stack, plans, pipeline, tenant boundaries, 15 unsupported marketing claims, AI cost estimate. |
| Legal and trust pages ([e9a1345](https://github.com/Adarsh55r/RFP-automation/commit/e9a1345)) | Terms, Security, Subprocessors, DPA (with a Word template) and About, plus the footer. All are drafts with an internal note asking for lawyer review (`docs/legal/README.md`). Before merge the placeholders were removed: the pages name only the product and `privacy@draftbidai.com`, with no legal-entity, address or governing-law claims, because there is no registered company. |
| Terms acceptance ([b8a0c03](https://github.com/Adarsh55r/RFP-automation/commit/b8a0c03)) | Clickwrap at sign-up; version and time stored per user; existing users are asked when the version changes. |
| Usage ledger ([dc4ed82](https://github.com/Adarsh55r/RFP-automation/commit/dc4ed82)) | Plan usage counted in a table that survives deletion, so deleting an RFP doesn't give the quota back. |
| Self-service deletion ([d77de29](https://github.com/Adarsh55r/RFP-automation/commit/d77de29), [83db4fb](https://github.com/Adarsh55r/RFP-automation/commit/83db4fb)) | Delete one RFP, or the whole workspace, including its files. |
| Privacy policy ([c0c0171](https://github.com/Adarsh55r/RFP-automation/commit/c0c0171)) | Rewritten to match what the product actually does. Extended later for the free tool, website import and product events. |
| Honest claims ([914ab26](https://github.com/Adarsh55r/RFP-automation/commit/914ab26)) | Outcome claims replaced with factual copy, unshipped features removed from plans, and a guard test that fails on banned claims. |
| Tenant isolation ([541cfac](https://github.com/Adarsh55r/RFP-automation/commit/541cfac)) | Cross-account tests for every data endpoint, extended in later phases to addenda, outcomes, columns and claims. |
| Upload safety ([8d7964f](https://github.com/Adarsh55r/RFP-automation/commit/8d7964f)) | Type checked by content; page, size and zip-bomb limits; encrypted and damaged files refused clearly; macro files refused. |
| Cost controls ([6eda9c4](https://github.com/Adarsh55r/RFP-automation/commit/6eda9c4)) | Daily spend ceiling with an alert, upload rate limit, p95 cost on the admin page, and `npm run report:ai-cost`. |
| Logging and operations ([1eaf4bf](https://github.com/Adarsh55r/RFP-automation/commit/1eaf4bf)) | No document content in logs or Sentry (scrubbers, tested), `/api/health`, and a restore-test script with runbook. |

### Phase 2: pricing ([89434af](https://github.com/Adarsh55r/RFP-automation/commit/89434af))

- **One config:** `lib/plans.ts` is the single source for the pricing page, the billing page, enforcement, the admin pages, structured data and llms.txt.
- **Plans:**
  - Free trial: 1 proposal for the life of the account.
  - Single-bid pass: $149, 30 days.
  - Starter: $99/$990.
  - Pro: $249/$2,490.
  - Consultant: hidden.
  - Paid pilot: $299, private.
  - Setup add-on: $500.
- **Existing paying customers are grandfathered** (`planVersion: legacy`).
- **Overage:** the price is shown and must be confirmed before an extra proposal starts.
- **Usage:** remaining proposals are shown in the header and on the dashboard.
- **GBP:** placeholders, hidden until set.
- **FAQ:** rewritten, including the ChatGPT and DeepRFP/Pelican Bid comparisons.

### Phase 3: product

| Item | Commit | What |
| --- | --- | --- |
| 3.1 Citations | [3414b74](https://github.com/Adarsh55r/RFP-automation/commit/3414b74) | Library passages get `[S#]` IDs; invented markers are dropped. Each citation opens its source passage. Statements about the company with no source are flagged and can be dismissed. Exports come as an internal review copy (sources appendix) or a clean submission copy. |
| 3.2a OCR | [ad23692](https://github.com/Adarsh55r/RFP-automation/commit/ad23692) | Scanned PDFs, and later PNG/JPEG, are read through the AI provider's document input, in 5-page chunks, with `[illegible]` marks and a review flag. Capped by `OCR_MAX_PAGES`. |
| 3.2b Excel/CSV | [7b9774f](https://github.com/Adarsh55r/RFP-automation/commit/7b9774f) | Question and answer columns are detected; the user can correct them. Answers are written back into the buyer's own workbook, keeping styles, dropdowns and formulas. |
| 3.2c Addenda | [7ed96d9](https://github.com/Adarsh55r/RFP-automation/commit/7ed96d9) | Several files per bid; re-extraction with "later overrides" markers; a diff of what changed (deadline, added, changed, removed). |
| 3.3 Key details | [33e49c5](https://github.com/Adarsh55r/RFP-automation/commit/33e49c5) | Industry-neutral categories, Must/Scored tags, and a page number **computed by finding the quote in the document**, not taken from the model. |
| 3.4 First-draft quality | [6cab09e](https://github.com/Adarsh55r/RFP-automation/commit/6cab09e), [67e2fc0](https://github.com/Adarsh55r/RFP-automation/commit/67e2fc0) | Setup checklist; draft-strength rating; general and per-segment templates; past proposals and résumés uploaded into the library; website import (robots.txt, SSRF-safe, hidden text dropped). |
| 3.5 Prompt injection | [172623d](https://github.com/Adarsh55r/RFP-automation/commit/172623d), [67e2fc0](https://github.com/Adarsh55r/RFP-automation/commit/67e2fc0) | Hidden, white, tiny and off-page text removed before the AI reads it, and flagged; text addressed to AI tools flagged; a fixture set including the brief's own payloads. |
| 3.6 Exports | [1b24194](https://github.com/Adarsh55r/RFP-automation/commit/1b24194), [67e2fc0](https://github.com/Adarsh55r/RFP-automation/commit/67e2fc0) | Page-limit check against the RFP's limit; LibreOffice opens the Word, PDF and Excel exports; a 40-section content-loss test. Letterhead stays off (not built). |
| 3.7 Outcomes | [28b687c](https://github.com/Adarsh55r/RFP-automation/commit/28b687c) | Per-bid outcome, value and self-reported hours saved; a private dashboard summary. No public win-rate claims. |
| 3.8 Teams | n/a | Off (option b). |

UI fixes from the visual check: [db49b2d](https://github.com/Adarsh55r/RFP-automation/commit/db49b2d).

### Phase 4: website

| Item | Commit | What |
| --- | --- | --- |
| 4.1–4.2 Pages | [f9dac2a](https://github.com/Adarsh55r/RFP-automation/commit/f9dac2a) | Homepage built from your copy. `/for/[segment]` comes from one config (four segments) and there are two use-case pages. Comparison, samples and testimonials **render only from real content**, so they are hidden until you supply it. |
| 4.3 Free checklist | [830df2d](https://github.com/Adarsh55r/RFP-automation/commit/830df2d) | No account needed; the file is never stored. Limits per visitor (hashed IP), per day and on daily spend. Sign-up, or an email with explicit consent. |
| 4.4 SEO | [f0ad4c8](https://github.com/Adarsh55r/RFP-automation/commit/f0ad4c8) | Canonical host from `NEXT_PUBLIC_SITE_URL` with an opt-in redirect; `plan=agency` mapped to Pro; structured data refreshed; seven guide templates, hidden until written. |
| 4.5 Funnel | [9648800](https://github.com/Adarsh55r/RFP-automation/commit/9648800) | First-party events in our own database (no cookies, IPs or document content); `?seg=` carried through URLs and saved at sign-up, plus an optional industry question; `/admin/funnel` by segment. |

### Phase 5 and 6

- Benchmark harness: [8768044](https://github.com/Adarsh55r/RFP-automation/commit/8768044).
- Main-flow test, plus a workspace-deletion fix it found: [1562b9b](https://github.com/Adarsh55r/RFP-automation/commit/1562b9b).

## How it was verified

- **Automated:**
  - 224 tests: unit, plus integration against a disposable local Postgres with the real migrations applied;
  - only Clerk, Supabase Storage and the AI provider are faked.
- **End-to-end flow** (`tests/integration/main-flow.test.ts`): sign up with Terms, free proposal, a scanned PDF through OCR, checklist confirmed, draft with citations and gaps, Word (clean and review) and PDF export, free-trial limit, upgrade, outcome, then delete the workspace and confirm every row and file for the account is gone.
  - It caught one real bug: funnel events survived workspace deletion. Now fixed.
- **Isolation:** every new endpoint and action has a cross-account test.
- **File formats:**
  - **LibreOffice headless** opens the Word export (converted to PDF and text-checked), the PDF export, and the filled Excel questionnaire;
  - `exceljs` reads the filled workbook back with styles, dropdowns, formulas and other sheets intact.
- **Visual:** a temporary preview page and the real marketing pages were screenshotted at 1280 px and 390 px; two layout bugs were fixed.
- **Database:** an empty migration diff against the schema; every new table and column is also in the idempotent boot-time upgrade.
- **Funnel in development:** the marketing pages' events reached the endpoint in a headless run. Storage of events is proven by the integration tests; the dev server's Neon driver can't write to the local test database.

## What could not be verified here

- **Billing:** checkout, proration, dunning, webhooks and invoices. There is no payment provider yet.
- **Real AI output quality:** how often citations are right, OCR accuracy on real scans, how completely key details are filled, and website import on a real site. Tests use a fake model; the benchmark and a preview run are needed.
- **Microsoft Word, Google Docs and Excel:** not available here. LibreOffice is the only office suite tested.
- **The live site:** the proxy returns 403, so the canonical host (www or apex) couldn't be checked.
- **Production:** backups and restore, uptime, Sentry alerts and the AI provider's data terms. These are runbooks and FOUNDER_TODO items.
- **A click-through with real Clerk, Neon, storage and AI keys.**

## AI cost per proposal

- **Measured:** not available. No production data is reachable from here, and nothing has been deployed. Once deployed:
  - `/admin/costs` shows the **average and p95** per proposal;
  - `npm run report:ai-cost` gives the same against any database;
  - new actions are metered separately (`ocr`, `website_import`, and the free tool's own records).
- **Estimate from code and GPT-4.1 list prices** (`AUDIT.md` §7):
  - a typical proposal costs about **$0.50–0.90**;
  - a worst case (a 400k-character RFP, a 150-question questionnaire, a full library) about **$2.50–3.50** before prompt caching.
- **Additions since the audit:**
  - OCR, about $0.01 a page (at most 40 pages by default);
  - slightly longer extraction output for key details;
  - roughly one extraction per free-checklist run, capped at $25 a day across all visitors.

## Benchmark

**No results.** The harness (`npm run benchmark`, `benchmark/README.md`) is built and its scoring is unit-tested, but it needs your 20 public RFPs, their gold lists and an AI key. The report will state honestly whether mandatory recall reaches the 85% launch target.

## Remaining risks

1. **Preview and production share a database** unless Preview gets its own Neon branch. The boot-time upgrade would then change the production schema from a preview build. It is additive only, but set up the branch first.
2. **Model behaviour:**
   - citation discipline, OCR misreads and website-import faithfulness depend on the real model;
   - the deterministic checks flag problems but can't catch everything;
   - users still have to review every draft, as the product says.
3. **Prompt injection** is reduced, not eliminated. White text in PDFs and text hidden through Word styles are not detected.
4. **Free-tool abuse:** limits are per hashed IP. Rotating IPs can reach the daily global caps (200 runs, $25), which then block genuine visitors for the rest of that day.
5. **Billing not live:**
   - overage, the $149 credit, setup and same-day support must be honoured by hand;
   - paid plans are set by an admin.
6. **Dependency advisory:** the PostCSS issues bundled in Next.js 15 are build-time only. They need a Next.js 16 upgrade.
7. **Legal text** is draft and needs lawyer review before launch.

## Recommended next steps

1. Work through **Before you merge** in `FOUNDER_TODO.md`: a Neon branch for Preview, environment variables, the walkthrough on a preview deployment, and approval.
2. Choose the payment provider and share test keys. Then build checkout and the billing tests (1.7).
3. Make sure `privacy@draftbidai.com` receives mail, and get the lawyer review.
4. Collect 20 public RFPs and gold lists, then run the benchmark and fix the weakest segment first.
5. Replace the hidden placeholders with real content (comparison, sample outputs, guides), and check the segment copy.
6. After launch, watch `/admin/funnel` to choose the segment to double down on, and `/admin/costs` for real average and p95 cost.
