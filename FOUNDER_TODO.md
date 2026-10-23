# Founder to-do

Everything only you can provide or decide. Items marked **blocks launch** must be done before merging to `main` (merging deploys to production).

## Company and legal (blocks launch)
Fill these in `lib/company.ts`; the admin Setup page lists any still unset.
- [ ] `{{LEGAL_ENTITY_NAME}}`, `{{REGISTERED_ADDRESS}}`, `{{COMPANY_NUMBER}}` (or remove the number if there is none)
- [ ] `{{GOVERNING_LAW}}` and `{{VENUE}}` (courts)
- [ ] `{{CONTACT_EMAIL}}` and `{{SECURITY_EMAIL}}`; confirm that `privacy@draftbidai.com` receives mail
- [ ] `{{FOUNDER_NAME}}`, `{{FOUNDER_BIO}}`, `{{FOUNDER_PHOTO_URL}}` for `/about`
- [ ] Terms placeholders in `app/terms/page.tsx`:
  - `{{PRICE_CHANGE_NOTICE_DAYS}}`;
  - `{{REFUND_POLICY}}`;
  - `{{DATA_RETENTION_AFTER_TERMINATION}}`;
  - `{{BACKUP_RETENTION}}`;
  - `{{MINIMUM_LIABILITY_CAP}}`;
  - confirm the 12-month fees liability cap.
- [ ] DPA placeholders in `lib/dpa.ts`: `{{SUBPROCESSOR_NOTICE_DAYS}}`, `{{BREACH_NOTICE_HOURS}}`
- [ ] Subprocessor regions in `lib/subprocessors.ts`:
  - `{{VERCEL_REGION}}` (Vercel → Settings → Functions);
  - `{{NEON_REGION}}` (Neon → project settings);
  - `{{SUPABASE_REGION}}` (Supabase → project settings);
  - payment provider name and region once chosen.
- [ ] Security page: `{{BACKUP_RETENTION}}` (Neon → Backup & restore / history retention)
- [ ] Privacy page placeholders:
  - `{{LOG_RETENTION}}` (Vercel log retention on your plan, and Sentry data retention);
  - `{{AI_PROVIDER_RETENTION}}` (for example OpenAI API abuse-monitoring retention; confirm in your provider's terms).
- [ ] **Lawyer review** of the Terms, Privacy Policy, DPA and subprocessor list (see `docs/legal/README.md`)
- [ ] **AI provider data terms:** from each provider's account settings or contract, confirm that API data is not used for training and note its retention period. Then set `AI_NO_TRAINING_CONFIRMED = true` in `lib/company.ts`. Until then the site does not claim the provider does not train on your data.

## Decisions
- [ ] Brand spelling: "DraftBid AI" (current default) or "DraftBidAI"
- [ ] **Payment provider** (blocks billing work): Stripe, Paddle, Lemon Squeezy or Dodo Payments. Then share **test-mode** keys. Without a registered company, a merchant-of-record provider is usually easier.
- [ ] GBP prices, or drop GBP for now
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

## Content
- [ ] 20 public RFPs across the segments, with gold requirement lists, for the benchmark
- [ ] 3 public RFPs (one per segment) for the sample-output gallery
- [ ] Real, permissioned testimonials once pilots exist
