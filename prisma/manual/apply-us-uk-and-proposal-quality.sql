-- Applies migrations 20261015120000_us_uk_market and 20261016090000_proposal_quality
-- for anyone who cannot run `npx prisma migrate deploy` (paste into the Neon SQL Editor).
-- Safe to run more than once: every step checks whether it has already been done,
-- and the migrations are recorded so a later `prisma migrate deploy` skips them.

-- 1. Document types: replace vendor_empanelment with public_tender and rfi.
DO $$
BEGIN
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
END $$;

-- 2. New columns.
ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "extractedSubmission" JSONB;
ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "sourceText" TEXT;
ALTER TABLE "Rfp" ADD COLUMN IF NOT EXISTS "draftPlan" JSONB;

-- 3. New enum values.
ALTER TYPE "LibraryItemType" ADD VALUE IF NOT EXISTS 'saved_answer';
ALTER TYPE "DraftSection" ADD VALUE IF NOT EXISTS 'cover_letter';
ALTER TYPE "DraftSection" ADD VALUE IF NOT EXISTS 'responses';

-- 4. Billing column: Razorpay -> Stripe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Subscription' AND column_name = 'razorpaySubscriptionId'
  ) THEN
    ALTER TABLE "Subscription" RENAME COLUMN "razorpaySubscriptionId" TO "stripeSubscriptionId";
  END IF;
END $$;

-- 5. Record both migrations in Prisma's history (only if that table exists).
DO $$
BEGIN
  IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
    INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    SELECT gen_random_uuid()::text, m.checksum, now(), m.name, NULL, NULL, now(), 1
    FROM (VALUES
      ('20261015120000_us_uk_market', '6309163e29f44cdb05ae7758576caefed729f1d7ee1347ae094b7ebb7b06c371'),
      ('20261016090000_proposal_quality', '6e82dcd09d60e036fe723f1c6ef5a0e598abc472485b6beede362d55eadc4ab4')
    ) AS m(name, checksum)
    WHERE NOT EXISTS (
      SELECT 1 FROM "_prisma_migrations" p
      WHERE p.migration_name = m.name AND p.rolled_back_at IS NULL
    );
  END IF;
END $$;

-- 6. Check: this should return 4 rows.
SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name = 'Subscription' AND column_name = 'stripeSubscriptionId')
   OR (table_name = 'Rfp' AND column_name IN ('extractedSubmission', 'sourceText', 'draftPlan'))
ORDER BY table_name, column_name;
