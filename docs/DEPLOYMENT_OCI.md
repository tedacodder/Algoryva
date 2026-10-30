# Oracle Cloud deployment for the Telegram bot

**Status: instructions only. Nothing has been provisioned. Each step needs your account access, and the bot token and secret must come from you, never through this chat.**

Every fact below comes from Oracle's Always Free documentation (fetched 2026-06-12) unless it says otherwise. Re-check the limits on the day you create the instance.

## 0. Accepted risk (decision recorded)

The owner has accepted idle reclamation. Oracle may reclaim an Always Free A1 instance that stays under 20% CPU, network and memory use for seven days. No artificial load is generated. Recovery is covered in section 9.

## 1. $0 resource inventory

| Resource | Limit (Always Free) | What we use | Headroom |
|---|---|---|---|
| Compute, Ampere A1 Flex | 1,500 OCPU-hours and 9,000 GB-hours per month (equal to 2 OCPUs and 12 GB) | 1 OCPU, 6 GB, running all month (720 OCPU-hours, 4,320 GB-hours) | 52% of OCPU hours and 52% of GB hours |
| Boot volume | 200 GB total block storage across the tenancy | 50 GB boot volume | 150 GB, minus any other volumes |
| Block volume backups | 5 backups across the tenancy | 0 (we use the bot's recovery runbook, not Oracle backups) | 5 |
| Outbound data transfer | 10 TB per month | Telegram and website API calls, a few MB a day | Far below the limit |
| Monitoring | Included | Not used beyond the default metrics | n/a |
| Public IPv4 | Included with the instance | Used only for SSH from your admin address | n/a |
| Load balancer, managed database, object storage beyond free tier | Not used | Not used | n/a |

**What would cost money, and how we avoid it.** Creating anything outside this list, upgrading the account to pay-as-you-go, or exceeding the allowances above. The plan above stays inside every row. Before you create the instance, open *Billing* in the console and confirm no paid resources are running. Oracle's budget alerts can notify you, but they are not hard spending caps.

## 2. Create the account and instance

1. Sign in to the Oracle Cloud console. Note the **home region**. Always Free compute must be created there.
2. Create the instance: *Compute → Instances → Create instance*.
   - Name: `algoryva-bot`
   - Image: Canonical Ubuntu 24.04 (ARM64 for the A1 shape)
   - Shape: `VM.Standard.A1.Flex`, 1 OCPU, 6 GB memory
   - Boot volume: 50 GB
   - Networking: a public subnet with a public IPv4 address. Restrict SSH to your address (step 3).
   - SSH keys: upload your public key. Keep the private key on your own machine.
3. Network security list (or NSG): allow **inbound TCP 22 from your admin IP only**. Allow no other inbound port. The bot makes only outbound calls to `api.telegram.org` and to the website, so it needs no inbound web port.
4. If you see "Out of host capacity", wait and retry, or try another availability domain. This is temporary and is not a billing event.

## 3. Host setup (as the default `ubuntu` user, over SSH)

```bash
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get -y install python3.12 python3.12-venv git rsync unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades          # automatic security updates
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && sudo systemctl restart ssh
sudo mkdir -p /etc/systemd/journald.conf.d && printf '[Journal]\nSystemMaxUse=200M\n' | sudo tee /etc/systemd/journald.conf.d/algoryva-bot.conf && sudo systemctl restart systemd-journald
sudo useradd --system --home /opt/algoryva-bot --shell /usr/sbin/nologin algoryva-bot
```

## 4. Install the bot

```bash
sudo git clone https://github.com/<your-org>/<your-repo>.git /tmp/algoryva-src
sudo rsync -a --delete /tmp/algoryva-src/bot/ /opt/algoryva-bot/
cd /opt/algoryva-bot
sudo python3.12 -m venv .venv
sudo .venv/bin/pip install -r requirements.lock
sudo .venv/bin/pip install --no-deps -e .
sudo chown -R root:root /opt/algoryva-bot && sudo chmod -R a+rX /opt/algoryva-bot
```

Pin the exact commit you deploy: `git -C /tmp/algoryva-src rev-parse HEAD` must be recorded in your deployment log.

## 5. Secrets (never in the repository or in chat)

Website side (Vercel), in addition to the bot secrets below: `TELEGRAM_BOT_API_SECRET`, `TELEGRAM_CHAT_KEY` (generate with `openssl rand -base64 32`), and `SITE_URL`. The chat key is needed for community messages. Back it up with the other secrets, because losing it makes stored chats unreadable.

```bash
sudo mkdir -p /etc/algoryva-bot
sudo install -m 0640 -o root -g algoryva-bot /opt/algoryva-bot/deploy/env.example /etc/algoryva-bot/env
sudo nano /etc/algoryva-bot/env   # fill in: BOT_TOKEN, ALGORYVA_API_BASE, TELEGRAM_BOT_API_SECRET
```

- `BOT_TOKEN` comes from @BotFather.
- `TELEGRAM_BOT_API_SECRET` must equal the website's value, and it must be at least 32 characters. Generate it with `openssl rand -base64 48`.
- `ALGORYVA_API_BASE` is the https origin only, with no path.

Check permissions: `sudo ls -l /etc/algoryva-bot/env` must show `-rw-r----- root algoryva-bot`.

## 6. Install and start the service

```bash
sudo install -m 0644 /opt/algoryva-bot/deploy/algoryva-bot.service /etc/systemd/system/algoryva-bot.service
sudo systemctl daemon-reload
sudo systemctl enable --now algoryva-bot
sudo systemctl status algoryva-bot --no-pager
sudo journalctl -u algoryva-bot -n 50 --no-pager
```

Healthy output shows the process running and no stack trace. Logs contain no message text, no Telegram ids, no tokens and no response bodies, by design.

## 7. Smoke test (with a test bot and your own account)

Use a **separate test bot** from BotFather, with its own token, for the first run. In a private chat with that bot, send, in order: `/help`, `/link`, then open the link while signed in, `/status`, `/daily`, `/progress`, `/optin`, `/top`, `/optout`, `/unlink`. Each must reply sensibly. Then point to the production bot only after this passes.

## 8. Reboot test (required before calling it done)

```bash
sudo reboot
# after the instance is back:
sudo systemctl is-active algoryva-bot     # must print "active"
sudo journalctl -u algoryva-bot --since "10 min ago" --no-pager | tail -20
```

Send `/help` to the bot. It must answer.

## 9. Recovery (reclamation or failure)

The bot holds no personal data. Losing the VM costs downtime only.

1. Create a new instance by repeating sections 2 to 6. Use the same commit and the same secrets. Store the secrets in your password manager so you are not relying on the old VM.
2. The website, the database and all user links are unaffected. Users do not need to re-link.
3. Log the incident: when the VM was lost, when it was back, and the commit deployed.
4. Note the time to recover in the checklist. Target: under one hour once Oracle capacity is available.

**Backups for the VM.** Keep a copy of `/etc/algoryva-bot/env` in your password manager, and the commit hash. Nothing else on the VM needs backing up.

## 10. Rollback of a bot release

```bash
sudo systemctl stop algoryva-bot
sudo rsync -a --delete /opt/algoryva-bot.previous/ /opt/algoryva-bot/      # keep the previous release here before each upgrade
sudo systemctl start algoryva-bot
```

Before each upgrade: `sudo rsync -a --delete /opt/algoryva-bot/ /opt/algoryva-bot.previous/`.

## 11. Shutdown and deletion (to stop all use)

```bash
sudo systemctl disable --now algoryva-bot
```

Then in the console, terminate the instance and delete its boot volume. Remove the security list rule. Revoke the bot token in BotFather with `/revoke`.

## 12. Unverified items (must be checked before deployment)

- Oracle's current Always Free limits and the home-region rule (the fetched page is dated 2026-06-12; re-check).
- Whether the account can create the A1 shape in your region at all.
- Telegram's current bot limits (about 30 messages per second; the bot sends far fewer).
- Vercel's Hobby terms for this use, and the managed database's price and limits. Neither was checked from this sandbox.


## 13. Database: Neon (free plan)

Facts from Neon's plans page (`neon.com/docs/introduction/plans`, fetched during this round). Re-check before launch.

| Limit on the Free plan | Value | What it means for us |
|---|---|---|
| Compute | 100 CU-hours per project per month | The app's queries use very little compute. When the allowance runs out, the database **suspends until next month. Nothing is billed.** |
| Autoscaling | up to 2 CU | Enough for this workload |
| Scale to zero | after 5 minutes idle, cannot be turned off | The first request after a quiet period is slower while the database wakes |
| Storage | 1 GB per project, 20 GB across all projects | Far above what this app needs |
| Public network transfer | 5 GB per project per month | Resets monthly. Exceeding it suspends the project until next month. Nothing is billed |
| Branches | 10 per project | Use only `main` in production |
| Projects | 100 | One project is enough |
| Monitoring history | 1 day | Check usage in the console |
| Spending notifications | not available on Free | Use the console's usage page instead. The Free plan cannot be charged, so there is nothing to alert on |
| Instant restore | 6 hours | The formal backup for production is the dump in `ops/production/BACKUP_AND_RECOVERY.md`, not this window |

**Setup**

1. Create a Neon project in the Free plan, in the region closest to your Vercel functions.
2. In the console's connection details, copy two strings:
   - **Pooled** (hostname contains `-pooler`, add `?sslmode=require`). This is `DATABASE_URL` in Vercel.
   - **Direct** (no `-pooler`, add `?sslmode=require`). Use it only for migrations.
3. Set `DATABASE_URL` (pooled) in Vercel for the production environment. Never put the direct string in Vercel.
4. Run the migrations once, from your machine, with the direct string. The schema has no `directUrl`, so the direct string is passed as `DATABASE_URL` for that one command only:
   ```bash
   DATABASE_URL="<direct connection string>" npx prisma migrate deploy
   ```
   Do this only after the owner approves the migrations, and after the backup in `BACKUP_AND_RECOVERY.md`.
5. Verify with `ops/production/03-verify-after-migration.sql` using a read-only role.

**Monitoring the free allowances.** Check the Neon console's usage page weekly during the first month. If compute or egress approaches the limit, the database pauses until the next month. The bot will then report that Algoryva is unavailable. Nothing is billed. To reduce load, keep the bot's polling interval at one minute and avoid large exports.

**Never upgrade the Neon account** for this project, because the $0 requirement forbids it.
