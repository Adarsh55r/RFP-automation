# Upgrade log

What changed and why, newest last. Commits are on branch `claude/vigilant-lovelace-c999tq`.

## Step 0: Audit and plan
- Added `AUDIT.md` (stack, plans and limits, pipeline, tenant boundaries, tests, unsupported claims, AI cost) and `UPGRADE_PLAN.md`.
- Key findings:
  - no payment provider is integrated;
  - users cannot delete RFPs or their workspace;
  - paid plans list unshipped features;
  - there are no Terms, subprocessor, security or DPA pages;
  - Team is uncapped.

## Phase 1.1: Legal and trust pages
- New pages:
  - `/terms` (draft Terms of Service);
  - `/subprocessors` (built from `lib/subprocessors.ts`, which lists every integration in the code and whether this deployment uses it);
  - `/security` (only statements true in the code; says plainly that there is no SOC 2 or ISO 27001);
  - `/dpa` with a Word template download at `/dpa/template`;
  - `/about`.
- Company identity lives in `lib/company.ts` as `{{PLACEHOLDERS}}`. The admin Setup page now flags them as blocking.
- The footer on every public page links Terms, Privacy, Security, Subprocessors, DPA, About and Contact, and shows the legal name and address.
- `docs/legal/README.md` holds the internal note that every legal text is a draft needing a lawyer's review. The pages themselves carry a code comment, not a visible note.
- Why: the audit found no Terms, no legal entity, unnamed AI subprocessors and no DPA; buyers' procurement teams check for these.
- Tests: subprocessor list coverage against `package.json`, the DPA Word file is valid, sitemap and footer links, placeholder detection.

## Phase 1.1: Terms acceptance at signup
- The sign-up page tells people they will accept the Terms and Privacy Policy next.
- Onboarding has a required "I agree to the Terms of Service and the Privacy Policy" checkbox. The server refuses to create a workspace without it and stores `User.termsVersion` and `User.termsAcceptedAt` (additive columns: migration `20261023090000_terms_acceptance`, mirrored in `lib/schema-upgrade.ts`).
- **Existing users** keep all their data. On their next dashboard visit they see a one-time "Please review our Terms" screen and continue after accepting. The same screen appears whenever `TERMS_VERSION` is bumped.
- The workspace-repair path on `/onboarding` (which rebuilds a missing database row from Clerk metadata) no longer counts as acceptance. Saving the workspace moved to `lib/onboarding-store.ts`, so the only callable onboarding action is the one that requires the checkbox.
- Onboarding copy no longer mentions "seats and library folders", which don't exist.
- Limitation: acceptance gates the dashboard UI. API routes don't re-check it; a signed-in user who skipped the screen could still call them directly.

## Phase 1.2b: Users can delete their data
- **Usage ledger** (`ProposalUsage`, additive, backfilled once from existing finished uploads). Each finished upload records one use of the plan in the same transaction. Quota and dashboard counts read the ledger, so deleting an RFP cannot be used to beat the monthly limit.
- **Delete an RFP** (RFP page → "Delete RFP"):
  - removes the stored file, extracted text, requirements and drafts;
  - refused while that RFP's AI task is running;
  - the usage record stays.
- **Delete workspace** (Settings → "Delete workspace", type DELETE):
  - removes every stored file, then the user row, which cascades to the subscription, RFPs, drafts, library, AI-usage and plan-usage records;
  - clears the "onboarding completed" flag in Clerk and signs out;
  - leaves the Clerk sign-in for the user to remove.
- If storage deletion fails, nothing is deleted, so a file is never orphaned without a record.
- Why: the privacy policy promised deletion, but users could not delete anything themselves.
- Tests: owner delete, cross-user refusal, refusal mid-task, workspace delete scope (the other user untouched), backfill idempotency.
- Known gap: a user who deletes the workspace and onboards again gets a fresh Free allowance. To address with Phase 2 trial rules.

