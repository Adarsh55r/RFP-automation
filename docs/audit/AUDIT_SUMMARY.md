# DraftBid AI pre-launch audit: summary

Audit date: 2026-10-21 · Branch: `claude/vigilant-lovelace-c999tq` (started from `main` @ `d2d850b`)

## Verdict

**Conditional go for a small, supervised beta.** It is not yet a go for a paid public launch.

A real user can now finish the core workflow on a text-based RFP of up to 25 MB:

1. upload the RFP;
2. extract a compliance checklist;
3. draft from their own library;
4. export to Word or PDF.

The tool now tells the user when its output needs checking instead of failing silently. Before this audit, 17 of 38 workflow tests failed. Several failures would have hit real users in their first week:

- Uploads over 4.5 MB failed.
- Long RFPs were silently cut at 120,000 characters.
- An RFP could get stuck in "extracting" with no way out.
- Every failed AI attempt still used up the user's allowance.

These are fixed and covered by regression tests (52/52 pass).

Four conditions apply before charging money. Each needs access this audit did not have:

1. **Make the `rfp-uploads` Supabase bucket private and confirm it.** After redeploying, the admin **Setup** page shows this.
2. **Upload a file larger than 5 MB on a Vercel preview deployment.** The new direct-to-storage upload is tested against a fake storage client, not real Supabase.
3. **Run `npm run eval:ai` once with a real key and read the drafts.** This measures real extraction and drafting quality, which no one has measured yet (about $1).
4. **Turn on billing.** Stripe is not live, and the pricing page FAQ describes proration that does not exist yet.

## What was checked

| Area | How | Result |
|---|---|---|
| Live site | `curl` / fetch from the audit sandbox | **Blocked.** The sandbox proxy refused the host, so nothing was tested against production |
| Build, typecheck, lint | `npm run build`, `tsc --noEmit`, `eslint .` | Pass (before and after) |
| Workflow tests | New Vitest suite, run against a local Postgres instance with storage, auth and the LLM faked | Baseline 21/38 pass → now 52/52 pass |
| AI quality (real model) | `tests/eval/ai-quality.eval.test.ts` | **Not run.** No API key in the sandbox. The suite is written and skips cleanly |
| Dependencies | `npm audit --omit=dev` | 14 advisories (1 critical, 10 high) → 5 (0 critical, 1 high; it needs Next 16) |
| Authorization | Cross-user tests on every route and server action | No IDOR found. The baseline was already correct |
| Prompt injection | Hostile RFP fixture | Tag breakout fixed. Model-level injection is mitigated, not eliminated |

## Most important changes

- **Large uploads work:** the browser uploads straight to storage through a signed URL. The server checks the file afterwards (type, magic bytes and size).
- **Whole document is read:** extraction reads up to 400,000 characters, and the 32k-token output cap replaces 8k. If a document is still too long, the user is told how much was read.
- **No silent truncation:** when the model hits its length limit, extraction gives a clear error and does not save half the data. A cut-off draft section is visibly marked.
- **Checks you can verify:** after extraction, the deadline is checked against the document, along with addenda that change the due date, the question count and the wording of each requirement. Mismatches appear as a list to review.
- **Honesty guard:** if a draft names a certification (SOC 2, ISO 27001, FedRAMP, …) that is not in the user's library, it is flagged before export.
- **Failed AI attempts are refunded**, and an RFP left stuck in "extracting" can be retried.
- **Security:**
  - original files are served through an owner-checked 60-second link;
  - security headers are added;
  - prompt data tags in documents are neutralised;
  - Next is patched to 15.5.28;
  - the content library is capped.
- **Honest marketing copy:**
  - unbuilt features are marked "(coming soon)";
  - "scans included" is removed (there is no OCR);
  - "unlimited library" is replaced with the real limit;
  - "never invented" is softened.

## Not fixed (see AUDIT_FINDINGS.md, "Open")

- no OCR for scanned PDFs;
- no page or section citations for extracted requirements;
- multi-column PDFs can interleave text;
- no Content-Security-Policy;
- a draft that takes more than 300 s can time out, though finished sections are kept;
- the postcss advisory bundled with Next 15 (it needs Next 16).

