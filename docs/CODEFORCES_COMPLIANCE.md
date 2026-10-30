# Codeforces: terms, API guidance, and what the bot does about them

**Status: partly verified.** I checked the official API help page (`codeforces.com/apiHelp`), as shown in search results, which I could read. I did **not** read Codeforces' full Terms of Service or licence in this round, and I have not verified any legal position. Read them yourself before launch.

## What the official API help says (verified from the page excerpts)

- Public data can be requested anonymously. An API key is needed only for private data such as contest hacks. **The bot uses no key.**
- The API may be requested **at most once every two seconds**. Exceeding this returns `FAILED` with "Call limit exceeded".
- Every response has `status` (`OK` or `FAILED`), and `comment` on failure.

## What the bot does

| Requirement | How the bot meets it | Tested |
|---|---|---|
| Two-second limit | Responses are cached: the problemset for 24 hours, upcoming contests for 10 minutes. The bot makes no request in a loop | Unit and integration tests use cached data and make no network calls |
| Failure handling | Any `FAILED` or network error is treated as a failure. The last good copy is served. Nothing throws into the bot | Integration test with the network stubbed to fail |
| Public data only, no key | Only `problemset.problems` and `contest.list` are called, anonymously | Code review |
| Identify the client | Requests send a User-Agent naming the bot and the site | Code review |
| Do not copy problem statements | Messages show the problem name, rating, tags and a link. No statement text is stored or sent | Message-format tests |

## Known risk not yet closed

**Concurrent cold starts.** Several serverless invocations at once could each see an expired cache and each call Codeforces, which could briefly exceed one request every two seconds. Expected impact is small, because the caches last 10 minutes and 24 hours, and each call is cheap. The fix is a short lock (a database row claimed before fetching). It is not built. Add it before a large launch.

## What is still needed from you

1. Read Codeforces' current Terms of Service and any licence for the API data, and confirm that caching public data for these purposes is allowed.
2. Confirm that linking to Codeforces problems and contests (rather than copying them) matches what you intend.
3. Decide whether to contact Codeforces before launch, given that the bot sends a message to many users with links to their site.
