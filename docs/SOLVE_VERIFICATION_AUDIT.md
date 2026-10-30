# Solve verification: effects audit

Scope: the new `verification` column on `ProblemSolve` and `ContestSolve` (migration `20261026090000_solve_verification`). This
document lists every reader of solve records, what it does with the new field, and what was deliberately left unchanged.

**Principle used:** no existing number on the website changes in this round. XP, badges, streaks and contest standings still count every
solve, exactly as before. The new field is written by every writer and read only by new bot features. Changing the website's rankings
is a product decision, and it needs the production counts (see `ops/production/01-inspect-before.sql`) before anyone makes it.

## 1. Values

| Value | Meaning | How it is written |
|---|---|---|
| `OUTPUT_MATCHED` | Pasted output matched every server-side test, including a hidden one | Judge on the website (`checkOutput`, practice and contest) and the mobile judge (`/api/v1/submissions`) |
| `SELF_REPORTED` | A learner marked an external problem solved | `toggleSolved`, contest `markSolvedInContest`, mobile `solve.external` event |
| `LEGACY_UNVERIFIED` | Recorded before the column existed, or not provably either of the above | Column default. Any writer that forgets the field produces this value, which is the safe failure |

## 2. The backfill rule and why it is narrow

External problems cannot be judged, and the admin form disables the problem kind after creation, so every solve on an external problem
was a learner's own mark. The migration sets `SELF_REPORTED` for those rows only.

Internal problems are not backfilled. Before the AUD-004 fix, an internal problem could be marked solved without a pass. A row from that
period is indistinguishable from a judged row, so it stays `LEGACY_UNVERIFIED`. This is the conservative reading the owner asked for.

Verified: `tests/migrations/backfill-solve-verification.sql` seeds one external and one internal solve in both tables, applies the
migration, and asserts the values and the row counts. It passes on a disposable test database. Production has not been checked.

## 3. Every reader of solve records

| Reader | Where | What it counts | Effect of this change | Decision |
|---|---|---|---|---|
| XP | `src/lib/stats.ts` → `computeXp` (`src/lib/gamification.ts`) | All `ProblemSolve` rows, by difficulty | **None.** Legacy internal solves still earn XP | Unchanged. Recommend deciding after the production count of legacy internal solves |
| Badges | `BADGES` in `gamification.ts` (First Solve, Ten Solves, Hard Problem) | Same count as XP | **None** | Same as XP |
| Streaks | `src/lib/activity.ts` → `getStreak`, `computeStreak` (UTC days) | `Activity` rows of any type, including `problem_solved` | **None.** A self-reported solve still keeps a streak alive | Unchanged. Streaks count distinct UTC days, so re-marking a solve on the same day cannot extend a streak |
| Dashboard week strip | `getWeekActivity` | `Activity` counts per day | **None**. Re-marking a self-reported solve creates a new activity row, which can inflate that day's bar | Known, minor. Recommend recording activity only on the first award |
| Contest standings | `src/lib/contests.ts` → `leaderboard`, `scoreEntry` | All `ContestSolve` rows | **None.** External self-reported contest solves still rank | Unchanged. Recommend showing the verification value next to each solve before changing ranking |
| Problem status (solved or not) | `src/app/problems/*`, `src/lib/problems.ts`, `learn/[slug]/page.tsx` | Existence of a row | **None** | Unchanged, correct as is |
| Practice next and recommendations | dashboard and learn pages | Existence of a row | **None** | Unchanged |
| Admin analytics | `src/app/admin/analytics/page.tsx` | Row counts | **None** | Unchanged. Could be split by verification later |
| Mobile sync pull | `src/lib/mobile/pull.ts` → solves list | `problemId`, `solvedAt` only | **None.** The field is not sent | Deliberately unchanged. Adding a field would change the sync contract the mobile app depends on |
| Mobile judge | `src/lib/mobile/submissions.ts` | Writes `OUTPUT_MATCHED` | New behaviour: the same already-counted note as the website | Parity test updated, see section 5 |
| **Bot progress** (new) | `src/lib/bot/progress.ts` | Breakdown by verification; XP and badges from the website's functions | Shows the breakdown. XP matches the website | New |
| **Bot weekly leaderboard** (new) | `src/lib/bot/leaderboard.ts` | `OUTPUT_MATCHED` only, opted-in accounts only, at most 3 counted solves per day | New. The only ranking that uses the field | New |

## 4. Other behaviour changes in this round

- **The judge explains a pass that records nothing.** Before this round, when the contest write recorded nothing (timer ended between the checks and the write, or the solve already counted), the response had no note. The UI could show a pass with no solve. Now it always carries a note (`NOT_RECORDED_CONTEST` or `NOT_RECORDED_PRACTICE`). Regression tests fail on the old behaviour and pass on the new one.
- **A retried submission is told it was already counted.** The first pass records the solve. A retry returns the same grading, and its note says nothing new was recorded. The old test asserted identical responses, and it was updated to assert this behaviour. Both calls still go through the idempotent helper.
- **The mobile judge gives the same already-counted note as the website.** The parity test checks the note matches exactly. The verdict is not changed by this note.

## 5. What was not changed, and why

- No ranking, XP or badge number was altered. Each would change what a student sees on the live site, and each needs the production counts first.
- The mobile sync contract was not changed.
- No solve row was deleted or rewritten, except the narrow backfill column.

## 6. Decisions for the owner

1. **Legacy internal solves.** Do they count toward XP and badges? (Recommended: keep counting, but label them on the website.)
2. **Contest standings.** Should self-reported external solves rank? (Recommended: rank them, but show the source beside each solve.)
3. **Activity on re-mark.** Should re-marking an external solve create activity again? (Recommended: no, record activity on the first award only.)

Each decision is a one-line change in the reader listed above, plus a test. None is made in this round.
