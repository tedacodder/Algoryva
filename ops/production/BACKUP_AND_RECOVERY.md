# Production database: backup, migration and recovery plan

**Status: prepared, not executed. Nothing in this document has been run against production. Every production step needs explicit owner approval.**

## 1. What is pending

| Migration | Kind | Risk | Reversible without data loss? |
|---|---|---|---|
| `20261018090000_sync_event` | Adds a table | Low | Yes, drop the empty table if no code has written to it |
| `20261025120000_telegram_link` | Adds three tables | Low | Yes, drop the tables. Users must re-link |
| `20261026090000_solve_verification` | Adds an enum and two columns, then a narrow backfill (external solves become `SELF_REPORTED`) | Medium: changes existing rows | Schema yes; the verification values are lost |
| `20261026100000_bot_features` | Adds one column with a default and one table | Low | Yes |
| `20261026110000_community_growth` | Adds four tables (recipients, deliveries, Codeforces cache, referral codes); no existing row changes | Low | Yes, the rollback removes the subscriptions and referral codes |
| `20261026120000_bot_rewards` | Adds two tables (weekly rewards, awarded weeks); no existing row changes | Low | Yes, the rollback removes awarded rewards |

All six are additive. None deletes a row. The only UPDATE is in `20261026090000`, and it touches only the new column.

## 1a. Neon specifics

Production is Neon. Run the migration step with the **direct** (non-pooled) connection string. The application uses the pooled string. See `DEPLOYMENT_OCI.md` section 13 for the exact commands and the free-plan limits.

## 2. Before anything runs

1. **Owner approval** is required for each step below. The approval should name the migration names and the backup identifier.
2. **Read-only inspection.** Run `ops/production/01-inspect-before.sql` with a read-only role. Save the output. It contains counts and migration state, and no personal data.
3. **Migration checksums.** Run `ops/production/02-migration-checksums.sh`. Every applied migration must report `ok`. A `MISMATCH` stops the work until someone explains it.
4. **Prisma's own status check** (read-only): `npx prisma migrate status`, run with the production connection string, is read-only. Save its output.
5. **Maintenance window.** Choose a low-traffic window. Expect the migration itself to take seconds, because every change is a new column with a default or a new table, but PostgreSQL takes a short lock on the tables it alters. The `ProblemSolve` and `ContestSolve` tables are the ones that lock. Check their current size first, because `ADD COLUMN ... DEFAULT` in PostgreSQL 11+ does not rewrite the table.

## 3. Backup

Both of these are needed, and neither replaces the other.

- **Provider snapshot or point-in-time recovery.** Take a manual snapshot now and record its ID. Confirm the provider's point-in-time window from the provider's documentation (not verified here) before relying on it.
- **Logical dump** from a machine with network access to the database:
  ```bash
  pg_dump "$PRODUCTION_URL" --format=custom --no-owner --no-privileges --file "backup-$(date -u +%Y%m%dT%H%M%SZ).dump"
  pg_restore --list backup-<ts>.dump > /dev/null   # the file must be readable
  sha256sum backup-<ts>.dump > backup-<ts>.dump.sha256
  ```
- **Restore test before the migration.** Restore the dump into a new, disposable database whose name ends in `_test`, then run `ops/production/01-inspect-before.sql` against it. The counts must match the production output exactly. Only then proceed.
- **Storage.** Store the dump encrypted, outside the bot VM and outside the repository. Keep it for at least 30 days.

## 4. Apply (after approval)

```bash
npx prisma migrate deploy        # applies only pending migrations, in order. Never run migrate dev, migrate reset or db push here.
```

Then run `ops/production/03-verify-after-migration.sql` read-only. Every row must show `ok = t`.

**Deploy order.** Migrate first, then deploy the code. The new code writes the verification column, so the column must exist before that code runs. The previously deployed code keeps working, because the column has a default. Its writes during the window are recorded as `LEGACY_UNVERIFIED`, which is the safe value. Those rows can be corrected later if the owner decides to.

## 5. Rollback

Use the smallest option that works.

1. **Code rollback only (preferred).** The migrations are additive, so the previous code runs against the migrated schema. Redeploy the previous Vercel deployment. No database change.
2. **Schema rollback.** Run the matching file in `ops/rollback/`, in reverse order. Before the verification rollback, export the verification data:
   ```sql
   \copy (SELECT "userId","problemId",verification FROM "ProblemSolve") TO 'problemsolve-verification.csv' CSV HEADER
   \copy (SELECT "entryId","problemId",verification FROM "ContestSolve") TO 'contestsolve-verification.csv' CSV HEADER
   ```
   The rollback removes only the new column and enum. Solve rows stay.
3. **Restore from snapshot.** Use only if data is corrupted. Every write after the snapshot is lost, so writes must be stopped first and the loss reported to the owner.

Verify any rollback with `tests/migrations/rollback-round-trip.sh` on a test database. It has passed once, which shows the rollback scripts reverse the migrations exactly. It does not prove the production state.

## 6. Never run in production

- `prisma migrate reset`, `prisma db push --accept-data-loss`, `prisma migrate dev`
- Any `DELETE` or `TRUNCATE` without a `WHERE` that has been reviewed
- The test helper `tests/integration/db.ts` `resetDb`. It refuses non-test databases, but do not rely on that guard for production work

## 7. Open questions for the owner

1. Where is the production database hosted, and what point-in-time window does that provider give? I could not verify this from the repository.
2. Is there a read-only database role available for the inspection step?
3. Is a maintenance window acceptable, or should the migration run during normal traffic? Both are safe; the window only makes the short lock easier to reason about.
4. Should `LEGACY_UNVERIFIED` solves created during the deploy window be re-checked by hand?
