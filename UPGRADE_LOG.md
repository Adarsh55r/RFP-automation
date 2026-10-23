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
