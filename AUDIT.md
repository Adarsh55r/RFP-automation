# DraftBid AI: Step 0 audit

Date: 2026-10-23 · Base: `main` @ `6c8ace9`

Everything below comes from reading the repository. "Not determinable from the repo" means it lives in a dashboard (Vercel, Neon, Supabase, Clerk, OpenAI) that this audit cannot see.

## 1. Stack

| Concern | What the code uses | Evidence |
|---|---|---|
| Framework / hosting | Next.js 15.5.28 (App Router), React 19, deployed on Vercel | `package.json`, `next.config.ts`, `VERCEL_*` env reads |
| Auth | Clerk (`@clerk/nextjs` 7). Middleware protects `/dashboard`, `/onboarding` and `/admin`. Admins are allow-listed by email in `ADMIN_EMAILS` | `middleware.ts`, `lib/admin.ts` |
| Database | Postgres on Neon through Prisma 7 with `@prisma/adapter-neon` (WebSocket pool). Schema is applied at boot by `lib/schema-upgrade.ts` (idempotent SQL) because migrations are not run at build | `lib/db.ts`, `prisma/schema.prisma`, `instrumentation.ts` |
| File storage | Supabase Storage, bucket `rfp-uploads`, accessed with the service-role key. Files open through 60-second signed URLs; uploads over 4 MB use signed upload URLs | `lib/supabase/admin.ts`, `app/api/rfps/**` |
| **Payments** | **None.** There is no Stripe or other payment SDK. `Subscription.tier` is changed only by hand (`adminSetPlan`). The billing page says "Paid checkout is not live yet" | `package.json`, `app/dashboard/billing/page.tsx`, `lib/actions/admin.ts` |
| AI | `lib/llm.ts` picks **OpenAI** whenever `OPENAI_API_KEY` is set (default `gpt-4.1` for both extraction and drafting); otherwise **Anthropic** (`claude-haiku-5-5` extraction / `claude-opus-5-5` drafting) or **Google Gemini** (`gemini-3.5-flash`). Calls are direct SDK calls (JSON mode for extraction and plan; streaming for sections). There are no embeddings and no vector store: drafting sends the whole library in every prompt | `lib/llm.ts`, `lib/openai.ts`, `lib/anthropic.ts`, `lib/gemini.ts`, `lib/rfp-draft.ts` |
| Error monitoring | Sentry (`@sentry/nextjs` 11), off until `NEXT_PUBLIC_SENTRY_DSN` is set. Errors only, no tracing or replay, `sendDefaultPii: false`; `beforeSend` strips request bodies and cookies | `lib/monitoring.ts`, `sentry.*.config.ts` |
| Analytics | Vercel Web Analytics (cookie-free page views). No product events | `app/layout.tsx` |
| Alerts | Optional Slack-style `ALERT_WEBHOOK_URL` when an account hits its monthly AI spend cap | `lib/ai-guard.ts` |
| Email | No transactional email provider. Clerk sends auth emails | — |

Not determinable from the repo:
- the Vercel function region;
- the Neon region and backup/PITR settings;
- the Supabase region and bucket privacy (the admin Setup page now checks privacy);
- which AI provider key is set in production;
- each provider's data-retention and no-training terms on the account.

## 2. Plans, limits and seats today

- **Plan catalogue:** `lib/plans.ts` covers Free, Starter ($49), Growth ($149) and Team ($349, id `agency`), in USD and GBP. It is display only, used by the pricing page, the home teaser, the billing page, `llms.txt` and the structured data.
- **Enforcement:**
  - `lib/plan-limits.ts`: monthly uploads per tier are free 1, starter 5, growth 20, agency **unlimited**. They are enforced at upload (`getRfpUploadQuota`).
  - `lib/ai-guard.ts`:
    - per-RFP allowances (Free: 2 extractions, 2 full drafts, 10 revisions; paid: 3, 4, 20);
    - a **monthly AI $ cap** per tier (3 / 15 / 60 / 200);
    - one AI job per account (6-minute lock);
    - 120 AI calls per hour;
    - a 60 s regeneration cooldown;
    - refunds on failure.
