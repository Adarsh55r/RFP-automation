-- AlterEnum
ALTER TYPE "DraftSection" ADD VALUE 'general';
ALTER TYPE "DraftSection" ADD VALUE 'form';

-- AlterTable
ALTER TABLE "Draft" ADD COLUMN     "sectionKey" TEXT,
ADD COLUMN     "title" TEXT;
