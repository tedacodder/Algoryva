# Live test runbook: Telegram and Codeforces

**Status: NOT RUN. This sandbox cannot resolve `api.telegram.org` or `codeforces.com` (checked this round). Run these steps from your Linux Mint machine or the Oracle VM.**

## What was verified here, and what was not

| Check | Result |
|---|---|
| Bot starts with a dummy token and no network | Verified. It logs a retry warning per attempt, prints no traceback, and never prints the token, digits or URL path |
| Bot exits on SIGTERM | Verified: exit code 143 (normal for SIGTERM), no traceback. The graceful path during polling is aiogram's and was not exercised, because polling needs Telegram |
| Rejected token stops the bot with a clear message | Verified in unit tests with a fake bot. Not seen against Telegram |
| Real `/start`, `/link`, `/daily`, `/progress`, `/club`, `/referral`, `/notify`, `/stop` | **Not run.** Needs a test bot token and network |
| Codeforces `problemset.problems` and `contest.list` | **Not run.** Needs network |
| Scheduler sends a real message | **Not run** |

## Setup (once)

1. Create a dedicated test bot with @BotFather: `/newbot`. Keep its token in a password manager. **Never paste it into chat or commit it.**
2. Use a second Telegram account as the tester. Create a test private group with the test bot and the tester, and make the tester a group admin.
3. Create a local test environment file outside the repo, with permissions `600`:

   ```bash
   install -m 600 /dev/null ~/algoryva-test.env
   cat >> ~/algoryva-test.env <<'EOF'
   BOT_TOKEN=<paste the test token here, in your editor, not in chat>
   ALGORYVA_API_BASE=http://localhost:3000
   TELEGRAM_BOT_API_SECRET=<a 32+ character value; must match the website's test value>
   EOF
   ```

   For `ALGORYVA_API_BASE`, use `http://localhost:3000` only when running the website locally with `npm run dev`. Otherwise use your Vercel preview URL (https). Plain http is refused for any other host.

4. Run the website locally in one terminal with `TELEGRAM_BOT_API_SECRET` and `TELEGRAM_CHAT_KEY` set to the same values, against a **test** database.

## Test 1: startup and shutdown

```bash
cd bot && .venv/bin/python -m algoryva_bot   # reads the env file: set -a; . ~/algoryva-test.env; set +a first
```

- **Expect:** a log line per startup, no traceback. The bot answers `/help` in the test chat within a few seconds.
- **Stop with Ctrl+C.** Expect: no traceback. Note: if you stop during the startup retry loop, Python's default handling applies, which is exit code 130 or 143.

## Test 2: `/start`, linking, status, unlink

1. In the test private chat: `/start`. **Expect:** a welcome message and today's Codeforces problem, with a `codeforces.com/problemset/problem/...` link.
2. `/link`. **Expect:** a link ending in `/telegram/link#<token>`, with an expiry time.
3. Open the link in a browser while signed in to a test Algoryva account. Press **Confirm link**. **Expect:** "Telegram is linked."
4. `/status`. **Expect:** "Connected to the Algoryva account <test username>."
5. Open the same link again. **Expect:** "expired or was already used".
6. `/unlink`, then `/status`. **Expect:** "Disconnected", then "Not connected yet".

## Test 3: daily problem, progress, rewards, referral

- `/daily`. **Expect:** today's problem. Send it twice. **Expect:** the same problem both times.
- `/progress` (linked only). **Expect:** level, XP, streak, and the solve breakdown.
- `/referral` (linked only). **Expect:** a `https://t.me/<bot>?start=<code>` link and a count of 0.
- Start the bot from a second account with that link. **Expect:** that chat is recorded with the referral (the count only increases after the referred account has a verified solve).

## Test 4: clubs

- `/club create Test Club` (linked). **Expect:** a code of 8 hex characters.
- From a second linked account: `/club join <code>`, then `/club mine`, `/club top`.
- Leader: `/club leave`. **Expect:** refused while the other member remains.

## Test 5: groups

- In the test group, the admin sends `/enable`. **Expect:** confirmation.
- A non-admin sends `/enable`. **Expect:** "Only a group admin can change this."
- Within a minute of a reminder window, or with `/daily` in the group, **expect** the group receives the daily problem.
- `/disable` (admin). **Expect:** confirmation, and no further group messages.

## Test 6: notifications and reminders

- The scheduler runs once a minute. To check a reminder, pick a Codeforces contest starting within 10 minutes (`/contests` lists them). **Expect:** a message with the UTC start time and the official contest link, and it arrives once.
- Block the test bot from the test account. **Expect:** the website marks that chat blocked. Unblock and send `/start` to resume.

## Test 7: Codeforces connectivity

From the machine running the website (not the sandbox):

```bash
curl -s -A "algoryva-test/1.0" "https://codeforces.com/api/contest.list?gym=false" | head -c 300; echo
curl -s -A "algoryva-test/1.0" "https://codeforces.com/api/problemset.problems" | head -c 300; echo
```

- **Expect:** JSON beginning with `{"status":"OK"`. If you get `"status":"FAILED"` with `Call limit exceeded`, wait two seconds and retry, which is the documented limit. Do not call either method in a loop.

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| "Telegram is not reachable yet" repeats | No internet, or a firewall blocks `api.telegram.org` | Check outbound HTTPS. The bot retries automatically |
| "Telegram rejected the bot token" and exit code 3 | Token copied wrongly or revoked | Regenerate with `/token` in BotFather and update the env file. **Do not paste it into chat** |
| `/link` says "Not set up for the bot yet" | `TELEGRAM_BOT_API_SECRET` missing or shorter than 32 characters on the website, or `SITE_URL` not https | Set both on the website and redeploy |
| Community messages never arrive | `TELEGRAM_CHAT_KEY` missing on the website, or Codeforces unreachable (the bot says so) | Check the website's environment, then `/daily` |
| `/club` refuses with "not connected" | The chat is not linked | Run `/link` first |
| A group gets no messages | The group is not enabled, or the tester is not an admin | `/enable` as an admin |

## Recording the result

Copy this table into your own notes, and fill it in from what you actually see. **Do not mark a line as passed unless you saw it.**

| Test | Ran? | Passed? | Notes (no tokens, no chat ids) |
|---|---|---|---|
| 1 startup and shutdown | | | |
| 2 start, link, status, unlink | | | |
| 3 daily, progress, referral | | | |
| 4 clubs | | | |
| 5 groups | | | |
| 6 notifications | | | |
| 7 Codeforces | | | |