- **Not enforced:**
  - library item counts (Free 3, Starter 25);
  - proposal-history retention (90 days / 12 months);
  - seats (no teams, invitations or roles exist at all);
  - support levels.
- **Billing state:**
  - `Subscription` has `tier`, `status` and `stripeSubscriptionId` (always null) and `currentPeriodEnd`;
  - no webhooks, proration, dunning or invoices;
  - the signup `?plan=` choice is stored as an *intended* plan (cookie and Clerk `unsafeMetadata`) and never charged;
  - the Team CTA links to `/sign-up?plan=agency`.
- **Consequence for "grandfathering":** nobody has ever been charged. The existing tiers in the database were set by the founder by hand. Protecting existing users means keeping `starter`, `growth` and `agency` rows working, with the limits they have today.

## 3. Document pipeline

1. **Upload:**
   - files of 4 MB or less: `POST /api/rfps/upload` (multipart);
   - larger files: `POST /api/rfps/upload/start` → browser `PUT` to the signed Supabase URL → `POST /api/rfps/[id]/upload`.
   - Allowed: `.pdf` and `.docx` up to 25 MB, with the magic bytes checked. Monthly quota applies.
2. **Parse (`lib/rfp-extract.ts`):**
   - PDF via `pdf-parse`/`unpdf`, DOCX via `mammoth` (raw text, no macros executed);
   - no OCR (an empty text layer returns a 422 with guidance);
   - no XLSX/CSV;
   - one file per RFP: addenda must be in the same file.
3. **Requirement extraction:**
   - one JSON call over up to 400k characters. Fields: document type, scope, deadline, eligibility (mandatory), desirable, evaluation criteria, submission requirements, questionnaire items, flags.
   - Deterministic checks (`lib/extraction-checks.ts`): the deadline appears in the text, addendum dates, question count, wording coverage.
   - The full text is stored in `Rfp.sourceText`.
   - **No page/section references** are stored.
4. **Review:** the user edits and confirms the checklist (`confirmExtraction`).
5. **Drafting (`POST /api/rfps/[id]/draft`, SSE):**
   - a plan call (JSON), then one streamed call per section (cover letter, executive summary, approach, team, pricing), questionnaire answers in batches of 15 (3 at a time), and a compliance-review call;
   - context = extracted requirements, source text (first 150k characters) and the **whole library** (up to 200k characters);
   - untrusted prompt tags are neutralised;
   - gaps are written as `[[placeholder]]`;
   - credential claims are checked against the library (`lib/claim-checks.ts`) and shown as a warning;
   - coverage map stored in `Rfp.coverageMap`.
   - **No per-claim citations.**
6. **Revise:** a per-section "Revise with AI" (revision allowance).
7. **Export (`POST /api/rfps/[id]/export`):**
   - DOCX (`docx`) and PDF (`pdfmake`): cover page, contents, page numbers, tables, placeholders rendered as `[Confirm: …]`;
   - an optional compliance-matrix appendix.

## 4. Tenant boundaries

- **Model:** there are no workspaces or organisations. Every customer object hangs off `User.id` (`Rfp.userId`, `LibraryItem.userId`, `AiUsage.userId`, `Draft → Rfp`). The boundary is the Clerk user, resolved on the server from `auth()`; IDs from the client are always combined with `userId` in the query.
- **Routes and actions that read or write customer data:**