## Phase 1.2: Privacy policy
- Rewritten on the shared legal layout and versioned (`PRIVACY_VERSION`).
- Names the operating entity (placeholder) and explains the controller/processor split, linking to the DPA.
- Names every subprocessor and the AI provider (OpenAI by default; Anthropic or Gemini only if configured), and links to `/subprocessors`.
- Retention now matches the code: kept until the user deletes the RFP or workspace, which they can now do themselves; no embeddings; backups, logs and AI-provider retention left as placeholders.
- Removed statements the product doesn't support:
  - teammates;
  - a payment processor holding card data (checkout isn't live);
  - plan-based history retention (never implemented).
- "AI providers do not train on your data" appears only once the founder confirms it (`AI_NO_TRAINING_CONFIRMED`).

## Phase 1.3: Honest marketing claims
- Replaced outcome promises with descriptions of what the product does:
  - hero;
  - positioning strip;
  - feature grid;
  - how-it-works steps;
  - closing CTA;
  - pricing teaser;
  - footer;
  - sign-up title;
  - site tagline, metadata, OG image and llms.txt.
- New hero: "Turn any RFP and your company portfolio into a compliant first draft." The subheadline names what the library actually holds today: case studies, team bios, certifications and past answers. The library doesn't take uploaded documents yet; that comes in Phase 3.4.
- "addenda included" is now "include any addenda in the same file" until multi-file bids ship (Phase 3.2).
- Security questionnaires are no longer implied to work from Excel or to cover named standards.
- Hero mock:
  - "CITY OF MAPLE GROVE" (a real municipality) is now "CITY OF EXAMPLE";
  - the mock is labelled illustrative, and its "Ready to send" badge is now "Ready for your review".
- Plans:
  - every "(coming soon)" item and the unbuilt proposal-history lines are removed;
  - **Team (unlimited) is retired for new customers** (`retired: true`): it's hidden from pricing, llms.txt and structured data, and refused at signup, but existing `agency` accounts keep their name, limits and price.
- Brand: "DraftBid AI" everywhere (checked by grep).
- Guard test `tests/unit/honest-claims.test.ts` fails if outcome promises, "coming soon" plan features or the real place name come back.
- Still to fix in Phase 2: FAQ answers about billing, cancellation and overages, which describe checkout that isn't live.

## Phase 1.4: Tenant isolation tests
- Added cross-user tests for:
  - finishing and abandoning another user's upload;
  - opening another user's file link;
  - settings and Terms actions, which only ever touch the caller's own row;
  - deletion (Phase 1.2b).
- Every data endpoint listed in AUDIT.md §4 now has a cross-user test.
- There is no vector or semantic search today, so retrieval isolation is not applicable yet. It will be tested when citations add passage retrieval (Phase 3.1).

## Phase 1.5: Safer uploads
- `lib/document-safety.ts` adds the following checks, at upload and again when the text is read:
  - **macro-enabled Word files are refused** (a `vbaProject.bin` in the zip);
  - **zip bombs are refused** (over 150 MB declared unpacked size, read from the zip directory without unpacking);
  - **password-protected PDFs** get a clear "remove the password" message;
  - **PDFs over 600 pages** are refused;
  - **damaged files** get a "re-save and upload again" message instead of a generic 500.
- The extraction route returns these as 422s, refunds the attempt and makes no AI call.
- Files are only ever read as text; nothing in them is executed.
- **Not done: malware scanning.** Vercel serverless functions can't run ClamAV, and a scanning service is a new subprocessor and cost, so it's listed in FOUNDER_TODO. Mitigations in place:
  - files are stored privately and only opened through 60-second owner-only links;
  - files are never executed;
  - macro-enabled documents are refused.

## Phase 1.6: Usage caps and cost controls
- **The unlimited Team plan is no longer sold** (Phase 1.3). Existing accounts keep it, but its AI spend stays bounded by the caps below.
- **Daily AI spend ceiling per account** (`dailySpendCapUsd`: Free $3, Starter $8, Growth $20, Team $40), checked before any AI task alongside the existing monthly cap.
  - When it's reached, AI tasks pause until midnight UTC, and one alert per account per day goes to the server log and to `ALERT_WEBHOOK_URL`.
  - Additive column `User.aiDailyAlertDay`.
  - Alerts now carry the account ID only, not the email.
- **Upload rate limit:** 10 upload attempts per account per hour, on both upload paths (429).
- Per-plan monthly proposal limits remain enforced on the server at upload, now counted from the usage ledger.
- **Cost reporting:**
  - `/admin/costs` shows the p95 cost per proposal next to the average;
  - `npm run report:ai-cost` (`scripts/ai-cost-report.mjs`, read-only SQL over `AiUsage`) prints the average, median, p95 and max per proposal, plus a breakdown by pipeline step and model.
  - Verified against seeded data locally. **Measuring production requires running it with the production `DATABASE_URL`**, which this environment does not have.

## Phase 1.8: Logging and data hygiene
- **Server logs:**
  - Every `console.error` now logs `safeErrorSummary(error)`: the error type, code and a message cut to 300 characters, plus stack frames.
  - Why: a failed Prisma write prints the data it tried to write, which can include an RFP's full text, and a JSON error can quote model output. Before this, those would have reached Vercel's logs whole.
- **Sentry:**
  - drops request bodies, cookies and `extra`;
  - truncates exception messages to 300 characters;
  - never records console output as breadcrumbs;
  - keeps only the method, URL and status of network breadcrumbs.
- **Analytics:** Vercel Web Analytics records page views only (URLs contain IDs, never content).
- **Tests:** a static check fails if any server error log bypasses the summariser, plus unit tests for each scrubber.
- **Uptime:** new `GET /api/health` (200 or 503, no details) for an external monitor. Failed jobs are reported to Sentry with area tags; alert rules are set in Sentry (FOUNDER_TODO).
- **Backups:** `docs/operations.md` documents Neon point-in-time restore and the fact that Supabase Storage files are not covered.
- **Restore test: not run.** This environment has no production database access. `scripts/verify-restore.mjs` was only smoke-tested against the local test database (comparing it with itself); the real restore test is in FOUNDER_TODO.

## Phase 2: Pricing and packaging
- **One source of truth:** `lib/plans.ts`. The pricing page, home teaser, signup, upload enforcement, library limits, billing page, admin panel, llms.txt and structured data all read it.
  - Plans:
    - Free trial: 1 proposal, lifetime;
    - Single-bid pass: $149, 1 proposal, 30 days;
    - Starter: $99/mo or $990/yr, 4 a month, 50 library items, $29 per extra;
    - Pro: $249/mo or $2,490/yr, 12 a month, $25 per extra, same-day support, setup included on annual;
    - Consultant: **hidden** until client workspaces exist;
    - Paid pilot: $299, 60 days, **private**;
    - Done-with-you setup add-on: $500.
  - GBP fields are `null` (the `{{GBP_PRICE_*}}` placeholders), and the currency toggle is hidden until all are set.
- **Grandfathering:**
  - a new `Subscription.planVersion` column defaults existing rows to `legacy`;
  - legacy Free (1 a month), Starter ($49, 5 a month), Growth and Team keep their exact terms (`LEGACY_PLANS`);
  - new accounts get `2026-10`;
  - an admin plan change moves the account to current pricing; retired plans can't be re-assigned.
- **Enforcement (server):** `lib/entitlements.ts` computes the allowance per plan period (month, lifetime or pass window) from the usage ledger. `decideUpload` returns:
  - **402** with the price when an overage plan is past its limit;
  - **403** with plan-specific next steps for the trial, a pass, or hard limits.

  The upload proceeds only when the client sends back the exact confirmed price. The confirmed charge is stored on `ProposalUsage.overageCents`, to be invoiced (`overageBilledAt` stays null until billed).
- **UI:**
  - the upload screen shows the overage confirmation;
  - a limit notice replaces the upload box on hard stops;
  - the dashboard header has a "proposals left" badge (streamed in, never blocks the page);
  - the dashboard stat cards show used and remaining for the plan's period;
  - the billing page shows the current plan (labelled grandfathered if legacy), usage, owed overage, the plans (request by email) and the setup add-on;
  - the pricing page has a monthly/annual toggle, a one-time pass, the add-on, and an "On the roadmap" list with no dates.
- **FAQ rewritten:** "vs ChatGPT", "vs DeepRFP or Pelican Bid" (no competitor prices or features asserted), what counts as a proposal, limits and overage, the pass, payment and cancellation, setup, file types.
- **Schema (additive):**
  - enum values `single_bid`, `pro`, `consultant`, `pilot`;
  - `Subscription.planVersion`, `billingCycle`, `accessEndsAt`;
  - `Rfp.overageCents`;
  - `ProposalUsage.overageCents`, `overageBilledAt`.
- **Not done: checkout in test mode.** Blocked on the payment provider decision and keys (FOUNDER_TODO). Paid plans are requested from the billing page and set up by an admin until then.
- Tests: plan config, upload decisions, server enforcement (402, confirm, 403, legacy unchanged), library item limit, admin plan change.

## Phase 3.1: Citations, uncited-claim flags, review vs submission export

- **Source passages:** `lib/citations.ts` splits the content library into numbered passages (`[S1]`, `[S2]`, …, at most about 600 characters each, in a fixed type order). The drafting prompt shows each passage with its ID.
- **Prompt:** a new `<citations>` rule in `DRAFTING_SYSTEM` says to:
  - cite a passage ID after every fact about the bidder;
  - cite only IDs that exist and actually support the claim;
  - never invent certifications, staff, clients, projects, numbers, dates or results, and use `[[Needs your input: …]]` instead.
- **Deterministic check after every section** (`analyzeDraft`, no extra AI call):
  - markers pointing to passages that do not exist are removed;
  - each valid marker's passage is stored as a snapshot (title and excerpt) in the new `Draft.citations` JSON column;
  - sentences and table rows that state a fact about the bidder (numbers, credentials, past work naming a client or place) without a citation are listed as unsupported.

  The heuristic is deliberately conservative: it flags claims for review and never rewrites them.
- **Editing:**
  - saving a section re-runs the check. Existing markers keep their drafted snapshot; markers added by hand are checked against the current library;
  - "I checked it: keep as written" (`setClaimReviewed`) moves a claim to a reviewed list that later checks respect. Ownership is enforced through the RFP's `userId`;
  - AI revisions and the compliance review receive the draft without markers, so the model re-cites against the current library and stale IDs are never reused.
- **UI:**
  - markers render as clickable chips that show the source passage (red if a marker does not match the library);
  - each section shows a "N without a source" badge;
  - "Needs your input" now lists uncited claims under the placeholders;
  - exporting the submission copy asks for explicit confirmation while uncited claims or placeholders remain.
- **Export variants** (`variant=submission|review` on the export route):
  - **Submission:** the default. All markers are stripped and the RFP is marked exported.
  - **Review:** keeps the markers (small and grey), puts an "INTERNAL REVIEW COPY: do not submit" banner at the top and in the footer, and adds a "Review notes" appendix with open items (uncited claims and placeholders) and a "Sources cited" table (marker → library item → passage). It does not change the RFP's status and gets its own file name (`…-review-copy.docx`).
- **Requirement coverage view:** already existed (the compliance review table, plus the optional compliance matrix appendix). It is unchanged.
- **Schema (additive):** `Draft.citations JSONB`, migration `20261025090000_draft_citations`, also in the boot-time `lib/schema-upgrade.ts`.
- **FAQ:** "Will the AI make things up?" now describes citations, flags and the two export copies.
- **Tests:**
  - unit (`tests/unit/citations.test.ts`): passage numbering and splitting, prompt contents, library text cannot forge prompt sections, invalid marker removal, uncited-claim detection including tables and reviewed claims, marker parsing and stripping;
  - integration: the drafting route stores and streams citations; editing re-checks and remembers reviewed claims; another account cannot review claims; both export variants in DOCX and the review PDF; an invalid variant returns 400.
- **Not verified:** the citation chips and checklist UI have not been checked in a browser yet, because dashboard pages need a signed-in Clerk session. They are covered by typecheck and lint only, and a visual pass is planned with the Phase 3 UI work. How often the model cites correctly also needs a real-model run; the Phase 5 benchmark measures it.

## Phase 3.2a: Scanned PDFs (OCR)

- **When it runs:** a PDF whose text layer is empty or thin (under about 80 characters a page, minimum 200) is read with OCR (`lib/ocr.ts`).
- **How it works:**
  - `pdf-lib` splits the scan into 5-page PDFs;
  - each one goes to the configured AI provider as a document (`generateTextFromPdf` in `lib/llm.ts`: OpenAI file input, Anthropic document block, Gemini inline data), at most 3 at a time;
  - there is no new subprocessor: it is the provider that already reads every RFP.
- **The OCR prompt asks the model to:**
  - transcribe verbatim, with page markers;
  - write `[illegible]` instead of guessing names, dates or amounts;
  - transcribe any instructions in the document as text and not follow them.
- **Output:** pages are numbered `--- Page N ---` in the stored source text, which gives later features page references. Every OCR'd extraction carries a review flag ("Scanned document: … read from images … N words marked [illegible] … check names, dates, amounts and reference numbers").
- **Limits:**
  - `OCR_MAX_PAGES` defaults to 40, so OCR and extraction fit the 300-second function limit; `0` turns OCR off;
  - a longer scan gets a clear 422 asking for a searchable or shorter PDF, and no AI is called;
  - a mostly readable PDF with only a little text is kept as is, with a flag;
  - an unreadable OCR result returns the "no readable text" message.
- **Cost:** OCR calls are metered as action `ocr` (about $0.01 a page on GPT-4.1) and count towards the account's spend caps. The extraction attempt is refunded on any failure, as before.
- **Copy:** the FAQ and how-it-works now say scanned PDFs are read with OCR (up to 40 pages, check the results), and OCR is off the pricing roadmap.
- **Tests:**
  - unit: thin-text rule; the text layer is preferred and the AI is never called; page labels when the model omits markers; an unreadable scan;
  - integration: a 7-page scan becomes 2 calls of real 5-page and 2-page PDFs, the transcription reaches extraction, pages are numbered, the `[illegible]` count is flagged; the page limit refuses with no AI call or charge; OCR can be turned off.
- **Not verified:** real OCR quality against a provider. The tests use a fake model; a real scanned RFP needs checking on a preview deployment (FOUNDER_TODO).

## Phase 3.2b: Excel and CSV questionnaires

- **Upload:** `.xlsx` and `.csv` are accepted alongside PDF and Word, through both the server upload and the direct upload. Files are checked by content:
  - `.xlsx` must be a zip, and macro-enabled workbooks are refused by the same zip inspection as Word (macro project and unpacked-size limit);
  - `.csv` must be text (no NUL bytes, not a PDF, executable or zip under another name).

  `.xls` and `.xlsm` are not accepted.
- **Reading (`lib/spreadsheet.ts`):**
  - the workbook is read straight from its XML with `jszip` (shared strings, inline strings, rich text, booleans, several sheets);
  - CSV is parsed per RFC 4180 and detects `,`, `;` or tab;
  - nothing in the file is executed or evaluated.

  The extraction model sees the cells as `Row N: A: … | B: …` text, used for scope, deadline and instructions.
- **Questions come from the rows, not the AI:**
  - the sheet with the most questions is chosen automatically, along with its title row, its question column (titles like "Question" or "Requirement", otherwise the longest text) and its ID column;
  - answers go into a column titled "Response" or "Answer", otherwise the next empty column, otherwise a new column;
  - section-heading rows are skipped: with an ID column, rows without an ID; without one, titles under 4 words that don't end in "?";
  - the RFP's question list is set from these rows, so every drafted answer can go back into its row;
  - a review flag says what was found; at most 400 questions are drafted, and the rest are flagged.
- **Correcting the mapping:**
  - a "Spreadsheet columns" card on the RFP page lets the user pick the sheet, question column, answer column, ID column and title row;
  - `updateSpreadsheetColumns` re-reads the file, checks ownership, refuses an answer column that is also the question or ID column, and replaces the question list;
  - the mapping, including a per-sheet column summary, is stored in the new `Rfp.questionnaireMap` JSON column.
- **Export (`format=sheet`):** the buyer's own file comes back with each answer written into its row.
  - Answers are matched to rows by question text (order does not matter).
  - Markdown becomes plain text, citation markers are removed, and `[[gaps]]` stay visible as `[Confirm: …]`.
  - **xlsx:** only the answer cells' XML is patched; each cell keeps its style. Cells with formulas are never overwritten. Other sheets, fills, dropdowns and formulas are left exactly as they were. A "Response" title is added if the answer column had none.
  - **CSV:** rewritten with the answer column filled, with a UTF-8 byte-order mark for Excel.
  - An `X-Unanswered-Rows` header lets the app tell the user how many rows are still empty.
- **Library choice:** `jszip` is now a direct dependency (it was already used through mammoth). I chose it over the planned `exceljs`, because an `exceljs` round-trip can drop parts of a workbook it doesn't model. `exceljs` is a dev dependency only, used to build and check test workbooks.
- **Draft view:** an "Export answered spreadsheet (.xlsx)" or "Export answered CSV" button, with the same unresolved-items confirmation as the submission copy.
- **Copy:** the FAQ and how-it-works list Excel and CSV; the item is off the pricing roadmap; the security page lists the accepted file types and the macro refusal.
- **Schema (additive):** `Rfp.questionnaireMap JSONB`, migration `20261025100000_questionnaire_map`, plus the boot-time upgrade.
- **Tests:**
  - unit: detection on a styled two-sheet questionnaire; macro refusal; no-header sheets; answer matching (out of order, unanswered rows, gaps kept, markers removed); write-back preserving fill, dropdown, bold title, formula and the other sheet (checked by reading back with `exceljs`); **LibreOffice headless opens the filled workbook and shows the answer**; formula cells are not overwritten; CSV quoting, semicolons and embedded newlines;
  - integration: upload → extraction → stored mapping and questions → export into the workbook; changing columns, including a refused bad choice and another account being refused; the CSV round trip; macro, renamed-executable and fake-xlsx uploads refused; a normal RFP cannot be exported as a spreadsheet.
- **Not verified:** opening the exported file in Microsoft Excel itself (not available here). LibreOffice and `exceljs` both read it. The spreadsheet card and button have not been checked in a browser yet.
