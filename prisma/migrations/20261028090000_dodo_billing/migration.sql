-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billingEventAt" TIMESTAMP(3),
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dodoCustomerId" TEXT,
ADD COLUMN     "dodoSubscriptionId" TEXT,
ADD COLUMN     "passCreditCode" TEXT,
ADD COLUMN     "providerStatus" TEXT;

-- CreateTable
CREATE TABLE "ExtraProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "rfpId" TEXT,

    CONSTRAINT "ExtraProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_dodoSubscriptionId_key" ON "Subscription"("dodoSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraProposal_paymentId_key" ON "ExtraProposal"("paymentId");

-- CreateIndex
CREATE INDEX "ExtraProposal_userId_usedAt_idx" ON "ExtraProposal"("userId", "usedAt");

-- AddForeignKey
ALTER TABLE "ExtraProposal" ADD CONSTRAINT "ExtraProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
