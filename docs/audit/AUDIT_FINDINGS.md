# Findings register

Severity:

- **P0**: blocks the core workflow or loses data.
- **P1**: wrong or untrustworthy results, a security exposure, or money lost.
- **P2**: degraded quality or cost risk.
- **P3**: polish.

"Baseline" means the test failed on `d2d850b` before any fix. Test paths are under `tests/`.

## Fixed

### F-01 · P0 · Uploads over 4.5 MB fail in production
- **Evidence:** `integration/upload-export.test.ts`:
  - "explains how to proceed when a file is too big for the server route";
  - "large files: start → direct upload to storage → complete".

  Both failed at baseline.
- **Root cause:** the file went through `POST /api/rfps/upload` as a multipart body. Vercel functions reject request bodies over 4.5 MB, but the UI and plans advertise 25 MB. Public-sector RFPs with attachments are often 5–20 MB.
- **Impact:** users with ordinary tenders saw a generic failure on their very first action.
- **Fix:** files over 4 MB now go straight from the browser to Supabase Storage through a signed upload URL, in three steps:
  1. `POST /api/rfps/upload/start` checks auth, onboarding, type, the 25 MB size limit and the quota, then returns a signed URL;
  2. the browser uploads the file with a progress bar;
  3. `POST /api/rfps/[id]/upload` re-checks the stored object's magic bytes and size.

  An upload that fails is removed by `DELETE`, and an unfinished one never counts toward the quota. The server route still handles small files and returns a clear 413 above 4 MB.
- **Status:** Fixed. The flow is tested against a fake storage client, so it **still needs one real upload on a preview deployment**.

### F-02 · P0 · Long RFPs silently truncated at 120,000 characters
- **Evidence:** `integration/extraction.test.ts`, "reads requirements that sit beyond 120,000 characters" (the fixture has a 10% performance bond near the end). It failed at baseline.
- **Root cause:** the extraction input was sliced at 120k characters with no notice to the user. A 60–80 page RFP easily exceeds that, and the forms, addenda and questionnaires usually sit at the end.
- **Impact:** the checklist missed mandatory requirements, and nothing told the user. This is the worst kind of failure for a compliance tool.
- **Fix:** the limit is now `MAX_TEXT_CHARS = 400_000`, about 100k tokens, well within GPT-4.1's context. Beyond that, a flag reads "only the first N% of this document was read…".
- **Status:** Fixed. Tests: "reads requirements…" and "tells the user when the document is too long".

### F-03 · P0 · Model output cut off at the length limit was ignored
- **Evidence:** `unit/llm-truncation.test.ts`, plus `integration/extraction.test.ts`, "gives a clear error and refunds the attempt when the model output is cut off". Both failed at baseline.
- **Root cause:**
  - `finish_reason: "length"` (OpenAI), `max_tokens` (Anthropic) and `MAX_TOKENS` (Gemini) were never checked.
  - Extraction was capped at 8,192 output tokens, so a 60-question questionnaire plus its requirements could exceed it.
  - The route allowed only 60 s.
- **Impact:**
  - Extraction failed with "invalid JSON".
  - Worse, a draft section could end mid-sentence and still be saved as "ready".
- **Fix:**
  - `lib/llm.ts`: a cut-off JSON call raises `LlmOutputTruncatedError`, which becomes a specific user message. A cut-off text stream gets a visible `[[Incomplete: …]]` marker, which the existing placeholder check catches before export.
  - Extraction now allows 32,768 output tokens and `maxDuration = 300`.
- **Status:** Fixed.

### F-04 · P0 · An RFP can be stuck in "extracting" permanently
- **Evidence:** "recovers an RFP left in 'extracting' by a killed request once the AI lock has expired" failed at baseline.
- **Root cause:** if the function was killed (timeout or deploy), the status stayed `extracting`. Every later attempt then returned 409 "already in progress", and the UI showed a spinner forever.
- **Fix:** an RFP counts as running only while the account's AI lock (`aiBusyUntil`) is in the future; otherwise the extraction is treated as stale and may be retried. The panel shows "Extraction did not finish" with a retry button.
- **Status:** Fixed. "still refuses a second extraction while one is genuinely running" still passes.

### F-05 · P1 · Failed AI attempts consume the user's allowance
- **Evidence:**
  - "gives a clear error and refunds the attempt…";
  - "refunds the full-draft allowance when nothing could be written".

  Both failed at baseline.
- **Root cause:** the per-RFP allowance (Free tier: 2 extractions, 2 full drafts) was taken before the call and never returned.
- **Impact:** two transient OpenAI errors could lock a Free user out of their RFP.
- **Fix:** `refundAllowance()` runs when extraction fails, when there is no text, and when drafting writes nothing. The refund is a conditional decrement, so the count never goes below zero.
- **Status:** Fixed.

