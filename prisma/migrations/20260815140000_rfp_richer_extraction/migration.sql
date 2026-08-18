-- CreateEnum
CREATE TYPE "RfpDocumentType" AS ENUM ('rfp', 'vendor_empanelment', 'security_questionnaire', 'pitch_request', 'other');

-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN "extractedDocumentType" "RfpDocumentType",
ADD COLUMN "extractedDesirable" JSONB,
ADD COLUMN "extractedQuestionnaire" JSONB,
ADD COLUMN "extractedFlags" JSONB,
ADD COLUMN "coverageMap" TEXT;
