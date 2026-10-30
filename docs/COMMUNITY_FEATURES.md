# Community features: daily Codeforces problem, contest reminders, referrals

Status is stated per item. **Verified** means run here against PostgreSQL 16 or in the bot test suite. Nothing is deployed.

## What each feature does

| Feature | Who gets it | Status |
|---|---|---|
| Try before signing up: `/start` sends today's Codeforces problem at once. No account needed | Any private chat | **Verified** (integration + bot tests) |
| Daily Codeforces problem, random per chat per UTC day, rating 800 to 1400 | Private chats, and groups an admin enabled | **Verified** |
| Contest reminder about 10 minutes before a contest starts, with the UTC start time and the official contest page | Private chats and enabled groups | **Verified**. Timing is accurate to about one minute, because the scheduler runs once a minute |
| `/contests`: upcoming contests with UTC times and official links | Anyone | **Verified** |
| Group setup: an admin sends `/enable` or `/disable`. The bot checks the admin status with Telegram before the website is told | Group admins only | **Verified** in the logic. Live Telegram behaviour **not verified** (no bot token here) |
| Referrals: each linked student gets a code and an invite link. A referral counts only after the referred student links an account and has an output-matched Algoryva solve. Self-referrals are ignored | Linked students | **Verified** |
| Settings: `/notify daily on|off`, `/notify contests on|off`, `/stop` | Chat owners and admins | **Verified** |
| Recovery when Codeforces is down: the last good copy is served, and nothing throws | All | **Verified** (with the network stubbed to fail) |

## What is not built, and why

- **Registration for a contest.** Codeforces has no public API method to register a user. The official methods (contest list, standings, rating changes, problemset) do not include one. The bot therefore sends the official contest page and says that registration happens on Codeforces. Algoryva cannot register anyone, and no message says otherwise.
- **A "first win" message after a student's first solve.** This needs a verified solve path. Codeforces problems cannot be judged by Algoryva, so the only possible signal is a self-report, which would be labelled self-reported and could not trigger a celebration. I did not build it. The better version needs the bot submit route, which is still not built.
- **Referral rewards beyond recognition.** The count is shown. No cash, no fake counts, no paid benefit.
- **Leaderboard visibility to unlinked people.** Still linked-only. The bot's leaderboard is shown to linked chats, and users still opt in.
- **Clubs, notifications for Algoryva revisits, bot submit.** Unchanged from round 3.

## Codeforces: what the bot does with their data

- Only two documented public methods are called: `problemset.problems` and `contest.list`. Both are read-only. Responses are cached: the problemset for 24 hours, the upcoming contests for 10 minutes. Calls are far below the documented limit of one request every two seconds.
- Problem statements are **not copied**. Each message shows the name, rating, tags and a link to the official problem page.
- The requests identify themselves with a User-Agent that names the bot and the site.
- Before launch, check Codeforces' current API documentation and terms, which I could not fetch directly from this sandbox. I relied on third-party copies of the documentation for the limit and the method names.

## Privacy

- A private chat's Telegram id is the same number as the user's Telegram id. The bot must send messages to it, so it has to be stored. It is stored **encrypted** (AES-256-GCM) with `TELEGRAM_CHAT_KEY`, which is separate from the bot API secret. Only a keyed hash is used for lookups. A database copy alone shows neither the id nor a readable copy of it (verified).
- The decrypted id is sent only over the signed channel to the bot, and only in the `notifications/due` and `community` responses. The bot never logs it, and a test checks the logs.
- Linking an account attaches that chat's subscription to the account. **Deleting the account removes the subscription** (verified). **Unlinking keeps the subscription** but detaches it from the account. `/stop` removes the subscription and its scheduled messages (verified).
- Messages are stored as delivery records (kind, date or contest id, status). They contain no message text.
- **Privacy text must change before launch.** `/privacy` needs to say: chat subscriptions are stored encrypted, `/stop` removes them, and what the daily problem and reminders are. The contact email placeholder must be filled in first.

## Trust boundaries

- The bot holds `TELEGRAM_BOT_API_SECRET`. It can call the community routes. The website trusts a correctly signed request.
- **The website trusts the bot to have checked group admin status.** Turning a group on or off is a signed call the bot makes only after `get_chat_member` says the requester is `creator` or `administrator`. A compromised bot could enable any group, so the bot secret protects this.
- The website never receives a Telegram user's password or session.

## Delivery guarantees

- Each daily problem and each contest reminder is one delivery row, unique per chat, kind and key. Running the scheduler twice creates nothing new (verified).
- A failed send is retried after five minutes, up to three attempts, then marked failed (verified).
- A chat that blocked the bot, or where the bot was removed from a group, is switched off so it receives nothing more (verified).
- Telegram's bulk limits are not reached: the loop sends at most about 20 messages a second, and it honours `retry_after` when Telegram asks for a pause.

## Operations

- **New environment variable on the website:** `TELEGRAM_CHAT_KEY`, 32 random bytes in base64. Generate with `openssl rand -base64 32`. Losing this key makes every stored chat unreadable, so back it up in the password manager with the other secrets.
- **New migration:** `20261026110000_community_growth`. Additive: four new tables, no existing row changed. Rollback file: `ops/rollback/20261026110000_community_growth.down.sql`.
- **Scale note:** the daily step handles up to 500 chats per run and the reminder step up to 5,000 chats per run, with one query per chat for the recent-problem check. That is fine for hundreds of chats. Before thousands, batch the recent-problem check.

## Tests

- Website unit tests: problem selection, contest timing, message wording, chat encryption.
- Website integration tests (real PostgreSQL): subscriptions, groups, settings, the once-per-day guarantee, encryption at rest, reminders at the right time, blocked chats, retries and their limit, Codeforces down, referral qualification, self-referral, unlink and deletion, and the signed routes.
- Bot tests: signed community calls, rejection of malformed chat ids, referral payloads, the four notify forms, admin status, delivery outcomes, and that no message text or chat id reaches the logs.