| Kind | Endpoint | Scoping | Tested cross-user? |
|---|---|---|---|
| API | `POST /api/rfps/upload`, `POST /api/rfps/upload/start` | creates under the caller | 401 when signed out |
| API | `POST/DELETE /api/rfps/[id]/upload` | `findFirst({id, userId})` | no (add) |
| API | `GET /api/rfps/[id]/file` | owner check → signed URL | yes |
| API | `POST /api/rfps/[id]/extract` | `findFirst({id, userId})` | yes |
| API | `POST /api/rfps/[id]/draft` | `findFirst({id, userId})` | yes |
| API | `POST /api/rfps/[id]/export` | `findFirst({id, userId})` | yes |
| Action | `confirmExtraction`, `saveDraftSection`, `saveCoverDetails` | `userId` filter | yes |
| Action | `createLibraryItem` / `updateLibraryItem` / `deleteLibraryItem` | `userId` filter | update and delete yes |
| Action | `completeOnboarding`, `updateAgencySettings`, `claimReviewPrompt`, `respondToReviewPrompt` | own row by `clerkId` | no (own row only) |
| Action | `adminSetPlan`, `adminResetAllowance`, `adminUnlockAi`, `adminResetReviewPrompt` | `assertAdmin()` | yes (non-admin refused) |
| Pages | dashboard home, RFP list, RFP detail, draft, library, billing, settings | `requireDashboardUser()` / Clerk ID filter | home, list, library and detail yes |
| Pages | `/admin/*` | `requireAdminPage()` (404 otherwise) | via actions |

- **Gaps:**
  - no test for cross-user `upload` complete/abandon or `createLibraryItem` quotas;
  - no vector search exists, so the "retrieval isolation" requirement is not applicable yet, but it must hold when citations or retrieval are added;
  - **no way for a user to delete an RFP, a workspace or an account** (deletion is manual, by email);
  - deleting the Clerk user does not delete app data (there is no Clerk webhook).

## 5. Tests

- **Coverage:** 61 tests (Vitest), with the integration tests running against a throwaway local Postgres and fake Clerk, Supabase and LLM:
  - authorization/IDOR;
  - extraction (long documents, truncation, stale-lock recovery, OCR message, deterministic flags);
  - drafting (all sections, partial failure, refunds, 60 questions, prompt-tag injection);
  - upload (size and magic bytes, direct-upload flow, quota);
  - export (real DOCX/PDF parsed back);
  - library caps;
  - setup status;
  - dashboard data loading;
  - SEO files;
  - parsing;
  - claim checks;
  - security headers.

  A gated real-model eval exists (`npm run eval:ai`) but has never been run (no key in CI or the sandbox).
- **Gaps:**
  - no CI workflow in the repo (tests run only locally);
  - no billing tests (no billing);
  - no UI/e2e tests;
  - no real-model accuracy numbers;
  - no tests for the onboarding/settings actions;
  - no load test.

## 6. Marketing claims the code does not support

Each claim is followed by why the code doesn't support it.

1. **"Win more RFPs — without a bid team."**: an outcome promise.
   - Appears in: hero `h1` (`hero.tsx`), root metadata/OG (`app/layout.tsx`), `SITE_TAGLINE` (`lib/site.ts`, used in `llms.txt` and the OG image), the footer tagline "Win more RFPs in a fraction of the time" (`site-footer.tsx`), and the sign-up title "Start winning more RFPs" (`sign-up-view.tsx`).
2. **"the bid team you can't afford to hire … so a five-person company can answer like a fifty-person one"** (`positioning-strip.tsx`): an outcome/comparison claim.
3. **"Small teams rarely lose RFPs on price"** (`positioning-strip.tsx`): an unsourced market claim.
4. **"get a compliant first draft in minutes … checked against every requirement, with every gap flagged"** (hero): the absolutes "every" and "compliant" can't be guaranteed, and time is not measured. Same for the FAQ's "Usually one to three minutes" and sign-up's "your first draft is minutes away".
5. **"addenda included"** (`how-it-works.tsx`): only one file per RFP. Addenda work only if merged into the same file.
6. **"Handles … security questionnaires (SOC 2, ISO 27001, Cyber Essentials, HIPAA)"** (`feature-grid.tsx`): those questionnaires usually arrive as Excel, which is not accepted. "Every draft matches the buyer's spelling, currency, and terminology" is a prompt instruction, not a guarantee.
7. **"Sounds like you — not like AI"** (`feature-grid.tsx`): unverifiable.
8. **The hero mock names "CITY OF MAPLE GROVE"** (`document-transform.tsx`), a real municipality, and is not labelled as illustrative.
9. **Paid plan features that are not shipped** (`lib/plans.ts`):
   - team seats (2/5/15);
   - letterhead on exports;
   - shared comments;
   - shared library with folders;
   - approver step.

   All are marked "(coming soon)" but listed in what a customer pays for.
