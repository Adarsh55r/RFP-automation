-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reviewPromptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewPromptedAt" TIMESTAMP(3),
ADD COLUMN     "reviewRespondedAt" TIMESTAMP(3),
ADD COLUMN     "reviewResponse" TEXT;
