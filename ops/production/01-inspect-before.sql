-- READ-ONLY inspection, run BEFORE any migration. Counts only: no emails, usernames, tokens or other personal data.
-- Usage: psql "$PRODUCTION_READONLY_URL" -f ops/production/01-inspect-before.sql > inspect-before-<date>.txt
-- Use a read-only database role if one exists. The transaction below refuses writes even with a writable role.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
\pset border 1

\echo '== migration history (name, applied, failed or rolled back)'
SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back, started_at
FROM _prisma_migrations ORDER BY started_at;

\echo '== failed or incomplete migrations (must be none before a deploy)'
SELECT migration_name, started_at FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;

\echo '== tables present'
SELECT count(*) AS public_tables FROM information_schema.tables WHERE table_schema = 'public';

\echo '== solve records by problem kind (the backfill rule depends on this split)'
SELECT p.kind, count(*) AS problem_solves FROM "ProblemSolve" ps JOIN "Problem" p ON p.id = ps."problemId" GROUP BY p.kind ORDER BY p.kind;

\echo '== contest solves by problem kind'
SELECT p.kind, count(*) AS contest_solves FROM "ContestSolve" cs JOIN "Problem" p ON p.id = cs."problemId" GROUP BY p.kind ORDER BY p.kind;

\echo '== activity rows by type (streaks are computed from these)'
SELECT type, count(*) FROM "Activity" GROUP BY type ORDER BY type;

\echo '== accounts (counts only)'
SELECT count(*) AS users, count(*) FILTER (WHERE suspended) AS suspended FROM "User";

-- Tables that a pending migration creates may not exist yet. Check first, so this script never aborts on them.
SELECT to_regclass('"TelegramLink"') IS NOT NULL AS has_telegram \gset
\if :has_telegram
  SELECT count(*) AS telegram_links FROM "TelegramLink";
\else
  \echo 'TelegramLink absent (20261025120000 not applied yet)'
\endif

SELECT to_regclass('"SyncEvent"') IS NOT NULL AS has_sync \gset
\if :has_sync
  \echo '== mobile judge submissions (SyncEvent)'
  SELECT count(*) AS submission_events FROM "SyncEvent" WHERE type = 'submission';
\else
  \echo 'SyncEvent absent (20261018090000 not applied yet)'
\endif

\echo '== database size'
SELECT pg_size_pretty(pg_database_size(current_database())) AS size;
COMMIT;
