-- AlterTable: a revisit is either a problem on this site, or an outside problem.
ALTER TABLE "Revisit" ALTER COLUMN "problemId" DROP NOT NULL,
ADD COLUMN "outsideTitle" TEXT,
ADD COLUMN "outsideUrl" TEXT,
ADD COLUMN "outsideKey" TEXT,
ADD COLUMN "passedBy" TEXT,
ADD COLUMN "note" TEXT;

-- Exactly one of the two kinds, never both and never neither.
ALTER TABLE "Revisit" ADD CONSTRAINT "Revisit_one_kind_check" CHECK (("problemId" IS NOT NULL) <> ("outsideKey" IS NOT NULL));

-- CreateIndex
CREATE UNIQUE INDEX "Revisit_userId_outsideKey_key" ON "Revisit"("userId", "outsideKey");