## Report index

- [AUDIT_FINDINGS.md](AUDIT_FINDINGS.md): every finding with its evidence, fix, test and status
- [AI_QUALITY_EVALUATION.md](AI_QUALITY_EVALUATION.md): the AI design review, fixtures, deterministic checks and what remains unmeasured
- [SECURITY_REVIEW.md](SECURITY_REVIEW.md): OWASP Web Top 10 and LLM Top 10
- [TEST_RESULTS.md](TEST_RESULTS.md): commands and baseline-vs-final results
- [REMEDIATION_LOG.md](REMEDIATION_LOG.md): file-by-file changes, and the actions left for the owner

## Appendix A: architecture

```
Browser (Next.js App Router pages, Clerk session)
 ├─ /                    marketing, pricing, privacy
 ├─ /onboarding          company profile → User row
 ├─ /dashboard           RFP list, quota, billing (Stripe not live), settings
 ├─ /dashboard/library   content library (server actions, now size-capped)
 ├─ /dashboard/rfps/new  upload: ≤4 MB → /api/rfps/upload
 │                               >4 MB → /api/rfps/upload/start → PUT to Supabase → /api/rfps/[id]/upload
 ├─ /dashboard/rfps/[id] checklist: POST /api/rfps/[id]/extract → editable fields and flags
 │                       original: GET /api/rfps/[id]/file → 60 s signed URL
 ├─ /dashboard/rfps/[id]/draft  POST /api/rfps/[id]/draft (SSE: plan → sections → review)
 │                              GET  /api/rfps/[id]/export?format=docx|pdf
 └─ /admin               ADMIN_EMAILS only: overview, customers, costs, alerts, setup checks

Server: Prisma → Neon Postgres (User, Subscription, Rfp, LibraryItem, Draft, AiUsage)
        Supabase Storage bucket "rfp-uploads" (service role)
        lib/llm.ts → OpenAI GPT-4.1 (Anthropic and Gemini adapters present)
        lib/ai-guard.ts: allowances, monthly $ cap, account lock, hourly limit, cooldown
        Sentry (optional) · Vercel Analytics
```

## Appendix B: feature inventory and verdict

| Feature | Works? | Evidence |
|---|---|---|
| Sign up, onboarding | Yes (Clerk) | Code review. The live site could not be reached |
| Upload PDF/DOCX up to 4 MB | Yes | Integration test |
| Upload 4–25 MB | Yes in tests; **verify on a preview deployment** | Integration test with a fake storage client |
| Scanned PDF | No. A clear OCR message is shown | Test |
| Requirement extraction (type, scope, deadline, mandatory, desirable, evaluation, submission, questions) | Yes, with deterministic flags | Tests with a fake model. **Real accuracy unmeasured** |
| Edit the checklist | Yes | Code review |
| Content library | Yes, capped at 20k per item and 200k in total | Test |
| Full draft (cover letter, summary, approach, team, pricing, Q&A, review) | Yes. Partial failure keeps the finished sections | Test |
| Revise a section with AI | Yes | Code review (same pipeline) |
| Placeholder and credential warnings before export | Yes | Tests (logic); UI by code review |
| Export to DOCX and PDF | Yes | Test parses the real files |
| Billing and plan upgrades | **No.** Stripe not live | Code review |
| Team seats, letterhead, comments, folders | **No.** Now labelled "coming soon" | Code review |
| Admin dashboard and setup checks | Yes | Earlier PRs, plus the setup test |

## Appendix C: UX and accessibility notes

- The static scan found no icon-only buttons without an accessible name. The progress bar has ARIA values.
- The extraction and draft panels use live regions.
- Upload errors were not announced to screen readers; they now have `role="alert"`.
- New guidance in the UI:
  - "Extraction did not finish" with a retry button;
  - flags as a checklist;
  - a credential warning;
  - an export confirmation listing open placeholders and unsupported claims;
  - specific errors for scans, oversized files and cut-off output in place of generic failures.
- Not done: a screen-reader pass, a contrast audit or a mobile pass on the live site. All three need the deployed app.
