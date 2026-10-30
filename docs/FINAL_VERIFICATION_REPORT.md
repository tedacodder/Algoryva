# Final verification report (this round)

Everything below was run in the sandbox, and each result is the actual output of the command. Nothing was run against Neon, Oracle, Vercel, Telegram or Codeforces, because the sandbox cannot reach them (checked: DNS fails for `api.telegram.org`, `codeforces.com`, `neon.tech`).

## Ran and passed

| Check | Result |
|---|---|
| Website typecheck (`npm run typecheck`) | Pass |
| Website lint (`npm run lint`) | Pass, zero errors |
| Website unit tests (`npx vitest run`) | 876 pass, 66 files |
| Website integration tests (`vitest.integration.config.ts`, fresh PostgreSQL 16, seven new-or-old migrations applied in order) | 69 pass |
| Website production build (`npm run build`) | Pass, all bot routes listed |
| Prisma schema validation | Pass |
| Migration rollback round trip (six new migrations) | Schema identical after apply and rollback |
| Backfill assertions for the verification column | Pass |
| Bot tests (`pytest`, pinned dependencies) | 52 pass |
| Bot startup with no network | Retries with backoff, no traceback, token not printed |
| Bot exit on SIGTERM | Exit code 143, no traceback |
| Mobile typecheck, lint | Pass |
| Mobile node tests | 273 pass |
| Mobile Jest tests | 34 pass |

## Defects found and fixed this round

1. **Bot stopped permanently after a Telegram outage at boot.** aiogram's startup call raised and the process exited, and systemd's start limit could then stop restarts. Fixed: startup retries network failures with backoff, stops only on a rejected token, and systemd restarts without a start limit. Tests added.
2. **Route folder created literally with braces** (`sh` does not expand braces). Fixed and rewritten.
3. **Test assumption wrong for opt-in.** Opt-in to the public board lives on the Telegram link, so tests now create links for opted-in students.
4. **Club display test expected the wrong word.** Corrected to match the wording the bot uses.
5. **Stray re-export in `clubs.ts`.** Removed.

## Not verified (and why)

| Item | Why |
|---|---|
| Production migrations | Target database not verified (no credentials, Neon unreachable). Stopped by design |
| Live Telegram behaviour: commands, linking in a real chat, groups, reminders | Telegram unreachable from the sandbox. Runbook provided |
| Live Codeforces responses | Codeforces unreachable from the sandbox. Commands provided |
| Oracle VM, systemd on a real host, reboot behaviour | No access. Steps provided |
| Neon connection, pooled and direct strings | No access. Steps provided |
| Codeforces full Terms of Service | Only the API help page was read |
| Privacy notice legal review | Not a legal document. Marked as a draft |

## Open items that block launch

1. Owner approval and a verified Neon target, then the seven migrations (runbook).
2. Live tests run from your machine (runbook), with results recorded.
3. Delivery-record pruning job (privacy notice, known gap 1).
4. Codeforces Terms of Service check, and a concurrent-fetch lock for the Codeforces cache.
5. Owner decisions: club moderation and leadership transfer, group announcements.

## Feature status

| Feature | Status |
|---|---|
| Daily Codeforces problem (private and groups) | Built, tested |
| Contest reminders about 10 minutes before (private and groups), with UTC time and official link | Built, tested. Timing accurate to about a minute |
| Progress (XP, streak, breakdown, rewards) | Built, tested. Reuses website functions |
| Submission status | Built, tested. The bot cannot submit yet |
| Bot submit | **Not built** |
| Notifications and queue | Built, tested |
| Referrals | Built, tested. Counts only after a verified solve |
| Weekly rewards | Built, tested |
| Clubs v1 | Built, tested. Leadership transfer and moderation not built |
| Global weekly leaderboard | Built, tested. Opt-in, linked only |
| First-win message | **Not built** (agreed: waits for bot submit) |
