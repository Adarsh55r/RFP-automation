# Security review

**Scope:** source review plus local tests. No intrusive testing was run against the deployed site or third parties. The live site could not be reached from the audit sandbox, so production configuration was **not verified**: headers, bucket privacy and environment variables.

**Secrets:** tracked files and the full git history were scanned for OpenAI, Stripe, Clerk-live, AWS, JWT and Postgres-with-password patterns. The only matches were in `.env.example` lines 12 and 14, and both are placeholders (`USER` and an `ep-xxx` host). **No live secrets were found.** No secret values appear in this report.

## Trust boundaries

```
Browser ──Clerk session──▶ Next.js on Vercel ──service role──▶ Supabase Storage (rfp-uploads)
   │                         │   └──Prisma──▶ Neon Postgres
   └──signed upload URL──────┼──────────────▶ Supabase Storage (direct PUT, files over 4 MB)
                             └──API key──▶ OpenAI (RFP text and library = untrusted data)
```

Untrusted inputs:

- the uploaded file and its text;
- library entries;
- revision instructions;
- the model's output.

## OWASP Top 10 (2021)

| # | Area | Finding | Status |
|---|---|---|---|
| A01 | Broken access control | Every route handler and server action looks up records with `{ id, userId }`. Tests prove another user gets 404 and an unauthenticated request gets 401 (`authorization.test.ts`). `/admin` requires Clerk plus `ADMIN_EMAILS`, and admin actions recheck it. The original file was linked by a permanent public URL; it now goes through an owner-checked 60 s signed URL (F-09). The direct upload "complete" step checks that the RFP belongs to the caller and that the stored object sits under that RFP's path | OK / fixed |
| A02 | Cryptographic failures | TLS everywhere, and HSTS has been added. Storage and the database are encrypted at rest by the providers. No custom crypto | OK |
| A03 | Injection | Prisma parameterises all queries, and `TRUNCATE` exists only in test helpers. Markdown uses a parser and never `dangerouslySetInnerHTML`. The DOCX export writes `<script>` as text (tested). Prompt injection is covered under LLM01 | OK |
| A04 | Insecure design | Free-tier abuse is bounded by the per-RFP allowance, a monthly $ cap, one AI job per account, 120 calls per hour, a monthly upload quota and the library size cap (new). A quota race allows at most one extra upload (O-07) | OK / minor open |
| A05 | Security misconfiguration | Security headers were missing; `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS and `poweredByHeader: false` are now added (F-12). **No CSP** (O-01). Bucket privacy is unknown, so the Setup page now checks it | Partly open |
| A06 | Vulnerable components | Baseline: 14 production advisories (1 critical, 10 high). Next was patched to 15.5.28 and `npm audit fix` applied, leaving 5: postcss (high, bundled with Next, needs Next 16) and mammoth → argparse/sprintf-js (moderate; in mammoth's CLI, not reachable from `extractRawText`) | Reduced; residual accepted |
| A07 | Authentication | Clerk handles it, and middleware protects `/dashboard`, `/onboarding` and `/admin`. API routes call `auth()` themselves | OK |
| A08 | Integrity | File type was checked by name only; magic bytes are now checked on both upload paths, and the direct-upload object is re-checked server-side (F-10). The lockfile is committed and Next is pinned exactly | Fixed |
| A09 | Logging and monitoring | Sentry captures errors when a DSN is configured, tagged with area, user ID and RFP ID; document text is never attached as context, although an error message could quote it. AI usage is recorded per call | OK |
| A10 | SSRF | The server fetches only its own storage paths, built from database values, never from a URL the user supplies | OK |

## OWASP Top 10 for LLM applications (2025)

| # | Risk | Assessment | Status |
|---|---|---|---|
| LLM01 | Prompt injection | Untrusted text sits in tagged data blocks, and the system prompt says to treat the blocks as data. A document could previously close a tag and inject "instructions"; all prompt tag names in untrusted text are now neutralised (F-06, tested). **Residual:** natural-language injection inside the data can still sway the model. The mitigations are human review before export, the deterministic checks (F-07, F-08), and the model having no tools, network or write access | Mitigated |
| LLM02 | Sensitive information disclosure | Each prompt holds only one user's data. Document text is not attached to logs or Sentry events | OK |
| LLM03 | Supply chain | First-party SDKs (OpenAI, Anthropic, Google), versions locked | OK |
| LLM04 | Data and model poisoning | Not applicable: no training or fine-tuning, and the library is per user | N/A |
| LLM05 | Improper output handling | Output is rendered as Markdown text (no HTML), written to DOCX/PDF as text, and stored as text. Truncated output was handled silently; it is now detected (F-03). Unsupported credential claims are now flagged (F-08) | Fixed |
| LLM06 | Excessive agency | The model has no tools or actions. It only returns text the user reviews | OK |
| LLM07 | System prompt leakage | The prompts contain no secrets. Leaking one reveals only the drafting rules | Accepted |
| LLM08 | Vector and embedding weaknesses | No RAG or vector store | N/A |
| LLM09 | Misinformation | The core product risk. Mitigations:<ul><li>`[[placeholder]]` for gaps;</li><li>a placeholder warning before export;</li><li>deadline, addendum, question-count and grounding flags;</li><li>credential claim warnings;</li><li>marketing copy no longer says "never invented".</li></ul>Requirements have no page citations yet (O-04), and real-model rates are unmeasured | Partly mitigated |
| LLM10 | Unbounded consumption | Spend cap, allowances, lock, hourly limit and cooldown were already present. The library size cap (F-15) and the 400k-character extraction input cap are new. Refunds on failure (F-05) do not open abuse, because every call still counts toward the monthly $ cap and the hourly limit | OK |

## Owner actions (security)

1. In Supabase, set the `rfp-uploads` bucket to **private**. Then open `/admin/setup`; the check "RFP files are private" should be green.
2. After deploying, run `curl -I https://<site>/` and confirm the new headers are present.
3. Add a Content-Security-Policy in `Content-Security-Policy-Report-Only` mode, watch the reports for a week, then enforce it.
4. Plan the Next 16 upgrade to clear the postcss advisory.
5. Rotate any key that was ever pasted into chat, an issue or a screenshot. None was found in the repo.
