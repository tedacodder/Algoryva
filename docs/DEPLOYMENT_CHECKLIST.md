# Deployment checklist

**Nothing in this list has been done in your accounts. Each item is marked with what it needs from you.**

## A. Before any production change

- [ ] Owner approval for the seven pending migrations (see `PRODUCTION_MIGRATION_RUNBOOK.md`)
- [ ] Neon project confirmed: ID, branch (production root), region, database name, and that it matches Vercel's `DATABASE_URL`
- [ ] Read-only inspection saved; checksums match
- [ ] Neon snapshot created and its ID recorded (the Free plan allows one manual snapshot)
- [ ] Logical dump created, listed with `pg_restore --list`, checksummed, and restore-tested into a `*_test` database
- [ ] Owner has read the privacy notice draft and the Codeforces notes

## B. Website (Vercel)

Set these in the Vercel production environment. **Never commit them. Never paste them into chat.**

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** connection string, `?sslmode=require` | The app uses this. |
| `TELEGRAM_BOT_API_SECRET` | 32+ random characters, e.g. `openssl rand -base64 48` | Must equal the bot's value |
| `TELEGRAM_CHAT_KEY` | 32 random bytes in base64, `openssl rand -base64 32` | Back this up. Losing it makes stored chats unreadable |
| `SITE_URL` | `https://<your production domain>` | Must be https. Link URLs are built from it |

- [ ] Migrations applied (section A) before the code that uses them is deployed
- [ ] Deploy the website
- [ ] `GET /telegram/link` returns the page; `POST /api/internal/bot/v1/identity` without a signature returns 401

## C. Bot (Oracle Cloud Always Free VM)

Full steps are in `DEPLOYMENT_OCI.md`. Summary:

- [ ] Instance in your **home region**: `VM.Standard.A1.Flex`, 1 OCPU, 6 GB, 50 GB boot volume, Ubuntu 24.04
- [ ] Firewall: SSH (22) from your address only. No other inbound port. The bot needs only outbound HTTPS
- [ ] Packages, a non-login `algoryva-bot` user, unattended security upgrades
- [ ] `/etc/algoryva-bot/env` (mode 0640, group `algoryva-bot`) with `BOT_TOKEN` (BotFather, production bot), `ALGORYVA_API_BASE` (https origin, no path), and `TELEGRAM_BOT_API_SECRET` (the same value as Vercel)
- [ ] `algoryva-bot.service` installed. Restart policy is `Restart=always` with no start limit, so the bot comes back after a Telegram or network outage
- [ ] `systemctl enable --now algoryva-bot`; `systemctl is-active algoryva-bot` prints `active`
- [ ] Logs: `journalctl -u algoryva-bot -n 50`. The journal is capped at 200 MB by the drop-in in the guide
- [ ] Reboot test: `sudo reboot`, then `systemctl is-active algoryva-bot` prints `active` and `/help` answers
- [ ] Live tests from `LIVE_TEST_RUNBOOK.md` run, with results recorded honestly

## D. Health and monitoring (honest status)

- There is **no heartbeat file or health endpoint yet**. The available checks are `systemctl is-active`, the journal, and the website's own logs. Adding a heartbeat is a small follow-up.
- A reclaimed VM (Oracle's idle policy, which the owner accepted) stops the bot until someone rebuilds it. Nothing personal is lost, because the bot keeps no personal data on the VM.

## E. Costs and Free Tier limits (checked against Neon's and Oracle's pages)

| Service | Cost | Limit to watch |
|---|---|---|
| Oracle Always Free A1 | $0 within the allowance | 2 OCPU and 12 GB in total for the account. Oracle may reclaim an idle instance |
| Neon Free | $0 | 100 CU-hours per project per month; 5 GB egress per project per month. **If exceeded, the database pauses until next month and nothing is billed** |
| Vercel Hobby | $0 | Hobby terms are for non-commercial use. Check before launch |
| Telegram Bot API | $0 | About 30 messages per second for bulk sends. The bot sends far fewer |
| Codeforces API | $0 | One request every two seconds |

**Never upgrade any of these accounts for this project.** Doing so would start charges, and that is outside the approved $0 plan.

## F. After launch

- [ ] Delivery-record pruning job in place (privacy notice, known gap 1)
- [ ] Concurrent-fetch lock for the Codeforces cache (compliance notes)
- [ ] Owner decisions recorded: clubs moderation, leadership transfer, group announcements
