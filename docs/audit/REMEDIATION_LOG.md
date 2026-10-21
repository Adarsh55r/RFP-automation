# Remediation log

Every change is repository-local and reversible. No database migration was added. The schema is unchanged.

## Changes by area

### Upload (F-01, F-10)

**New files:**
- `lib/rfp-upload.ts`:
  - `SERVER_UPLOAD_MAX_BYTES` (4 MB);
  - `isAllowedRfpName()`;
  - `looksLikeRfpFile()`, a magic-byte check that is client-safe and uses no Buffer.
- `app/api/rfps/upload/start/route.ts`: checks auth, onboarding, type, size and quota, creates the RFP, and returns a signed upload URL.
- `app/api/rfps/[id]/upload/route.ts`:
  - `POST` completes the upload: it re-checks the stored object and sets `originalFileUrl`;
  - `DELETE` abandons it: it removes the object and the RFP.

**Modified files:**
- `app/api/rfps/upload/route.ts`: returns 413 above 4 MB and checks magic bytes.
- `components/dashboard/rfp-upload-zone.tsx`: uses a direct upload with a progress bar above 4 MB, abandons the upload on failure, and gives errors `role="alert"` so screen readers announce them.
- `lib/rfps.ts`: RFP lists and the upload quota ignore RFPs whose upload never finished (`originalFileUrl` is null).

### File access (F-09)
- New: `app/api/rfps/[id]/file/route.ts`, an owner check followed by a 60 s signed URL and a 302 redirect.
- `app/dashboard/rfps/[id]/page.tsx`: the "Open uploaded file" link now points to that route.
- `lib/setup-status.ts`: new check, "RFP files are private". A public bucket fails it.

### Extraction (F-02, F-03, F-04, F-05, F-07, F-16, F-17)
- `lib/rfp-extract.ts`:
  - `MAX_TEXT_CHARS` 120k → 400k;
  - `prepareExtractionText()`;
  - output 8,192 → 32,768 tokens;
  - `NO_TEXT_MESSAGE`;
  - clearer invalid-JSON message;
  - newlines inside items collapsed.
- New: `lib/extraction-checks.ts`, with deadline, addendum, question-count and wording-coverage checks.
- `app/api/rfps/[id]/extract/route.ts`:
  - `maxDuration = 300`;
  - stale "extracting" recovery;
  - 422 plus refund when there is no text;
  - deterministic flags plus a truncation notice;
  - refund on failure.
- `components/dashboard/rfp-extraction-panel.tsx`: "Extraction did not finish" with a retry button, and flags shown as a list.

### LLM layer (F-03)
- `lib/llm.ts`:
  - `LlmOutputTruncatedError`;
  - `TRUNCATION_MARKER`;
  - a length-stop check for OpenAI, Anthropic and Gemini, both blocking and streaming;
  - specific messages in `friendlyLlmError`.

### Drafting (F-05, F-06, F-08, F-14)
- `lib/ai-guard.ts`: `refundAllowance()`.
- `lib/rfp-draft.ts`: `neutralizePromptTags()`, applied to every untrusted field that goes into a prompt.
- `app/api/rfps/[id]/draft/route.ts`: refunds if nothing was written.
- New: `lib/claim-checks.ts`, credential claim detection.
- `app/dashboard/rfps/[id]/draft/page.tsx`: passes the credentials the library supports.
- `components/dashboard/rfp-draft-view.tsx`:
  - a "Check these credentials" panel;
  - an export confirmation listing placeholders and claims;
  - a stream that ends without `done` is reported as stopped.

### Library (F-15)
- `lib/library.ts`: `LIBRARY_ITEM_MAX_CHARS` (20k) and `LIBRARY_TOTAL_MAX_CHARS` (200k).
- `lib/actions/library.ts`: enforced on create and update.
- `components/dashboard/library-view.tsx`: `maxLength` on the textarea.

### Platform (F-11, F-12)
- `next.config.ts`: exported `securityHeaders`, `headers()`, `poweredByHeader: false`.
- `package.json` and `package-lock.json`:
  - `next` and `eslint-config-next` pinned to `15.5.28`;
  - non-breaking `npm audit fix`;
  - dev dependencies `vitest` and `@prisma/adapter-pg`;
  - scripts `test`, `test:integration` and `eval:ai`.

### Copy (F-13)
- `lib/plans.ts`:
  - "(coming soon)" on seats, letterhead, comments, folders and the approver role;
  - "scans need OCR first";
  - library limit stated as 200,000 characters;
  - Free footer claim removed;
  - Starter export wording.
- `components/marketing/pricing-view.tsx`, `feature-grid.tsx`, `how-it-works.tsx` and `document-transform.tsx`: unsupported claims removed (seats, letterhead and signatory, scans, "never invented").

### Tests and documentation
- `vitest.config.mts`, `tests/helpers/*`, `tests/fixtures/rfps.ts`, `tests/unit/*`, `tests/integration/*` and `tests/eval/ai-quality.eval.test.ts`.
- `README.md`: a "Tests" section.
- `docs/audit/*`: these reports.

## Deploy notes

- No new environment variables. No migration.
- `maxDuration = 300` on extraction needs a Vercel plan that allows 300 s. Hobby allows 60 s (300 s with Fluid compute). The draft route already used it.
- The direct upload sends a `PUT` from the browser to `*.supabase.co`. Signed upload URLs normally need no CORS setup. Confirm with one real upload of more than 5 MB on a preview deployment.

## Owner actions, in order

1. **Review this branch locally.** It is committed but **not pushed**. Approve the push or merge.
2. **Make the `rfp-uploads` bucket private** in Supabase, then deploy.
3. On the preview deployment:
   - upload a 6–20 MB PDF;
   - extract a long RFP;
   - export to Word and PDF;
   - open `/admin/setup` and check that every Core row is green.
4. Run `npm run eval:ai` with an OpenAI key (about $1) and paste the results into AI_QUALITY_EVALUATION.md.
5. Before charging, make billing live, fix the proration FAQ, and either enforce or reword the per-plan library counts.
6. Next improvements, by value:
   - page citations for requirements (O-04);
   - CSP in report-only mode (O-01);
   - OCR (O-02);
   - drafting in a background job (O-05);
   - Next 16 (O-10).

## Rollback

Every change is code only. Reverting the audit commit restores the previous behaviour. The one coupling to note: the new upload routes and `/api/rfps/[id]/file` are used by the UI changes in the same commit.
