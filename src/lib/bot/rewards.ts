import "server-only";
import { db } from "@/lib/db";
import { rankedBetween, type Ranked } from "@/lib/bot/leaderboard";
import { utcDay } from "@/lib/bot/daily";

/**
 * Weekly rewards, calendar weeks in UTC (Monday to Sunday). Each one is earned by verified work only (output-matched solves), needs no
 * money, and is awarded once per week:
 *   - podium_1, podium_2, podium_3: the top three on the public board, with at least PODIUM_MIN_SOLVED counted solves. Only students
 *     who opted in can appear there, so the podium never reveals anyone who chose to stay hidden.
 *   - steady_week: output-matched solves on at least STEADY_MIN_DAYS different days. Private: no ranking involved.
 * A reward appears in /progress and is sent as a private message to the student's linked private chat.
 */
export const PODIUM_SIZE = 3;
export const PODIUM_MIN_SOLVED = 3;
export const STEADY_MIN_DAYS = 5;
const DAY_MS = 86_400_000;

/** Pure: the Monday 00:00 UTC that starts the week containing `now`. */
export function weekStart(now: Date): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY_MS);
}

/** Pure: the complete week before the one containing `now`. */
export function previousWeek(now: Date): { start: Date; end: Date; key: string } {
  const end = weekStart(now);
  const start = new Date(end.getTime() - 7 * DAY_MS);
  return { start, end, key: utcDay(start) };
}

/** Pure: the top PODIUM_SIZE entries that meet the minimum. Ranks are 1, 2, 3 in board order. */
export function podiumFrom(ranked: Ranked[]): { userId: string; rank: number; solved: number }[] {
  return ranked
    .filter((r) => r.solved >= PODIUM_MIN_SOLVED)
    .slice(0, PODIUM_SIZE)
    .map((r, i) => ({ userId: r.userId, rank: i + 1, solved: r.solved }));
}

/** Pure: users with output-matched solves on at least STEADY_MIN_DAYS distinct UTC days, with that day count. */
export function steadyUsers(solves: { userId: string; solvedAt: Date }[]): { userId: string; days: number }[] {
  const days = new Map<string, Set<number>>();
  for (const s of solves) {
    const set = days.get(s.userId) ?? new Set<number>();
    set.add(Math.floor(s.solvedAt.getTime() / DAY_MS));
    days.set(s.userId, set);
  }
  return [...days.entries()]
    .filter(([, set]) => set.size >= STEADY_MIN_DAYS)
    .map(([userId, set]) => ({ userId, days: set.size }));
}

/**
 * Awards the previous complete week, once. The period row is written last, so a crash before it only repeats the same idempotent
 * inserts on the next run. Returns how many awards were written in this run (0 when the week was already done).
 */
export async function awardPreviousWeek(now: Date): Promise<number> {
  const { start, end, key } = previousWeek(now);
  const done = await db.rewardPeriod.findUnique({ where: { periodKey: key }, select: { periodKey: true } });
  if (done) return 0;

  const podium = podiumFrom(await rankedBetween(start, end));
  const solves = await db.problemSolve.findMany({
    where: { verification: "OUTPUT_MATCHED", solvedAt: { gte: start, lt: end }, user: { suspended: false } },
    select: { userId: true, solvedAt: true },
  });
  const awards = [
    ...podium.map((p) => ({ userId: p.userId, kind: `podium_${p.rank}`, detail: `${p.solved} solves` })),
    ...steadyUsers(solves).map((s) => ({ userId: s.userId, kind: "steady_week", detail: `${s.days} days` })),
  ];

  if (awards.length > 0) {
    await db.botReward.createMany({
      data: awards.map((a) => ({ userId: a.userId, kind: a.kind, periodKey: key, detail: a.detail })),
      skipDuplicates: true,
    });
    const winners = [...new Set(awards.map((a) => a.userId))];
    const chats = await db.telegramRecipient.findMany({
      where: { userId: { in: winners }, kind: "private", blocked: false },
      select: { id: true, userId: true },
    });
    const rows = chats.flatMap((c) =>
      awards
        .filter((a) => a.userId === c.userId)
        .map((a) => ({ recipientId: c.id, kind: "reward", key: `${a.kind}:${key}`, ref: `${a.kind}|${a.detail}` })),
    );
    if (rows.length > 0) await db.notificationDelivery.createMany({ data: rows, skipDuplicates: true });
  }
  await db.rewardPeriod.createMany({ data: [{ periodKey: key }], skipDuplicates: true });
  return awards.length;
}
