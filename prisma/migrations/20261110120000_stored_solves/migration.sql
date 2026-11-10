-- Stored Codeforces solves and sync state. Additive only: nothing existing is changed or removed.
CREATE TABLE "CfSolve" (
    "handle" TEXT NOT NULL,
    "problemRef" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CfSolve_pkey" PRIMARY KEY ("handle","problemRef")
);
CREATE INDEX "CfSolve_handle_acceptedAt_idx" ON "CfSolve"("handle", "acceptedAt");

CREATE TABLE "CfSync" (
    "handle" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "backfilled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "CfSync_pkey" PRIMARY KEY ("handle")
);
