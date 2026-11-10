# Public launch checklist

This lists what is verified in the code, and what must be checked by a person before the bot is promoted widely.

## Verified in code (automated tests)

- Every error the website can send has a clear message in the bot (missing handle, missing contest, empty class, invalid input, outage, timeout).
- A missing Codeforces handle or contest is reported as such, and is never mistaken for an outage.
- Replies never contain raw errors, tokens or secrets. Logs record error names and Telegram's reason only.
- Bot tests, website unit tests, database tests, type check, lint and production build all pass.

## Must be checked by a person before wide use

1. **Live Telegram check.** Try every command in a private chat and in a test group, and every button, including Refresh.
2. **Database changes applied to production**, after approval: `20261103120000_roster_status` and `20261110120000_stored_solves`. Confirm with `prisma migrate status`.
3. **Secrets.** Rotate the Neon password (it was pasted into a chat earlier). Set `OWNER_TELEGRAM_ID` in Vercel. Keep `.env` files out of git.
4. **Codeforces terms.** Confirm the way the bot uses the public API (standings, user information, problem sets) is allowed for a public product, and that the attribution is correct.
5. **Privacy notice.** Publish the final version. Confirm that `/stop`, `/disconnect` and account deletion remove what they say they remove. The routine that prunes old delivery records is not built yet.
6. **Plans and limits.** Vercel's Hobby plan is for non-commercial use. Neon's free plan limits compute time and connections. Public growth or any payment needs the paid plans.
7. **Backups.** Test restoring a backup into a separate database before relying on it.
8. **Monitoring.** Check the Vercel logs regularly, and set up an uptime check on `https://algoryva.vercel.app/api/telegram` (it should return 401 without a secret).
9. **Telegram profile.** About and Description are set in BotFather. The command menu is set with `npm run profile`. The profile picture is set.
10. **Support.** Algoryva@gmail.com is monitored.
