import { prisma } from "@/lib/db";

/**
 * Brings a database created before the US/UK release up to the current
 * schema (migrations 20261015120000_us_uk_market,
 * 20261016090000_proposal_quality, 20261017090000_ai_usage_limits,
 * 20261018090000_review_prompt, 20261023090000_terms_acceptance,
 * 20261023100000_proposal_usage, 20261023110000_ai_daily_ceiling,
 * 20261024090000_pricing_v2, 20261025090000_draft_citations and
 * 20261025100000_questionnaire_map), using the app's own DATABASE_URL so it
 * always upgrades the database the deployment actually reads.
 *
 * One DO block = one transaction. A transaction-scoped advisory lock stops
 * concurrently starting server instances from running it twice, and every
 * step re-checks the current state, so it is a no-op once applied.
 */
const UPGRADE_SQL = `
DO $upgrade$
BEGIN
  PERFORM pg_advisory_xact_lock(724011);

  -- Document types: vendor_empanelment becomes rfi; add public_tender.
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RfpDocumentType' AND e.enumlabel = 'public_tender'
  ) THEN
    CREATE TYPE "RfpDocumentType_new" AS ENUM ('rfp', 'public_tender', 'rfi', 'security_questionnaire', 'pitch_request', 'other');
    ALTER TABLE "Rfp"
      ALTER COLUMN "extractedDocumentType" TYPE "RfpDocumentType_new"
      USING (
        CASE
          WHEN "extractedDocumentType"::text = 'vendor_empanelment' THEN 'rfi'
          ELSE "extractedDocumentType"::text
        END
      )::"RfpDocumentType_new";
    ALTER TYPE "RfpDocumentType" RENAME TO "RfpDocumentType_old";
    ALTER TYPE "RfpDocumentType_new" RENAME TO "RfpDocumentType";
    DROP TYPE "RfpDocumentType_old";
  END IF;

  ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "extractedSubmission" JSONB;
  ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "sourceText" TEXT;
  ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "draftPlan" JSONB;

  ALTER TYPE "LibraryItemType" ADD VALUE IF NOT EXISTS 'saved_answer';
  ALTER TYPE "DraftSection" ADD VALUE IF NOT EXISTS 'cover_letter';
  ALTER TYPE "DraftSection" ADD VALUE IF NOT EXISTS 'responses';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Subscription' AND column_name = 'razorpaySubscriptionId'
  ) THEN
    ALTER TABLE "Subscription" RENAME COLUMN "razorpaySubscriptionId" TO "stripeSubscriptionId";
  END IF;

  -- AI usage metering, per-proposal allowances, and the one-task-at-a-time lock.
  ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "extractCount" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "fullDraftCount" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "lastFullDraftAt" TIMESTAMP(3);
  ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "revisionCount" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiAlertMonth" TEXT;
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiBusyUntil" TIMESTAMP(3);
  CREATE TABLE IF NOT EXISTS "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rfpId" TEXT,
    "action" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
  );
  CREATE INDEX IF NOT EXISTS "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");
  CREATE INDEX IF NOT EXISTS "AiUsage_rfpId_idx" ON "AiUsage"("rfpId");
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AiUsage_userId_fkey') THEN
    ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Review request after an export.
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reviewPromptCount" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reviewPromptedAt" TIMESTAMP(3);
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reviewRespondedAt" TIMESTAMP(3);
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reviewResponse" TEXT;

  -- Terms of Service acceptance.
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsVersion" TEXT;
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);

  -- October 2026 pricing: new plans, grandfathering, one-time access, overage.
  ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'single_bid';
  ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'pro';
  ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'consultant';
  ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'pilot';
  -- Existing rows get 'legacy' so they keep their original plan terms.
  ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "planVersion" TEXT NOT NULL DEFAULT 'legacy';
  ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "billingCycle" TEXT;
  ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "accessEndsAt" TIMESTAMP(3);
  ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "overageCents" INTEGER;

  -- Daily AI spend ceiling alert.
  ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiDailyAlertDay" TEXT;

  -- Plan usage ledger (survives RFP deletion).
  CREATE TABLE IF NOT EXISTS "ProposalUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rfpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalUsage_pkey" PRIMARY KEY ("id")
  );
  CREATE INDEX IF NOT EXISTS "ProposalUsage_userId_createdAt_idx" ON "ProposalUsage"("userId", "createdAt");
  ALTER TABLE "ProposalUsage" ADD COLUMN IF NOT EXISTS "overageCents" INTEGER;
  ALTER TABLE "ProposalUsage" ADD COLUMN IF NOT EXISTS "overageBilledAt" TIMESTAMP(3);
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProposalUsage_userId_fkey') THEN
    ALTER TABLE "ProposalUsage" ADD CONSTRAINT "ProposalUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- Existing uploads already count against the plan.
  INSERT INTO "ProposalUsage" ("id", "userId", "rfpId", "createdAt")
  SELECT 'pu_' || r."id", r."userId", r."id", r."createdAt"
  FROM "Rfp" r
  WHERE r."originalFileUrl" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "ProposalUsage" p WHERE p."rfpId" = r."id");

  -- Per-claim citations on drafted sections.
  ALTER TABLE "Draft" ADD COLUMN IF NOT EXISTS "citations" JSONB;

  -- Spreadsheet questionnaire column mapping.
  ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "questionnaireMap" JSONB;

  -- Record the migrations so a later \`prisma migrate deploy\` skips them.
  IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
    INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    SELECT gen_random_uuid()::text, m.checksum, now(), m.name, NULL, NULL, now(), 1
    FROM (VALUES
      ('20261015120000_us_uk_market', '6309163e29f44cdb05ae7758576caefed729f1d7ee1347ae094b7ebb7b06c371'),
      ('20261016090000_proposal_quality', '6e82dcd09d60e036fe723f1c6ef5a0e598abc472485b6beede362d55eadc4ab4'),
      ('20261017090000_ai_usage_limits', '291108a67b31cfa6b1eed95c210e49c5fe9164c48cca825ff4c69c8498ec0141'),
      ('20261018090000_review_prompt', '8cfa77ef427e04d3b6ecc19e893857ac8a34aea642cbfaee84a4c2c5305bb8e0'),
      ('20261023090000_terms_acceptance', '2eaa6834d9350e4e7d9a35e34a0aac65443c27ec60ce5357f9b67fe1f79745a3'),
      ('20261023100000_proposal_usage', 'feb6be9c36be3c1ceaf0b64366ef2a24c7fb0af537a50bf0a9a3e0b5d5db3387'),
      ('20261023110000_ai_daily_ceiling', 'e46307d58ad5c2637b7ab9a60c2f49c3a53d96764163920082ace1a8e0a93734'),
      ('20261024090000_pricing_v2', '4b71719c6b2b9b5dee05ef99d82e6dfcfaee2a2b0b46eaa1bee2419d4143ef71'),
      ('20261025100000_questionnaire_map', '475732645a35588d44d91139e235d9f8513b8e987de9e859a88d5dfe36564b7e'),
      ('20261025090000_draft_citations', 'd6d6b59e60b37818eb6e83be5d983cbcef0dd7e9f5390b3d2ac3cf1c2198ce61')
    ) AS m(name, checksum)
    WHERE NOT EXISTS (
      SELECT 1 FROM "_prisma_migrations" p
      WHERE p.migration_name = m.name AND p.rolled_back_at IS NULL
    );
  END IF;
END
$upgrade$;
`;

