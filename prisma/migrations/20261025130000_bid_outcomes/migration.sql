-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "contractCurrency" TEXT,
ADD COLUMN     "contractValueCents" INTEGER,
ADD COLUMN     "hoursSaved" DOUBLE PRECISION,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "outcomeAt" TIMESTAMP(3),
ADD COLUMN     "outcomeNotes" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);
