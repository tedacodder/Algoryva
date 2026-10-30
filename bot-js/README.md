# Codeforces daily bot, serverless (grammY, ES modules)

## What this is

The same bot as the Python version, rewritten in JavaScript with grammY. It is a webhook: Telegram sends each update as an HTTPS POST,
and the handler answers it. Nothing runs 24/7, so there is no VM to keep alive.

The bot keeps **no state of its own**. Every fact (subscriptions, connected handles, delivery records) lives in the website's
PostgreSQL database, behind the signed internal API. That is why no grammY session storage is needed. If you ever need per-chat
state that the website does not hold, use grammY's session plugin with a storage adapter (for example, a KV store the host provides).

## Where it runs

Telegram Serverless: I could not find a Telegram product by that name with a documented API. The bot therefore uses the standard
Telegram webhook, which works on any host that accepts HTTPS requests. The handlers use only Web standards (`Request`, `Response`,
`fetch`, `crypto.subtle`), so they run on Node 20+, Deno, Bun and edge runtimes.

The recommended host is the website's existing Vercel project. It already has the database and the internal API, so the bot
adds no new service.

## Files

| File | Purpose |
|---|---|
| `src/config.js` | Reads and validates environment variables. Errors name the variable, never its value |
| `src/sign.js` | Request signing with Web Crypto. Byte-compatible with the website (pinned by a test vector) |
| `src/site.js` | Signed client for the website. Timeouts, no automatic retries, no response logging |
| `src/bot.js` | The grammY bot: commands, persistent keyboard, group admin checks |
| `src/render.js` | Plain text to Telegram HTML, with every piece escaped first |
| `src/texts.js` | Parsers for `/random`, `/connect`, `/notify`, and the message texts |
| `src/webhook.js` | The webhook handler (`std/http`). grammY checks the secret token header |
| `src/deliver.js` | The delivery endpoint for due community messages, called by an external scheduler |
| `src/app.js` | Assembles everything from validated configuration |
| `test/` | 25 tests: signing vector, parsers, bot behaviour against a fake Telegram and a fake website, webhook and delivery |

## Environment variables (set in the host's secret store, never in code)

| Variable | Value | Notes |
|---|---|---|
| `BOT_TOKEN` | From @BotFather | Never log it, never put it in a URL you print |
| `ALGORYVA_API_BASE` | `https://<your domain>` | The website origin, no path. http is allowed for localhost only |
| `TELEGRAM_BOT_API_SECRET` | 32+ characters | Must equal the website's value |
| `TELEGRAM_WEBHOOK_SECRET` | 16 to 256 letters, digits, `-` or `_` | Telegram sends it back on every update |
| `CRON_SECRET` | 32+ characters | Protects the delivery endpoint |

Generate the secrets with `openssl rand -base64 48` and keep them in the host's secret store.

## Deploy on Vercel (inside the website project)

1. Copy `src/` to `bot-js/src/` in the website repository, and add `bot-js/package.json` with `grammy` as a dependency.
2. Add the webhook route (`app/api/telegram/route.js`):

   ```js
   import { createApp } from "@/bot-js/src/app.js";
   export const runtime = "nodejs";
   const app = createApp(process.env);   // created once per instance, after validation
   export const POST = (request) => app.webhook(request);
   ```

3. Add the delivery route (`app/api/telegram/deliver/route.js`) with the same pattern, using `export const POST = app.deliver;`.
4. Set the five environment variables in the Vercel project, then deploy.
5. Register the webhook once, from your machine. Read the token from your environment, never type it into a shared file:

   ```bash
   curl -s "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
     -d "url=https://<your domain>/api/telegram" \
     -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
   ```

   Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`.

## Run on your laptop (local mode)

Telegram cannot reach localhost, so locally the bot polls instead of using a webhook. Stop the old Python bot first, because only
one process may use a token at a time.

```bash
set -a; . ~/algoryva-bot.env; set +a   # loads BOT_TOKEN, the secrets, and ALGORYVA_API_BASE=http://localhost:3000
npm run dev
```

Expected: `bot @<name> is running`, then one line per minute only when something is delivered. Press Ctrl+C to stop.

## Scheduling the community messages

Serverless functions run only when called, so the daily problem and contest alerts need a trigger. Call the delivery endpoint once
a minute with the bearer token:

```bash
curl -s -X POST "https://<your domain>/api/telegram/deliver" -H "Authorization: Bearer $CRON_SECRET"
```

Use any external scheduler that can send a request every minute (for example, a free cron service). **Vercel's Hobby plan runs cron
jobs only once a day, so do not rely on Vercel cron for this.** I have not verified the current limits of any scheduler from this
environment; check the provider's documentation before you depend on one.

## Security

- Secrets live only in the host's secret store. The code reads them from `process.env` and never prints them.
- Every call to the website is signed (HMAC-SHA256, timestamped, with a unique nonce), and the website rejects replays.
- Telegram updates are accepted only with the webhook secret header. grammY answers 401 otherwise.
- The delivery endpoint compares the bearer token in constant time.
- Calls have timeouts. Writes are never retried automatically, so a timeout cannot send a duplicate.
- Logs record error class names only: no message text, no chat ids, no tokens.
- Chat ids reach the bot only in the signed delivery list, and they are encrypted at rest on the website.

## What I verified here, and what I did not

Verified offline (Node 22, `npm test`): the signing vector matches the Python bot's and the website's, every command and button
path, the admin rule in groups, friendly errors, the webhook secret check, delivery outcomes (sent, blocked, rate-limited), and the
cron secret check. The Telegram API is replaced by an interceptor in these tests.

Not verified here: a live Telegram webhook, the Next.js route integration on Vercel, and the external scheduler. Those need your
accounts and are the next steps.