### F-06 · P1 · RFP text could break out of the prompt's data blocks
- **Evidence:** "neutralises document text that tries to close the prompt's data blocks" failed at baseline. The prompt-injection fixture contains `</original_document>` followed by instructions.
- **Root cause:** document and library text was placed inside XML-style tags without escaping, so a document could close the tag and look like system-level instructions.
- **Fix:** `neutralizePromptTags()` replaces the `<` of every tag name the prompts use with `‹`. It applies to all untrusted fields: source text, library content, cover fields, revision input and review input.
- **Status:** Fixed for structural breakout. Semantic injection can still influence the model; see SECURITY_REVIEW (LLM01).

### F-07 · P1 · Nothing checked the AI's extraction against the document
- **Evidence:** the four checks in `unit/extraction-checks.test.ts` and `integration/extraction.test.ts` failed at baseline:
  - a deadline that is not in the document;
  - an addendum that changes the due date;
  - 60 numbered questions where 45 were extracted;
  - item wording.
- **Root cause:** the extracted deadline and lists were saved as returned. A wrong deadline is the most expensive single error a bidder can make.
- **Fix:** `lib/extraction-checks.ts` runs four deterministic checks on every extraction and adds plain-English flags:
  - is the deadline present in the text, in any common US, UK, ISO or month-name format?
  - are there several due dates, and does a later addendum date win?
  - were at least 90% of the numbered questions extracted?
  - is each mandatory or desirable item at least 50% grounded in the document's words?

  The flags appear as a list to review.
- **Status:** Fixed. These are heuristics: they flag, they do not correct.

### F-08 · P1 · Drafts could claim certifications the bidder does not have
- **Evidence:** `unit/claim-checks.test.ts`, plus the `LIMITED_LIBRARY` fixture (a firm with no SOC 2, ISO or FedRAMP).
- **Root cause:** the prompts tell the model not to invent credentials, but nothing checked the output. When the RFP demands SOC 2 Type II, the model tends to write that the firm has it.
- **Fix:** `lib/claim-checks.ts` lists about 30 credentials (SOC 2, ISO 27001, FedRAMP, CMMC, Cyber Essentials, HIPAA, 8(a), …). The draft view shows "Check these credentials before you submit" for any credential the draft names but the library does not. The export confirmation repeats the warning.
- **Status:** Fixed as a warning. How often the real model makes the claim is unmeasured; see AI_QUALITY_EVALUATION.

### F-09 · P1 · Original RFP linked by a permanent public URL
- **Evidence:** "only the owner can open the uploaded file, via a short-lived signed link" failed at baseline.
- **Root cause:** the RFP page linked `originalFileUrl`, a Supabase public-object URL.
  - If the bucket is public, anyone holding the URL can read a confidential RFP forever.
  - If the bucket is private, the owner's own link is broken.
- **Fix:**
  - `GET /api/rfps/[id]/file` checks ownership, then redirects to a 60-second signed URL.
  - The admin Setup page now reports a public bucket as **invalid**.
- **Status:** Fixed in code. **Owner action:** confirm the bucket is private.

### F-10 · P1 · Upload type checked by file name only
- **Evidence:** "rejects a file whose content does not match its .pdf name" failed at baseline.
- **Fix:** `looksLikeRfpFile()` checks magic bytes (`%PDF-` in the first 1 KB; `PK\x03\x04` for DOCX) on both upload paths.
- **Status:** Fixed.

### F-11 · P1 · Vulnerable framework version
- **Evidence:** the baseline `npm audit --omit=dev` showed 14 advisories (1 critical, 10 high), including Next 15.5.x advisories.
- **Fix:**
  - `next` and `eslint-config-next` pinned to `15.5.28`;
  - non-breaking `npm audit fix` applied.

  Five advisories remain; see SECURITY_REVIEW (A06).
- **Status:** Fixed where possible without a major upgrade.

