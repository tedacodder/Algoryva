-- Reverses 20261026090000_solve_verification.
-- DATA LOSS: this removes the verification source from every solve record. Export it first (see ops/production/BACKUP_AND_RECOVERY.md,
-- section "Before any rollback"). Solve rows themselves are not deleted, only the new column and type.
ALTER TABLE "ContestSolve" DROP COLUMN IF EXISTS "verification";
ALTER TABLE "ProblemSolve" DROP COLUMN IF EXISTS "verification";
DROP TYPE IF EXISTS "SolveVerification";
