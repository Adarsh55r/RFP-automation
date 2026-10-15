-- Cover letter and per-question responses become their own proposal sections.
ALTER TYPE "DraftSection" ADD VALUE 'cover_letter';
ALTER TYPE "DraftSection" ADD VALUE 'responses';

-- Full RFP text, kept so drafting can read the original document (not just the extract),
-- and the bid plan (buyer, win themes, required structure) shared by every section.
ALTER TABLE "Rfp" ADD COLUMN "sourceText" TEXT,
ADD COLUMN "draftPlan" JSONB;
