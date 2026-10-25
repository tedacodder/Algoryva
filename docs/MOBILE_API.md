# Mobile API (`/api/v1`) — Phase 1

Status: implemented and tested with mocks and an in-memory database fake. **Not deployed. The migration has not been applied to any database.** See "What is and is not verified" at the end.

The Expo/React Native app (package id `com.tedacodder.algoryva`, later phases) talks to the existing website. There is no second backend. The website's pages, server actions and tests are unchanged; everything here is additive.

## Conventions

- JSON only. Bodies need `Content-Type: application/json` (else 415), are limited to 8 KB (256 KB for sync and submissions; 413), and are strict: unknown fields are 400.
- Errors have one shape: `{ "error": { "code": "...", "message": "..." } }`. Messages never echo request values. Unexpected errors are a generic 500 and log only the error class.
- Codes: `invalid_request` 400 · `unauthorized` / `invalid_credentials` 401 · `invalid_password` 403 · `not_found` 404 · `account_exists`, `last_admin`, `client_id_reuse`, `state_changed` 409 · `payload_too_large` 413 · `unsupported_media_type` 415 · `rate_limited` 429 (with `Retry-After`) · `internal` 500.
- Every auth, account, sync and submission response has `Cache-Control: no-store`. Only `/content` is cacheable (see below).
- Authentication: `Authorization: Bearer alv_<43 characters>`. One identical 401 for missing, malformed, unknown, expired and suspended.

## Tokens and sessions

