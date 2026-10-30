# Production migration runbook (Neon)

**Status: NOT EXECUTED. Stopped at the first safety gate.**

## What happened in this round

I was approved to run these migrations once the target database and recovery safeguards were verified. I could not verify them:

1. **No database credentials were available to me.** You asked me not to request production secrets in chat, and I haven't.
2. **The sandbox cannot resolve Neon's hosts.** `neon.tech` and `console.neon.tech` both fail DNS lookup (checked this round). I therefore could not confirm the project, the branch, the schema, or the migration history. Without that, the target is ambiguous, which is one of the stop conditions you set.
3. **Migration count changed.** Seven migrations are now pending, not six. The clubs migration (`20261026130000_clubs`) was added in this round.

No production change has been made. Nothing below has run against production.

## Pending migrations, in order

| # | Migration | Kind | Reversible without data loss |
|---|---|---|---|
| 1 | `20261018090000_sync_event` | Adds a table | Yes, if no code has written to it |
| 2 | `20261025120000_telegram_link` | Adds three tables | Yes, users must re-link |
| 3 | `20261026090000_solve_verification` | Adds an enum and two columns; backfills external solves to `SELF_REPORTED` | Schema yes; the verification values are lost |
| 4 | `20261026100000_bot_features` | Adds a column with a default and a table | Yes |
| 5 | `20261026110000_community_growth` | Adds four tables | Yes |
| 6 | `20261026120000_bot_rewards` | Adds two tables | Yes |
| 7 | `20261026130000_clubs` | Adds two tables | Yes |

Every migration is additive except the backfill in #3, which writes only the new column and touches no row count. The migration files were reviewed for destructive statements: none drop or rewrite existing data.

## Gates the owner (or I, once access exists) must pass, in order

1. **Identify the target.** Confirm the Neon project ID, the branch name (must be the production root branch), the region, and the database name. Compare them with the `DATABASE_URL` set in Vercel for production. If any differs, stop.
2. **Read-only inspection.** With a read-only role, run `ops/production/01-inspect-before.sql` and save the output. Stop if any migration in `_prisma_migrations` is unfinished or rolled back, or if the migration names differ from the list above.
3. **Checksums.** Run `ops/production/02-migration-checksums.sh`. Any `MISMATCH` stops the work.
4. **Backup, two ways.**
   - Neon snapshot: create a manual snapshot in the console. The Free plan allows **one** manual snapshot, so use it for this, and record its ID.
   - Logical dump: `pg_dump "$DIRECT_URL" --format=custom --no-owner --no-privileges --file backup-<UTC>.dump`, then `pg_restore --list backup-<UTC>.dump >/dev/null` and `sha256sum` it.
   - Restore test: restore the dump into a disposable `*_test` database and confirm the row counts match the inspection output. **Do not migrate until this passes.**
5. **Apply.** Run `DATABASE_URL="<direct string>" npx prisma migrate deploy`. Never run `migrate dev`, `migrate reset`, or `db push`.
6. **Verify.** Run `ops/production/03-verify-after-migration.sql` read-only. Every row must be `t`.
7. **Deploy the code** after step 6, so the new columns exist before the code that writes them runs.

## Restoration procedure (if something goes wrong after step 5)

- **Code only (preferred).** The migrations are additive. Roll back the Vercel deployment. The old code runs on the new schema.
- **Schema rollback.** Run the matching `ops/rollback/*.down.sql` files in reverse order. Export the verification columns first (commands in `ops/production/BACKUP_AND_RECOVERY.md`).
- **Restore from the Neon snapshot.** Use only for corruption. Every write after the snapshot is lost, so stop writes first.
- **Restore from the dump.** Into a new database, then point `DATABASE_URL` at it only after the owner approves.

## Verification already done (on test databases, not production)

- All seven migrations apply to a fresh PostgreSQL 16 in order.
- Rollback round trip for all six new migrations (the clubs migration was added this round): schema identical afterwards.
- Backfill assertions for the verification column pass.
- Post-migration verification query runs on a copy.

These prove the SQL works on a copy. They do not prove the production state.
