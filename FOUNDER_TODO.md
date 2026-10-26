# Founder to-do

Everything only you can provide or decide. Items marked **blocks launch** must be done before merging to `main` (merging deploys to production).

## Before you merge (merging deploys to production)
- [ ] **Your approval to merge** draft PR #17. Nothing has been merged or deployed.
- [ ] **Schema changes apply on the first start after deploy.** `lib/schema-upgrade.ts` applies them; they are all additive (new columns and tables only, nothing dropped or rewritten):
  - `20261023090000_terms_acceptance`
  - `20261023100000_proposal_usage`
  - `20261023110000_ai_daily_ceiling`
  - `20261024090000_pricing_v2`
  - `20261025090000_draft_citations`
  - `20261025100000_questionnaire_map`
  - `20261025110000_addenda`
  - `20261025120000_key_details`
  - `20261025130000_bid_outcomes`
  - `20261025140000_free_tool`
  - `20261025150000_funnel_events`

  Take a Neon backup or branch first.
- [ ] Give Preview deployments their own Neon branch (below) **before** opening a preview of this branch, so the upgrade runs there first.
- [ ] **Environment variables:**
  - **Set:** `NEXT_PUBLIC_SITE_URL`, `FREE_TOOL_IP_SALT`.
  - **Optional:** `OCR_MAX_PAGES`, `FREE_TOOL_*` limits, `CANONICAL_HOST_REDIRECT`.
  - **Existing:** `OPENAI_API_KEY` and `ADMIN_EMAILS` remain required.
- [ ] **Walk the main flow yourself on the preview:** sign up → free proposal → scanned PDF → checklist → draft with citations → export → limit → upgrade → outcome → delete workspace. The same flow passes as an automated test with Clerk, storage and the AI faked (`tests/integration/main-flow.test.ts`). A real click-through with your keys has not been done.
- [ ] **Confirm one deviation:** the brief said a draft "cannot be marked ready" while gaps remain. There is no "ready" state. Instead, the submission export asks for explicit confirmation while uncited claims, placeholders or unsupported credentials remain, and uncited claims can be dismissed one by one. Say if you want a separate "ready" status.
- [ ] **Dependency advisory:** `npm audit` reports PostCSS issues inside Next.js 15. They were already there before this work, are build-time only, and only touch our own CSS. The only fix is a Next.js 16 upgrade. Decide when to schedule it.

## Company and legal (blocks launch)
DraftBid AI is run by you as an independent founder, with no registered company. The public pages therefore name only the product and one address, `privacy@draftbidai.com`, and make no claims about a legal entity, registered address, company number or governing law. Retention periods and notice periods are worded without invented numbers.
- [ ] **Make sure `privacy@draftbidai.com` receives mail** (for example email forwarding at your domain registrar). It is the contact, privacy and security address on every page, the footer "Contact" link, and the billing and setup request buttons. To use separate addresses, change them in `lib/company.ts`.
- [ ] If you later form a company, add its name, address and governing law to `lib/company.ts`, the Terms, the Privacy Policy and the DPA, and bump the versions in `lib/legal.ts`.
- [ ] Optional, to replace general wording with exact figures: database backup window (Neon → Backup & restore), log retention on your Vercel and Sentry plans, your AI provider's API retention, and the Supabase storage region. The Neon region is shown automatically from `DATABASE_URL`; other regions say "Available on request".
- [ ] Add the payment provider to `lib/subprocessors.ts` before checkout opens (the Privacy Policy promises this).
- [ ] **Lawyer review** of the Terms, Privacy Policy, DPA and subprocessor list (see `docs/legal/README.md`)
- [ ] **AI provider data terms:** from each provider's account settings or contract, confirm that API data is not used for training and note its retention period. Then set `AI_NO_TRAINING_CONFIRMED = true` in `lib/company.ts`. Until then the site does not claim the provider does not train on your data.

## Draft quality
- [ ] **Re-run the Harrison test on a preview deployment** with a real AI key: same library, same RFP and Q&A update. Check that the outline follows the RFP's A–J parts plus Exhibit A, that no price appears that is not in the library or shown as arithmetic, and that the checklist lists anything the fact-check or figure check flagged. The new prompts have only been tested with a scripted model here.
- [ ] Cost note: each full draft now makes one extra small call (the fact-check, on the extraction model), and RFPs with long outlines make more section calls. Watch AI cost per proposal on the admin Costs page for the first week.

## Decisions
- [ ] Brand spelling: "DraftBid AI" (current default) or "DraftBidAI"
- [ ] **Payment provider** (blocks billing work): Stripe, Paddle, Lemon Squeezy or Dodo Payments. Then share **test-mode** keys. Without a registered company, a merchant-of-record provider is usually easier.
- [ ] GBP prices, or drop GBP for now. GBP is hidden until every public price has one; fill the `gbp` values in `lib/plans.ts` (`{{GBP_PRICE_*}}`).
- [ ] Honour these plan promises manually until billing is live:
  - the $149 single-bid credit;
  - the done-with-you setup;
  - same-day support on Pro.
