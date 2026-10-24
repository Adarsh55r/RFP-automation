-- AlterEnum
ALTER TYPE "SubscriptionTier" ADD VALUE 'single_bid';
ALTER TYPE "SubscriptionTier" ADD VALUE 'pro';
ALTER TYPE "SubscriptionTier" ADD VALUE 'consultant';
ALTER TYPE "SubscriptionTier" ADD VALUE 'pilot';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "accessEndsAt" TIMESTAMP(3),
ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "planVersion" TEXT NOT NULL DEFAULT 'legacy';

-- AlterTable
ALTER TABLE "Rfp" ADD COLUMN     "overageCents" INTEGER;

-- AlterTable
ALTER TABLE "ProposalUsage" ADD COLUMN     "overageBilledAt" TIMESTAMP(3),
ADD COLUMN     "overageCents" INTEGER;
