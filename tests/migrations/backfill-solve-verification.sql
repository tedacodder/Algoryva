-- Asserts the backfill in 20261026090000_solve_verification on a database that was at the previous schema.
-- Expected: external solves become SELF_REPORTED, internal solves stay LEGACY_UNVERIFIED, no row is removed, and counts are unchanged.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO "User" (id, email, username, "passwordHash") VALUES ('bf-u1', 'bf@example.test', 'bf_user', 'x');
INSERT INTO "Problem" (id, slug, title, kind, difficulty) VALUES
  ('bf-ext', 'bf-external', 'External', 'EXTERNAL', 'EASY'),
  ('bf-int', 'bf-internal', 'Internal', 'INTERNAL', 'EASY');
INSERT INTO "ProblemSolve" ("userId", "problemId") VALUES ('bf-u1', 'bf-ext'), ('bf-u1', 'bf-int');
INSERT INTO "Contest" (id, slug, title, "durationMin") VALUES ('bf-c1', 'bf-contest', 'Contest', 60);
INSERT INTO "ContestEntry" (id, "contestId", "userId") VALUES ('bf-e1', 'bf-c1', 'bf-u1');
INSERT INTO "ContestSolve" ("entryId", "problemId") VALUES ('bf-e1', 'bf-ext'), ('bf-e1', 'bf-int');
CREATE TEMP TABLE before_counts AS SELECT (SELECT count(*) FROM "ProblemSolve") AS ps, (SELECT count(*) FROM "ContestSolve") AS cs;
COMMIT;

\i prisma/migrations/20261026090000_solve_verification/migration.sql

DO $$
DECLARE
  ps_ext text; ps_int text; cs_ext text; cs_int text; counts_now record; before record;
BEGIN
  SELECT verification::text INTO ps_ext FROM "ProblemSolve" WHERE "problemId" = 'bf-ext';
  SELECT verification::text INTO ps_int FROM "ProblemSolve" WHERE "problemId" = 'bf-int';
  SELECT verification::text INTO cs_ext FROM "ContestSolve" WHERE "problemId" = 'bf-ext';
  SELECT verification::text INTO cs_int FROM "ContestSolve" WHERE "problemId" = 'bf-int';
  IF ps_ext <> 'SELF_REPORTED' OR cs_ext <> 'SELF_REPORTED' THEN RAISE EXCEPTION 'external solves not backfilled: ps=% cs=%', ps_ext, cs_ext; END IF;
  IF ps_int <> 'LEGACY_UNVERIFIED' OR cs_int <> 'LEGACY_UNVERIFIED' THEN RAISE EXCEPTION 'internal solves must stay unverified: ps=% cs=%', ps_int, cs_int; END IF;
  SELECT ps, cs INTO before FROM before_counts;
  SELECT (SELECT count(*) FROM "ProblemSolve") AS ps, (SELECT count(*) FROM "ContestSolve") AS cs INTO counts_now;
  IF before.ps <> counts_now.ps OR before.cs <> counts_now.cs THEN RAISE EXCEPTION 'rows were added or removed by the backfill'; END IF;
  RAISE NOTICE 'backfill assertions passed';
END $$;
ROLLBACK;
