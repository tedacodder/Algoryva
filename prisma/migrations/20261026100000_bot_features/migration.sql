-- Bot features. Additive only: one new column with a safe default, and one new table. No existing row is changed.

-- AlterTable: the leaderboard is opt-in, so every existing link starts with it off.
ALTER TABLE "TelegramLink" ADD COLUMN "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChallengeAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeAssignment_userId_day_key" ON "ChallengeAssignment"("userId", "day");

-- CreateIndex
CREATE INDEX "ChallengeAssignment_userId_createdAt_idx" ON "ChallengeAssignment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChallengeAssignment" ADD CONSTRAINT "ChallengeAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeAssignment" ADD CONSTRAINT "ChallengeAssignment_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
