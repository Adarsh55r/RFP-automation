# DraftBid AI

B2B SaaS that helps small and mid-sized businesses in the US, UK, and other English-speaking markets win RFPs without a dedicated bid team. Upload a commercial RFP, a public-sector tender (US state / local / education, UK councils, NHS, Find a Tender), or a security questionnaire; DraftBid AI extracts a compliance checklist, drafts answers from your own library, and exports a Word proposal.

Pricing is in USD and GBP (Free, Starter $49 / £39, Growth $149 / £119, Team $349 / £279 per month).

## Stack

- Next.js 15 (App Router) · TypeScript · Tailwind CSS
- Clerk auth · framer-motion · clsx · lucide-react · Radix UI

## Tests

```bash
npm test                 # unit tests; database tests are skipped
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/draftbidai_test npm test   # everything
npm run eval:ai          # real-model quality eval: needs OPENAI_API_KEY and costs money
```

`TEST_DATABASE_URL` must point at a throwaway local Postgres database. The suite runs the
migrations on it and truncates every table between tests, and it refuses Neon, Supabase
and Vercel hosts. Storage, Clerk and the LLM are faked, so the default suite makes no
network calls. The audit that introduced these tests is in [`docs/audit/`](docs/audit/AUDIT_SUMMARY.md).