### F-12 · P1 · Missing security headers
- **Evidence:** `unit/config.test.ts`.
- **Fix:**
  - `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and HSTS on every route;
  - `poweredByHeader: false`.
- **Status:** Fixed, but there is no CSP yet (O-01).

### F-13 · P1 · Marketing promises features that do not exist
- **Evidence:** a manual read of `lib/plans.ts`, `components/marketing/*` and the pricing FAQ against the code. These were advertised without existing:
  - team seats;
  - letterhead on exports;
  - shared comments;
  - folders;
  - an approver role;
  - "including scans";
  - "unlimited library";
  - "never invented".
- **Impact:** paying customers would find features missing, which costs refunds and trust.
- **Fix:**
  - unbuilt features are marked "(coming soon)";
  - the scan claim is replaced with "scans need OCR first";
  - "unlimited library" is replaced with the real 200,000-character limit;
  - "never invented" becomes "anything it can't support is marked for you to fill instead of guessed".
- **Status:** Fixed. The proration FAQ is still open (O-09).

### F-14 · P1 · Client reports success when the draft stream drops
- **Evidence:** code review of `components/dashboard/rfp-draft-view.tsx`.
- **Root cause:** if the SSE stream ended without a `done` event (a timeout or network loss), the UI treated drafting as finished.
- **Fix:** the client tracks `done`. Without it, the UI says "Drafting stopped before it finished. Sections marked ready were saved; regenerate or revise the rest."
- **Status:** Fixed. No automated UI test; this was a manual code change.

### F-15 · P2 · Content library unbounded
- **Evidence:** the two tests under "content library limits" failed at baseline.
- **Root cause:** the whole library is sent with every drafting call (one plan call, one per section, one per batch of questionnaire answers, and a review call, so 7 or more per draft). A user could paste megabytes, which drives cost and can overflow the context.
- **Fix:**
  - 20,000 characters per item;
  - 200,000 characters in total, titles included;
  - enforced on the server, with `maxLength` in the UI.
- **Status:** Fixed. The per-plan item counts the pricing page lists (3 for Free, 25 for Starter) are still not enforced (O-08).

### F-16 · P2 · Multi-line requirements split into separate items
- **Evidence:** `unit/extraction-checks.test.ts` (parse normalisation).
- **Fix:** `asStringArray` collapses newlines inside an item.
- **Status:** Fixed.

### F-17 · P2 · Scanned PDFs fail with a generic error
- **Evidence:** "explains that scanned/image-only PDFs need OCR…".
- **Fix:** a PDF with no text layer returns 422 with OCR instructions and refunds the attempt; the LLM is not called.
- **Status:** Fixed message. OCR itself is still open (O-02).

### F-18 · P2 · Extraction flags hard to act on
- **Fix:** flags render as a bulleted list with guidance ("Check each item against the RFP before you draft").
- **Status:** Fixed. UI only.

### F-19 · P2 · No automated tests existed
- **Fix:** Vitest harness with a local Postgres instance and fakes for Clerk, Supabase and the LLM. It has 52 tests and synthetic RFP fixtures with golden expectations, plus a gated real-model eval.
- **Status:** Fixed.

## Confirmed correct at baseline (no change needed)

- Cross-user isolation: every route and server action scopes by `userId`, and admin actions refuse non-admins (`integration/authorization.test.ts`, which passed at baseline).
- Markdown rendering escapes HTML. The DOCX export writes `<script>` as literal text.
- Export filenames are sanitised.
- AI spend controls already existed:
  - a monthly cap per tier ($3 for Free, up to $200);
  - one AI task per account;
  - 120 calls per hour;
  - a 60 s cooldown on regeneration.

## Open (documented, not fixed)

| ID | Sev | Issue | Why not now / next step |
|---|---|---|---|
| O-01 | P2 | No Content-Security-Policy | Clerk, Sentry, Vercel Analytics and Supabase need a tested allow-list, and a wrong CSP breaks sign-in. Add it in report-only mode first |
| O-02 | P2 | No OCR | Needs a service (for example Textract or Document AI) and its cost. The UI now explains the workaround |
| O-03 | P2 | Two-column PDFs can interleave lines | A pdf-parse limitation, documented as a known-limitation test. Extracting by layout would need a different parser |
| O-04 | P2 | Extracted requirements have no page or section citation | The biggest remaining trust gap. Needs page-aware text extraction and a schema change |
| O-05 | P2 | A full draft over 300 s may be cut off | Finished sections are kept and the user is told. The AI lock can block retries for up to 6 min. A real fix is a background job |
| O-06 | P3 | An export over 4.5 MB would fail on Vercel | Theoretical. A typical proposal export is 50–300 KB |
| O-07 | P3 | Two uploads at the same moment can pass the monthly quota check | Off by one at most. Fix with a transactional count |
| O-08 | P3 | Library item counts per plan (3 / 25) are advertised but not enforced | Users get more than promised. Enforce or reword when billing goes live |
| O-09 | P1 for billing | Billing not live; the FAQ describes proration | Must be resolved before charging |
| O-10 | P2 | postcss advisory in Next 15; mammoth's argparse/sprintf-js advisories | Needs Next 16. The mammoth issues are in CLI code that is never reached |
| O-11 | P1 to verify | Real-model quality unmeasured | Run `npm run eval:ai` |
| O-12 | P1 to verify | Live site not tested; direct upload not tried against real Supabase | Test on a preview deployment |
