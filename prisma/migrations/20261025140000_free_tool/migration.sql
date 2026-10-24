-- CreateTable
CREATE TABLE "ToolUsage" (
    "id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "segment" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolUsage_tool_createdAt_idx" ON "ToolUsage"("tool", "createdAt");

-- CreateIndex
CREATE INDEX "ToolUsage_ipHash_createdAt_idx" ON "ToolUsage"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
