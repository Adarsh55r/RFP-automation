-- Reposition for US / UK / global markets.

-- RfpDocumentType: replace India-specific "vendor_empanelment" with
-- "public_tender" (US SLED RFPs, UK public-sector tenders) and "rfi"
-- (RFIs, supplier / pre-qualification questionnaires). Existing
-- vendor_empanelment rows become rfi.
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

-- Submission / compliance rules (page limits, required forms, Q&A deadline, portal).
ALTER TABLE "Rfp" ADD COLUMN "extractedSubmission" JSONB;

-- Reusable approved answers for questionnaires and repeat questions.
ALTER TYPE "LibraryItemType" ADD VALUE 'saved_answer';

-- Billing moves from Razorpay to Stripe.
ALTER TABLE "Subscription" RENAME COLUMN "razorpaySubscriptionId" TO "stripeSubscriptionId";
