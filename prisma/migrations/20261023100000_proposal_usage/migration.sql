-- CreateTable
CREATE TABLE "ProposalUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rfpId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProposalUsage_userId_createdAt_idx" ON "ProposalUsage"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProposalUsage" ADD CONSTRAINT "ProposalUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing uploads already count against the plan.
INSERT INTO "ProposalUsage" ("id", "userId", "rfpId", "createdAt")
SELECT 'pu_' || r."id", r."userId", r."id", r."createdAt"
FROM "Rfp" r
WHERE r."originalFileUrl" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ProposalUsage" p WHERE p."rfpId" = r."id");
