-- Weekly rewards and the record of which weeks were awarded. Additive: two new tables, no existing row changes.

-- CreateTable
CREATE TABLE "BotReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "detail" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotReward_userId_kind_periodKey_key" ON "BotReward"("userId", "kind", "periodKey");

-- CreateIndex
CREATE INDEX "BotReward_userId_idx" ON "BotReward"("userId");

-- AddForeignKey
ALTER TABLE "BotReward" ADD CONSTRAINT "BotReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "RewardPeriod" (
    "periodKey" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardPeriod_pkey" PRIMARY KEY ("periodKey")
);
