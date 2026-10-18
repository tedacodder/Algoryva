-- AlterTable: reminder preference and when the last digest was sent (one digest per day).
ALTER TABLE "User" ADD COLUMN "revisitEmails" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "revisitEmailedAt" TIMESTAMP(3);

-- CreateTable: a problem the learner solved only after help, scheduled for a solve-again review.
CREATE TABLE "Revisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "step" INTEGER NOT NULL DEFAULT 0,
    "passedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Revisit_userId_problemId_key" ON "Revisit"("userId", "problemId");

-- CreateIndex
CREATE INDEX "Revisit_userId_dueAt_idx" ON "Revisit"("userId", "dueAt");

-- AddForeignKey
ALTER TABLE "Revisit" ADD CONSTRAINT "Revisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revisit" ADD CONSTRAINT "Revisit_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
