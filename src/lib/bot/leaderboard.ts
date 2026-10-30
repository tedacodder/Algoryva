import "server-only";
import { db } from "@/lib/db";

/**
 * The weekly leaderboard. Only output-matched solves count, and only for accounts that opted in. Self-reported and legacy solves
 * are never ranked. Each day counts at most DAILY_CAP solves, so repeated easy solves cannot farm the table. Ties break on username,
 * so the order is deterministic.
 */
export const WEEK_DAYS = 7;
export const DAILY_CAP = 3;
export const PAGE_SIZE = 20;
const POINTS: Record<string, number> = { EASY: 1, MEDIUM: 2, HARD: 3, EXPERT: 4 };

const utcDayIndex = (d: Date) => Math.floor(d.getTime() / 86_400_000);

export type Ranked = { userId: string; username: string; score: number; solved: number };

/** Pure: scores solves by user and UTC day, caps each day, and sorts by score then username. */
export function scoreWeek(rows: { userId: string; username: string; solvedAt: Date; difficulty: string }[]): Ranked[] {
  const perUserDay = new Map<string, { userId: string; username: string; points: number[] }>();
  for (const r of rows) {
    const key = `${r.userId}|${utcDayIndex(r.solvedAt)}`;
    const bucket = perUserDay.get(key) ?? { userId: r.userId, username: r.username, points: [] };
    bucket.points.push(POINTS[r.difficulty] ?? 3);
    perUserDay.set(key, bucket);
  }
  const totals = new Map<string, Ranked>();
  for (const bucket of perUserDay.values()) {
    const counted = bucket.points.sort((a, b) => b - a).slice(0, DAILY_CAP);
    const t = totals.get(bucket.userId) ?? { userId: bucket.userId, username: bucket.username, score: 0, solved: 0 };
    t.score += counted.reduce((a, b) => a + b, 0);
    t.solved += counted.length;
    totals.set(bucket.userId, t);
  }
  return [...totals.values()]
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
}

/** The public board for any period. Only opted-in, unsuspended accounts are included. */
export async function rankedBetween(start: Date, end: Date): Promise<Ranked[]> {
  const rows = await db.problemSolve.findMany({
    where: {
      verification: "OUTPUT_MATCHED",
      solvedAt: { gte: start, lt: end },
      user: { suspended: false, telegramLink: { is: { leaderboardOptIn: true } } },
    },
    select: { userId: true, solvedAt: true, problem: { select: { difficulty: true } }, user: { select: { username: true } } },
  });
  return scoreWeek(rows.map((r) => ({ userId: r.userId, username: r.user.username, solvedAt: r.solvedAt, difficulty: r.problem.difficulty })));
}

export async function weeklyLeaderboard(now: Date, offset: number) {
  const start = new Date((utcDayIndex(now) - (WEEK_DAYS - 1)) * 86_400_000);
  const ranked = await rankedBetween(start, new Date(now.getTime() + 1));
  const page = ranked.slice(offset, offset + PAGE_SIZE);
  return {
    week: { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) },
    entries: page.map((e, i) => ({ rank: offset + i + 1, username: e.username, score: e.score, solved: e.solved })),
    nextOffset: offset + PAGE_SIZE < ranked.length ? offset + PAGE_SIZE : null,
  };
}
