# Test results

Environment: Node 22.22.0, Vitest 3.2.7, PostgreSQL 16 (local, throwaway). Clerk, Supabase Storage and the LLM are faked, so the suite makes no network calls and costs nothing.

## Commands

```bash
npx tsc --noEmit
npx eslint .
npm run build        # placeholder env vars, no real services
npm audit --omit=dev
npm test                                                                       # DB tests skipped
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/draftwin_test npm test  # full suite
npm run eval:ai      # real model; needs OPENAI_API_KEY
```

## Summary

| Check | Baseline (`d2d850b`) | Final |
|---|---|---|
| Typecheck | Pass | Pass |
| Lint | Pass | Pass |
| Production build | Pass | Pass (see note) |
| `npm audit --omit=dev` | 14 advisories: 1 critical, 10 high, 3 moderate | 5 advisories: 0 critical, 1 high, 4 moderate |
| Test suite, full (with DB) | 21 of 38 passing; **17 failing** | **52 of 52 passing** |
| Test suite, no DB | n/a | 22 passed, 30 skipped (by design) |
| Real-model eval (8 tests) | n/a | **NOT RUN.** Blocked: no `OPENAI_API_KEY`. The suite skips cleanly |
| Live site checks | **BLOCKED**: proxy 403 / DNS failure from the sandbox | **BLOCKED** |
| Direct upload against real Supabase | n/a | **NOT RUN.** Needs a preview deployment |

**Build note:** the first final build failed. `lib/actions/library.ts` is a `"use server"` file, and the audit's own change had exported constants from it. The constants were moved to `lib/library.ts` and the build passed. Typecheck and tests had not caught this; only the build did.

**How the baseline was measured:** the 38 workflow tests were written first against the unmodified code. They define correct behaviour; none was weakened to pass later. Five expectations were corrected while fixing, each because the *test* was wrong, not the product:

- PDF text wraps lines, so whitespace is now normalised before comparing.
- The DOCX export intentionally renders `[[x]]` as `[Confirm: x]`.
- One test matched an exact error message where only its meaning matters, so it now uses a regex.
- One test reused a fixture whose Kentucky licence requirement is absent from the security questionnaire. The product correctly flagged it, so the test setup was fixed.
- The library total-limit test used items that also hit the per-item limit; they are now 19,900 characters.

The 14 tests added later cover the new deterministic checks and the security headers.

## Tests failing at baseline, all passing now

| Test | Finding |
|---|---|
| extraction › reads requirements that sit beyond 120,000 characters in a long RFP | F-02 |
| extraction › tells the user when the document is too long to read in full | F-02 |
| extraction › flags a deadline that does not appear anywhere in the document | F-07 |
| extraction › flags when fewer questions were extracted than the document numbers | F-07 |
| extraction › gives a clear error and refunds the attempt when the model output is cut off | F-03, F-05 |
| extraction › recovers an RFP left in 'extracting' by a killed request once the AI lock has expired | F-04 |
| upload › rejects a file whose content does not match its .pdf name | F-10 |
| upload › explains how to proceed when a file is too big for the server route | F-01 |
| upload › large files: start → direct upload to storage → complete | F-01 |
| upload › an abandoned direct upload does not use up the monthly quota | F-01 |
| library › rejects a single item that is too long to be useful in a prompt | F-15 |
| library › rejects new items once the library's total size limit is reached | F-15 |
| file access › only the owner can open the uploaded file, via a short-lived signed link | F-09 |
| drafting › refunds the full-draft allowance when nothing could be written | F-05 |
| drafting › neutralises document text that tries to close the prompt's data blocks | F-06 |
| LLM › a structured (JSON) call that was cut off raises a clear, specific error | F-03 |
| LLM › a streamed section that was cut off ends with a visible placeholder, not a silent stop | F-03 |

## Passing at baseline, still passing (regression guard)

- **Authorization:**
  - routes return 404 for another user's RFP;
  - server actions refuse other users' records;
  - unauthenticated requests are rejected;
  - admin actions refuse non-admins.
- **Extraction:**
  - stores the requirements and the full source text;
  - refuses a second, concurrent run;
  - gives an OCR message for scans.
- **Drafting:**
  - every section is streamed and saved, with the compliance review;
  - partial failure keeps the finished sections;
  - a 60-question questionnaire is answered in order.
- **Export:**
  - the DOCX is real and contains the text, table, placeholder and literal `<script>`;
  - the PDF is real;
  - export is refused when nothing has been drafted.
- **Upload:** a small DOCX via the server route.
- **Parsing:**
  - DOCX facts survive;
  - PDF facts survive;
  - known two-column limitation;
  - unsupported type rejected;
  - corrupted PDF throws.
- **LLM:**
  - complete output is unchanged;
  - a normal stream gets no marker.

## Added after baseline (all passing)

- **`unit/extraction-checks.test.ts` (8):**
  - deadline in words accepted;
  - addendum deadline accepted;
  - hallucinated deadline flagged;
  - conflicting dates flagged;
  - dropped questions flagged;
  - complete questions not flagged;
  - ungrounded requirement flagged;
  - multi-line item kept whole.
- **`unit/claim-checks.test.ts` (4):**
  - unsupported credential flagged;
  - supported credential not flagged;
  - placeholder ignored;
  - spelling variants matched.
- **`unit/config.test.ts` (1):** security headers on every route.
- **`integration/setup-status.test.ts` (1):** a public bucket is flagged as invalid.

## Not covered by automated tests

- **UI behaviour:**
  - the "Extraction did not finish" retry button;
  - the flag list;
  - the credential warning panel;
  - the export confirmation text;
  - the upload progress bar;
  - the error shown when the draft stream ends without `done`.

  The logic behind each is tested where it lives on the server; the React rendering is not. The changes typecheck and build.
- Real Supabase signed upload (CORS and size limits on the actual project).
- Real model quality (see AI_QUALITY_EVALUATION.md).
- Accessibility with a screen reader.
