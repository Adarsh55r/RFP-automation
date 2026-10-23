-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "extractionChanges" JSONB;

-- CreateTable
CREATE TABLE "RfpFile" (
    "id" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'addendum',
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "includedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfpFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RfpFile_rfpId_idx" ON "RfpFile"("rfpId");

-- AddForeignKey
ALTER TABLE "RfpFile" ADD CONSTRAINT "RfpFile_rfpId_fkey" FOREIGN KEY ("rfpId") REFERENCES "Rfp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
