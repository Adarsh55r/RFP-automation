import { prisma } from "@/lib/db";

/**
 * Brings a database created before the US/UK release up to the current
 * schema (migrations 20261015120000_us_uk_market and
 * 20261016090000_proposal_quality), using the app's own DATABASE_URL so it
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

  -- Record the migrations so a later \`prisma migrate deploy\` skips them.
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