- [ ] Invoice confirmed overage charges: until checkout exists, they're recorded in `ProposalUsage.overageCents` with `overageBilledAt` empty, and shown on the user's billing page.
- [ ] Free-trial abuse: someone who deletes their workspace and signs up again gets a new free trial. Decide whether to keep an anonymised record of used trials.
- [ ] Approval before live payment products and prices are created
- [ ] Team features: keep them off plans (default) or build them now
- [ ] Consultant plan: hidden until client workspaces exist (default) or build them now
- [ ] Test segments: IT services, engineering/professional consultancies, facilities/service contractors (default). Review each landing page's copy.

## Operations
- [ ] Give Vercel **Preview** deployments their own Neon database branch, so preview builds never touch production data or schema
- [ ] Malware scanning for uploads: choose a service (for example a ClamAV worker or a scanning API) or accept the documented risk; see UPGRADE_LOG
- [ ] Uptime monitoring (for example Vercel Monitoring or BetterStack) on `https://draftbidai.com/api/health`
- [ ] Sentry: set `NEXT_PUBLIC_SENTRY_DSN` and add an email alert rule for new issues (failed uploads, extractions and drafts are reported there)
- [ ] Run the restore test in `docs/operations.md` and record the result in UPGRADE_LOG.md
- [ ] Decide on backups for uploaded files in Supabase Storage (not covered by Neon's history)
- [ ] OCR for scanned PDFs is **on** by default for scans of up to 40 pages. It sends page images to the same AI provider that already reads every RFP and costs roughly $0.01 a page on GPT-4.1, recorded as `ocr` in AI costs.
  - Set `OCR_MAX_PAGES` in Vercel to change the limit, or `0` to turn OCR off.
  - If you change it, update the "Which files can I upload?" FAQ (`lib/faqs.ts`).
  - Check one real scanned RFP on a preview deployment before relying on it.
- [ ] Free checklist tool: set `FREE_TOOL_IP_SALT` in Vercel to a random secret. Optionally tune `FREE_TOOL_PER_IP_PER_DAY` (3), `FREE_TOOL_RUNS_PER_DAY` (200) and `FREE_TOOL_SPEND_PER_DAY_USD` ($25).
- [ ] Emails left on the free tool are stored in the `Lead` table, with consent date. Nothing is sent automatically; follow up by hand, and delete on request.
- [ ] Lawyer review should cover the privacy policy additions (free tool, hashed IPs, leads, website import).
- [ ] **One canonical host.** In Vercel → Domains, choose the primary domain (`draftbidai.com` or `www.draftbidai.com`) and set the other to redirect to it (308). Set `NEXT_PUBLIC_SITE_URL` to the primary, e.g. `https://draftbidai.com`, so canonical tags and the sitemap match. Only if you cannot use Vercel's redirect, set `CANONICAL_HOST_REDIRECT=1` instead. Never use both pointing in opposite directions.
- [ ] Write the SEO guides in `lib/guides.ts`: replace each `{{GUIDE_COPY: …}}` and set `published: true`. Until then they are not in the sitemap, are `noindex`, and return 404 in production (visible on previews).

## Manual checks before launch
- [ ] Open one exported proposal (.docx) in Microsoft Word and in Google Docs, and one answered questionnaire (.xlsx) in Excel. LibreOffice opens all of them in the automated tests, but Word, Docs and Excel are not available here.
- [ ] Run one real scanned RFP (OCR) and one real website import on a preview deployment.

## Content
- [ ] **Review the segment landing page copy** in `lib/segments.ts`: headline, subheadline, pains, checklist items and "upload first" list for `/for/it-services`, `/for/consultancies`, `/for/service-contractors` and `/for/consultants`. These are first drafts. Swap or add segments by editing that file; no code changes are needed.
- [ ] Review the use-case pages `/use-cases/uk-tenders` and `/use-cases/security-questionnaires`.
- [ ] **How it compares** (`COMPARISON` in `lib/marketing-content.ts`): run one real public RFP through ChatGPT and DraftBid AI, publish both outputs, and fill in the rows. The section stays hidden until then.
- [ ] **Sample outputs** (`SAMPLE_OUTPUTS`, and `sampleOutput` per segment): three drafts from public RFPs, one per segment. Hidden until supplied.
- [ ] 20 public RFPs across the segments, with gold requirement lists, for the benchmark
- [ ] 3 public RFPs (one per segment) for the sample-output gallery
- [ ] Real, permissioned testimonials once pilots exist

## Stop throwaway sign-ups (Clerk dashboard, about 2 minutes)

Each new email gets one free proposal, so make new accounts harder to fake. In the Clerk dashboard, under the sign-up restrictions / protection settings:

- [ ] Turn on **Block disposable email addresses** (included on every plan, off by default).
- [ ] Turn on **Block email subaddresses** (stops `you+1@gmail.com`, `you+2@…` and Gmail dot variations of an inbox that already has an account).
- [ ] Check **Bot sign-up protection** is on.

The app also limits free accounts together to $10 of AI a day (`FREE_TIER_DAILY_BUDGET_USD` in lib/ai-guard.ts). If that alert arrives, look for a burst of new sign-ups in the admin panel.