10. **Plan features not enforced or not operated by the code:**
    - library counts (3 / 25);
    - proposal history of 90 days / 12 months / "full";
    - "Same-day email support (US & UK hours)", "Priority support", "Onboarding call", "Email support next business day";
    - Team "Unlimited proposals" (uncapped uploads; AI spend capped only by the $200/month guard).
11. **Pricing metadata** (`app/pricing/page.tsx`): "two months free on annual billing", but there is no billing.
12. **FAQ** (`lib/faqs.ts`):
    - cancellation, annual prepay, card billing, itemised invoices, VAT reverse charge, US sales tax and "Upgrades take effect immediately and we charge the difference": **no billing exists**;
    - "What happens if I go over my RFP limit?" says drafts pause: actually **uploads** are blocked, and "Upgrade in place" is not possible;
    - "Neither we nor our AI providers train models on your documents": depends on provider terms the founder must confirm;
    - "deletion removes source files and generated drafts": manual only, with no code path.
13. **Privacy policy** (`app/privacy/page.tsx`):
    - "AI model providers" are not named;
    - "Teammates only see what your company account is set up to show them" (no teammates exist);
    - "Our payment processor handles card data" (none exists);
    - "Proposal history retention follows your plan (90 days … 12 months)" (not implemented);
    - "Source files and drafts are removed when you delete them" (users cannot delete RFPs or drafts);
    - no legal entity named.
14. **Missing trust pages:**
    - no Terms of Service;
    - no subprocessor list;
    - no security page;
    - no DPA;
    - no About page;
    - no legal entity anywhere;
    - no signup acceptance of terms.
15. **`?plan=agency`** is exposed in the Team CTA URL (internal ID leak; cosmetic).

## 7. AI cost per proposal

- **Instrumentation exists:**
  - every model call is recorded in `AiUsage` (provider, model, input/cached/output tokens, cost in micro-dollars, `rfpId` and action);
  - `/admin/costs` shows the **average** cost per proposal;
  - p95 is **not** computed;
  - no document content is logged.
- **Derived from the code** (GPT-4.1 list prices hard-coded in `lib/ai-usage.ts`: $2 in / $0.50 cached / $8 out per 1M tokens):

| Step | Calls | Input per call | Output cap |
|---|---|---|---|
| Extraction | 1 | document text, up to 400k characters (~100k tokens) | 32,768 |
| Plan | 1 | requirements + source (≤150k characters) + library (≤200k characters) | 8,000 |
| Narrative sections | up to 5 | same context + plan | per section |
| Questionnaire batches | ⌈questions / 15⌉ | same context + plan + batch | per batch |
| Review | 1 | plan + drafted text | 16,000 |

- **Estimates (not measured):**
  - typical proposal (a 50-page RFP, 15 questions, a small library): ~8 calls, **≈ $0.50–0.90**;
  - worst case (a 400k-character RFP, a 150-question questionnaire, a full 200k-character library): ~15 calls, ≈1.3M input tokens, **≈ $2.50–3.50** before OpenAI prompt caching.
- **Missing:**
  - a measured average and p95 from production. The founder must run the report script (Phase 1.6) against production, which this audit cannot reach;
  - a per-account daily ceiling (only monthly exists).