/** Cheap check so already-upgraded databases skip the DDL entirely. */
const NEEDS_UPGRADE_SQL = `
SELECT
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Rfp' AND column_name = 'draftPlan'
  )
  OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Subscription' AND column_name = 'stripeSubscriptionId'
  )
  OR NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RfpDocumentType' AND e.enumlabel = 'public_tender'
  )
  OR NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DraftSection' AND e.enumlabel = 'responses'
  )
  OR to_regclass('"AiUsage"') IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'aiBusyUntil'
  )
  OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'reviewResponse'
  )
  OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'termsVersion'
  )
  OR to_regclass('"ProposalUsage"') IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'aiDailyAlertDay'
  )
  OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'ProposalUsage' AND column_name = 'overageCents'
  )
  OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Draft' AND column_name = 'citations'
  )
  OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Rfp' AND column_name = 'questionnaireMap'
  ) AS "needsUpgrade"
`;

export { NEEDS_UPGRADE_SQL, UPGRADE_SQL };

export async function upgradeSchemaIfNeeded() {
  const [row] = await prisma.$queryRawUnsafe<{ needsUpgrade: boolean }[]>(NEEDS_UPGRADE_SQL);
  if (!row?.needsUpgrade) {
    return false;
  }
  await prisma.$executeRawUnsafe(UPGRADE_SQL);
  console.info("[schema-upgrade] Database upgraded to the current schema.");
  return true;
}
