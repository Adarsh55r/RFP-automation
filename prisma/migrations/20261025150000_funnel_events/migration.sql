-- AlterTable
ALTER TABLE "User" ADD COLUMN     "industry" TEXT,
ADD COLUMN     "signupSegment" TEXT;

-- CreateTable
CREATE TABLE "FunnelEvent" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "segment" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FunnelEvent_event_createdAt_idx" ON "FunnelEvent"("event", "createdAt");

-- CreateIndex
CREATE INDEX "FunnelEvent_userId_event_idx" ON "FunnelEvent"("userId", "event");
