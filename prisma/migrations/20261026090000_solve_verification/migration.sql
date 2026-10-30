-- Adds a verification source to solve records. Additive: no row is deleted or rewritten, and every existing row keeps its
-- historical data. The default is LEGACY_UNVERIFIED, so any writer that forgets to set the field produces an unverified solve.

-- CreateEnum
CREATE TYPE "SolveVerification" AS ENUM ('OUTPUT_MATCHED', 'SELF_REPORTED', 'LEGACY_UNVERIFIED');

-- AlterTable
ALTER TABLE "ProblemSolve" ADD COLUMN "verification" "SolveVerification" NOT NULL DEFAULT 'LEGACY_UNVERIFIED';

-- AlterTable
ALTER TABLE "ContestSolve" ADD COLUMN "verification" "SolveVerification" NOT NULL DEFAULT 'LEGACY_UNVERIFIED';

-- Backfill, narrowly. An EXTERNAL problem can never be judged (its kind is fixed at creation in the admin form), so every solve
-- on one was a learner's own mark. Internal solves are NOT backfilled: a pre-fix row cannot be told apart from a judged one.
UPDATE "ProblemSolve" AS ps SET "verification" = 'SELF_REPORTED' FROM "Problem" AS p WHERE p."id" = ps."problemId" AND p."kind" = 'EXTERNAL';

UPDATE "ContestSolve" AS cs SET "verification" = 'SELF_REPORTED' FROM "Problem" AS p WHERE p."id" = cs."problemId" AND p."kind" = 'EXTERNAL';