- Token: `alv_` + 32 bytes from the system CSPRNG, base64url. Shown to the app once, at login or registration.
- Stored hash: `SHA-256("algoryva-mobile-v1:" + token)` in the existing `Session.tokenHash` column. The website hashes the bare cookie value, so a web cookie can never match a mobile row and a mobile token can never match a web row.
- Lifetime: 30 days from creation, fixed (no sliding renewal), checked on every request.
- Revoked by: logout (that token only); password reset (`auth-actions.ts` deletes all of the user's sessions); admin suspension (`admin/users/actions.ts` does the same, and bearer auth also rejects suspended users); account deletion (foreign-key cascade). A test reads those two source files so a change to that behaviour cannot go unnoticed.
- Device label for the website's new-sign-in email: `Algoryva app on <name>` (sanitised, 40 characters) or `Algoryva Android app`.
- Never logged: tokens, passwords, hashes, Authorization headers.

## Endpoints

### `POST /api/v1/auth/register`
`{ email, username, password, deviceName? }` → **201** `{ token, expiresAt, user }`. Validation is the website's own `parseRegister`. Taken email or username → 409 `account_exists` (same message and same enumeration behaviour as the website). Sends the verification email (a failure never blocks sign-up). Retrying after a timeout returns 409; the app should then sign in.

### `POST /api/v1/auth/login`
`{ email, password, deviceName? }` → **200** `{ token, expiresAt, user }`. The website's `parseLogin`, keys, limits and one neutral 401 (`Invalid email or password.`) for an unknown email, wrong password or suspended account. Like the website, it does not check the email's shape. New-device alert as on the website.

### `POST /api/v1/auth/logout`
Bearer. → `{ ok: true }`. Deletes this token's session only. A second call is 401 (treat as signed out).

### `GET /api/v1/me`
Bearer. → `{ user: { id, email, username, emailVerified, preferredLanguage } }`.

### `DELETE /api/v1/me`
Bearer, `{ password }` → `{ deleted: true }`. Details under "Account deletion".

### `GET /api/v1/content`
Public. → `{ version, topics, lessons, problems }`. Details under "Content".

### `POST /api/v1/submissions`
`{ problemId, clientId (UUID), output: string | string[] }` → 200
`{ clientId, verdict: "accepted" | "wrong_answer" | "not_recorded", allPass, solved, results, note?, replayed? }`.
Details under "Judge semantics".

### `POST /api/v1/sync/push`
`{ events: [{ id (UUID), type, payload, at }] }` (1–50 events) → 200
`{ accepted: [id], rejected: [{ id, reason }], results: { [id]: {...} } }`.
An event in neither list was **not processed** (infrastructure failure) and must be retried, in the same order. If the very first event fails the response is a 500.

### `GET /api/v1/sync/pull?since=<cursor>&page=<token>`
→ `{ cursor, unchanged: true }` or `{ cursor, unchanged: false, state, notes, mistakes, next }`. Details under "Sync".

## Event types

All payloads are strict. `at` must be an ISO-8601 time with an offset, between 2020-01-01 and 24 hours in the future. It is validated and **never used** for awards, streaks, completion times, review scheduling or ordering (client clocks are untrusted). The bounds are generous on purpose: rejecting a phone with a wrong clock would strand its data. A consequence: offline study is dated when it syncs, which can shift a streak.

| type | payload | server rule (same as the website unless noted) | rejection reasons |
|---|---|---|---|
| `topic.complete` | `{ slug }` | published topic, prerequisites completed (including earlier events in the batch), progress + review item + activity | `unknown_topic`, `prerequisites_missing` |
| `topic.review` | `{ slug, rating: "good"\|"again" }` | step +1 or reset, next date from the schedule. **Extra rule:** only while the item is due, so a stale offline rating cannot advance an item another device advanced | `unknown_topic`, `not_applicable`, `not_due` |
| `quiz.submit` | `{ slug, answers: int[] }` | scored on the server from the lesson data, best score kept, attempts counted, pass activity once. Result in `results[id]` = `{score,total,passed,firstPass}` | `not_applicable`, `invalid_payload` |
| `solve.external` | `{ problemId, solved }` | EXTERNAL problems only; set or unset, activity only when newly solved. Judge-graded problems can never be marked by an event | `unknown_problem`, `not_applicable` |
| `mistake.create` | `{ id (UUID), type, reason?, problemId?, outsideTitle?, outsideUrl?, misunderstood, correctIdea, recognizeNextTime }` | the website's `parseMistake`; the row id is the client's UUID; schedules the same revisit | `invalid_payload`, `unknown_problem`, `id_conflict` |
| `mistake.delete` | `{ id }` | owner-scoped; another user's id is a silent no-op | — |
| `note.create` | `{ id (UUID), title, body, tags }` | the website's bounds (title 1–120, body 1–20,000, ≤5 tags of `[a-z0-9-]{1,24}`, trimmed, lower-cased, de-duplicated) | `invalid_payload`, `id_conflict` |
| `note.delete` | `{ id }` | owner-scoped | — |
| `revisit.report_outside` | `{ id, note }` | the website's self-report rule (due, outside, note length) | `invalid_payload`, `not_applicable` |

Other reasons: `unknown_type`, `invalid_payload` (shape), `invalid_time`, and `id_reuse` (the same event id with different content).

Not synced in v1: contests, the language preference, `revisitEmails`, activity/streak.

## Idempotency and transactions

- `SyncEvent(userId, id)` is the idempotency record. Each event is applied in its **own** database transaction that first inserts the `SyncEvent` row (`INSERT … ON CONFLICT DO NOTHING`), then applies the effect, then stores the final outcome. The three commit together or not at all.
- A duplicate (same user, same id, same content) returns the stored outcome and applies nothing. A concurrent duplicate waits on the primary key and then reads the committed outcome, so it cannot apply twice.
- Content identity: each row stores `payloadHash = SHA-256(canonical JSON of {type, payload})` (key order does not matter). The same id with different content is rejected as `id_reuse` (push) or **409 `client_id_reuse`** (submissions) and never returns another event's outcome.
- A rejection that depends on server state (for example `prerequisites_missing`, `not_due`) is stored, so a replay gets the same answer. Rejections that depend only on the request (`unknown_type`, `invalid_payload`, `invalid_time`) are not stored.
- An unexpected error rolls the event back completely and leaves it out of both lists, so a retry is safe. After such a failure the rest of the batch is **not attempted**, which preserves order.
- The website's server actions use the global database client and cannot join a transaction, so the event handlers rebuild the same effects on a transaction client, sharing the pure rules (`unlockState`, `nextReviewDate`, `passMark`, `parseMistake`, `revisitTargetFor`). This is duplicated logic and can drift; parity tests cover submissions. Extracting a shared core is a follow-up that would touch the website and was left out on purpose.

### Conflict rules

1. The server is authoritative. The app shows optimistic state and the next complete pull replaces it, except for events still waiting in the outbox.
2. Within one request, events apply in array order. Across devices, and against the website, the order is **server receive order**; no client clock is consulted. (This replaces "last write wins by client timestamp" from the original brief.)
3. Nothing user-editable needs last-write-wins: topic completion only moves forward; review ratings apply only while due; external solves are explicit set/unset in arrival order; notes and mistakes are created and deleted by id.
4. Two devices rating the same due review: the first applies, the second is rejected `not_due`. Two devices completing the same topic: both accepted (same final state). A delete for something already deleted: accepted, no effect. A create replayed after its delete does not resurrect the row, because the `SyncEvent` row remains.

## Sync pull: fingerprint snapshots

The website changes user data through many code paths (topic completion, reviews, quizzes, the judge, solve toggles, mistakes, notes, revisits, onboarding, a daily job, admin deletions that cascade). None of them record changes, and adding a change log would mean editing about ten existing files or adding database triggers. So pull returns **state**, identified by a **fingerprint**:

- `cursor` = first 16 bytes of `SHA-256("snapshot-v1:" + canonical JSON of the whole synchronised state)`, base64url (22 characters). The state includes **every value that is sent**, note and mistake bodies included, so it changes whenever any of them changes (edit, add, delete), through any code path. It does not depend on row order, clocks or `updatedAt`.
- All reads happen in one `REPEATABLE READ` transaction, so the state and its fingerprint are one consistent snapshot.
- `since` equal to the current fingerprint → `{ unchanged: true }`.
- Otherwise: `state` (topic progress, review items, quiz results, solves, revisits) on the first page, and notes and mistakes in pages of 100 and 200 by id. `next` is a page token, or `null` on the last page.
- Page tokens name the user, the fingerprint and the position, and are checked on every request: another user's token is 400; if the state changed since the first page, the answer is **409 `state_changed`** and the client restarts. Tokens are **not signed** (no secret is available and adding an environment variable was out of scope). That is safe because a token only says where to continue, every query is filtered by the authenticated user, and the fingerprint is recomputed each time. A checksum catches accidental corruption.

### Rules for the app (Phase 4 must implement these)

- Store the new cursor only after the **whole** pass (every page) has been received, validated and applied in one local transaction.
- Delete local server-origin rows that are absent from a snapshot **only** after a complete, stable pass. Never on a partial, failed, restarted or `state_changed` pass.
- Never delete or overwrite rows that still have a pending outbox event. A snapshot must not erase unacknowledged offline work.
- After a restart, keep using the old stored cursor; it simply yields a full snapshot again.

### Cost

A snapshot moves more data than a delta protocol would. On every pull the server reads **all** of the user's rows (including every note body, to fingerprint it), in eight queries inside one transaction. When the state has changed it sends all of it, split into pages; each extra page repeats the read. For a typical learner (tens of rows, a few notes) this is small. For thousands of long notes it is heavy; the pagination keeps each response small but not the database read. `since` saves bandwidth only when nothing changed. Pulling at most every few minutes (limit: 300 reads per hour per user, shared with `/me`) keeps this acceptable at the expected scale. If it becomes a problem, a change log fed by the website's writes is the upgrade path.

## Judge semantics (preserved exactly; read the limitations)

`POST /api/v1/submissions` is the website's checker (`checkOutput`) behind a bearer token.

- **It compares text. It does not compile or run code.** The learner pastes the output their own program produced, and the server compares it with the stored expected output of each test.
- `output` is `string | string[]`. The checker reads one output per test, in server order: samples first, then hidden tests by id; a missing output is `""`, extra outputs are ignored. A single string therefore behaves **exactly like a web form with only the first box filled**, so it can pass the sample but can never solve a problem that has hidden tests. An array gives one entry per test (the number of tests is `testCount` in `/content`).
- Output is normalised as on the website (`lib/judge.ts`: trailing whitespace per line and trailing blank lines ignored; leading whitespace significant). Each output is limited to 20,000 characters; a longer one fails its test.
- A problem counts as solved only when **every** test matches **and** at least one hidden test exists. Matching a sample-only problem is `not_recorded` with the website's note and records nothing.
- Visible problem set: `status = PUBLISHED` and `kind = INTERNAL` only. Authentication happens before any test data is read.
- Shared limit with the website: `check:{userId}:{problemId}`, 40 per hour. Added for the app: `v1-submit:{userId}`, 240 per hour overall.
- A full match also passes a revisit that is already due and awards the solve once, as on the website.
- Retries: the same `clientId` and content returns the stored verdict (without the learner's pasted text), uses no limit budget and awards nothing again. The same `clientId` with a different problem or output is **409**.
- Hidden test inputs and outputs never appear in a response, a stored outcome, a log or an error. Hidden results are only `{ isSample: false, pass }`.

**Limitations of the current judge (unchanged from the website):**
- The learner sees only the sample inputs, so they cannot legitimately produce the output for a hidden test from the app alone. "Accepted" means the pasted text matched the stored expected outputs; it is not stronger evidence than "all pass" on the website, and not evidence that code ran or was correct. `CODE_JUDGE_ARCHITECTURE.md` already says completion of site problems is not strongly verified.
- App copy must not call this "compiled", "executed" or "verified code".

## Content

`GET /api/v1/content` is the same for every caller. It never reads cookies or `Authorization`, never sets a cookie, and its ETag depends only on the body.

- Source: 40 curriculum topics and built-in lessons from code; `PUBLISHED` problems and published custom lessons from the database. A published custom lesson (`main` section) replaces the built-in text for its topic, as on the website (and, as there, a custom lesson has no quiz).
- Problems carry **sample** test cases and `testCount` (a number). Hidden tests are never selected from the database.
- Quiz questions carry `q`, `options` and `kind` only: **no `answer`, no `why`**. The server scores quizzes (`quiz.submit`). Note: the website itself sends quiz answers to the browser, so they are not secret on the web; the app does not add to that.
- Built through explicit allowlists, then checked against a strict schema. An unexpected field in a problem or custom-lesson row is dropped; an unexpected nested field in a lesson makes the response fail closed (500).
- `version` = first 16 hex characters of the body's SHA-256; `ETag: "<version>"`. `If-None-Match` (including lists, weak validators and `*`) gets 304.
- Caching: `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`. Admin edits can take **up to a minute to reach the edge** and the server-side cache (5 minutes, the same cache the website uses) adds to that, so allow a few minutes. Safe to share because the content is user-independent.

## Rate limits

Reused, unchanged: `src/lib/rate-limit.ts` (`AuthAttempt` rows). New keys are added; no existing key or limit changed.

| endpoint | key and limit |
|---|---|
| register | `register-email:{email}` 30/h; `register-ip:{ip}` 30/h only with a trusted proxy IP |
| login | `login-email:{email}` 5 failures/15 min; `login-ip:{ip}` 20/15 min with a trusted proxy IP |
| submissions | `check:{user}:{problem}` 40/h (shared with the website); `v1-submit:{user}` 240/h |
| sync push | `v1-push:{user}` 120/h; ≤ 50 events and ≤ 256 KB per request |
| `/me`, sync pull | `v1-read:{user}` 300/h |
| logout | `v1-logout:{user}` 60/h |
| delete account | `delete-account:{user}` 5/h (recorded before the password check; shared by the website form) |
| content | none (a database-backed limit would let anonymous traffic write rows; the CDN cache and ETag cover it) |

`Retry-After` is the window length, an upper bound; the limiter does not expose the oldest attempt.

**Inherited weaknesses (not fixed here):** the limiter checks and then records in separate queries, so concurrent requests can exceed a limit by roughly the concurrency (parallel password guesses can slip a few extra attempts past); old rows are cleaned probabilistically; and **IP limits exist only when `TRUST_PROXY=true`**. Production values of `TRUST_PROXY` and `TRUSTED_PROXY_HOPS` are **unverified** (no access to the Vercel configuration). If unset, only per-email limits are active: registration can be repeated with many different emails, and login limits can be reached for a victim's email by anyone (a lock-out that exists on the website today too).

## Account deletion

One routine (`src/lib/account/delete.ts`) serves `DELETE /api/v1/me` and the website's `/delete-account` form.

1. Authenticated session and the password (re-verified); rate limit `delete-account:{user}` 5/h.
2. If the account is an ADMIN, all admin rows are locked (`SELECT … FOR UPDATE`) and counted; the last administrator is refused (409 `last_admin`). Two admins deleting at the same moment are serialised, so the second sees it is the last.
3. One transaction deletes the account's `AuthAttempt` rows (email keys for the address and any pending address, `verify:`, `email-change:`, `check:{id}:*`, and the app's own keys) and the user row.
4. Foreign keys with `ON DELETE CASCADE` remove sessions (so every token and cookie dies), progress, review items, quiz results, solves, activity, mistakes, notes, revisits, sync events, contest entries and solves, submissions and verification tokens. This was checked in the migration SQL text; it was **not** run against a real database here.

**What can remain** (disclosed on `/delete-account` and `/privacy`): database backups until the host's retention expires; hosting and email-provider logs; sign-in-limit rows keyed only by network address (removed periodically).

**Google Play:** Google's current policy requires an account-deletion path in the app (or an in-app link to the web) and a web link for deletion requests, which you also enter in the Data safety form, and requires actual deletion of the associated data (deactivation is not enough) with retention disclosed. This phase provides the API and the web page; the in-app option (Phase 6) and your Data safety answers are still needed, and Google decides compliance at review. See https://support.google.com/googleplay/android-developer/answer/13327111.

## `SyncEvent` retention

Kept **indefinitely** in v1. Estimate (an assumption, not a measurement): one row is about 0.3–0.5 KB including its primary-key index, so one million events is roughly 0.4 GB. A learner producing 10–30 events a day produces about 4,000–11,000 a year, about 2–5 MB.

Deleting old rows is unsafe today: a delayed retry of a deleted row's event would be applied again (a review could advance twice, a quiz attempt count twice, a deleted note come back), and the client clock cannot be trusted to bound how old a retry can be. A safe policy needs a **server-enforced** retry window, for example client-generated time-ordered ids (UUIDv7) with the server rejecting any id whose embedded time is older than the window, plus an app rule that drops outbox events older than the window and tells the user. Then rows older than the window can be deleted (and `outcome` could be compacted earlier). That needs Phase 4 decisions and tests; **not implemented, not approved**. Until then, watch table size; at 100 users it is negligible.

## Deploying and rolling back

1. Apply the migration **before** deploying this code (it is additive; the old website code ignores the new table). Nothing applies migrations on Vercel today. Against the production database URL, from a machine that has it:
   `npx prisma migrate deploy`
   (This checks `_prisma_migrations` and runs only `20261018090000_sync_event`.)
2. Deploy.
3. Roll back by redeploying the previous version. The table can stay (inert) or be dropped with `DROP TABLE "SyncEvent";`, which touches no other table.

No new environment variables. `.env.example` was not touched (it exists upstream; the audit archive did not include it).

## Manual review checklist

- [ ] Choose and publish a **privacy contact email**; set `PRIVACY_CONTACT_EMAIL` in `src/lib/privacy.ts` (it is `null` on purpose, and both pages say "pending" until then). Do not submit the privacy URL to Google Play before this.
- [ ] Have the `/privacy` text reviewed (not legal advice). Verify the statements: no ads and no sale of data, HTTPS, "no IP address stored in the account", the providers (hosting, managed database, email delivery), and the sign-in-limit wording.
- [ ] **Check `TRUST_PROXY` and `TRUSTED_PROXY_HOPS` in Vercel.** Unverified here.
- [ ] Run `npx prisma migrate deploy` (see above) before the deploy; take a database backup/branch first if you want a restore point.
- [ ] On your machine: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and a database-backed check of the migration and the account deletion cascade (this environment could run none of the Prisma-engine-dependent ones).
- [ ] Confirm the Android package id `com.tedacodder.algoryva` is free and final when you create the app in Play Console.
- [ ] Decide whether admin edits reaching the app within a few minutes is acceptable (content cache).
- [ ] Review the "Cost" section for sync, and the `SyncEvent` retention note.

## What is and is not verified

See the Phase 1 completion report for the exact commands and results. In short: unit and route tests run against an in-memory database fake (mocked tests, not database tests); TypeScript was checked against a types-only generated Prisma client; the Prisma engine, real transactions and isolation levels, the migration against a real database, the production build and any mobile end-to-end test were **not** verified unless the report says otherwise.
