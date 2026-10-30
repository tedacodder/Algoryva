# Rewards: free, bot-only, earned by verified work

Status: **built and tested** (website unit and integration tests; bot tests). Nothing is deployed.

## The two rewards

| Reward | Who earns it | Rule | Where it appears |
|---|---|---|---|
| **Podium** (#1, #2, #3) | The top three on the public weekly board | Output-matched solves only, opted-in accounts only, at least 3 counted solves, same scoring and daily cap as the board | Private message to the winner's linked chat, and `/progress` |
| **Steady week** | Any linked student | Output-matched solves on at least 5 different UTC days in the week | Private message to the student's linked chat, and `/progress` |

Weeks are calendar weeks in UTC, Monday to Sunday. Each complete week is awarded once, the first time the bot runs after it ends. A second run writes nothing.

## Why this is a sound reward

- **Cannot be bought or bulk-farmed.** Only output-matched solves count, and the board already caps each day at three solves. Self-reported and legacy solves earn nothing (tested).
- **Privacy-safe.** The podium is public only for students who already chose to be on the board. The steady-week reward is private, and needs no ranking at all.
- **Costs nothing.** No money, no paid service, no extra infrastructure. Two database tables, and Telegram messages.
- **Rewards consistency, not just volume.** The steady-week reward needs five different days. A single long session earns nothing extra.
- **Does not duplicate existing systems.** XP, badges, streaks and the board are unchanged. The rewards are a separate, weekly layer on top of them.

## Testing

- Pure rules: week boundaries at Sunday 23:59 and Monday 00:00 UTC, the podium minimum and ordering, distinct-day counting.
- Integration (real PostgreSQL): correct podium order and counts, opt-in exclusion (a non-linked student cannot be on the board), self-reported solves ignored, a student with four days not rewarded, a second run writes nothing, a reward reaches only the linked private chat and not twice, `/progress` shows it, deleting the account removes it (verified).
- Bot: rewards appear in `/progress` with their week; unknown reward kinds are skipped.

## Change later if you want

- Podium size, the minimum solve count, or the steady-week day count: constants in `src/lib/bot/rewards.ts`.
- Group announcements of the podium: not built. This would be a new opt-in group setting, and the default is private only.
- Badges that persist beyond the week: not built. The reward is recorded and shown; a permanent badge would need an owner decision.
