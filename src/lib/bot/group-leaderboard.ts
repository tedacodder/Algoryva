import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { hashTelegramId } from "@/lib/telegram/bot-auth";
import { CodeforcesError, userInfo, type Accepted } from "@/lib/codeforces/client";
import { checkPending } from "@/lib/bot/classroom";
import { syncHandle, syncStates, type SyncState } from "@/lib/bot/solves";

/**
 * The group leaderboard, computed from stored solves. Week, month and all-time are calendar periods in UTC: the week starts on Monday,
 * the month on the 1st. A finished period never changes. Score = solved + 2 x active days. Ties break on consistency, then rating, then handle.
 * Codeforces is only asked for what is new, at most once per member every ten minutes, within a time budget.
 */
export const LEADERBOARD_BUDGET_MS = 35_000;
export const PERIODS = ["week", "month", "all"] as const;
export type Period = (typeof PERIODS)[number];
export type Row = { rank: number; handle: string; rating: number | null; solved: number; activeDays: number; consistency: number; score: number };
type Scored = Omit<Row, "rank">;
const DAY = 86_400;
const FRESH_MS = 10 * 60_000;

const dayOf = (seconds: number) => Math.floor(seconds / DAY);

/** The first second of the period, in seconds. Calendar periods, in UTC. */
export function periodStart(period: Period, now: Date): number {
  if (period === "all") return 0;
  if (period === "month") return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset) / 1000);
}

/** Days of the period so far, at least 1. All-time has no fixed length, so it is null (measured from the first solve instead). */
export function periodDays(period: Period, now: Date): number | null {
  if (period === "all") return null;
  if (period === "week") return ((now.getUTCDay() + 6) % 7) + 1;
  return now.getUTCDate();
}

/** Pure: one member's numbers for a period. Consistency is active days as a share of the days so far. */
export function scoreMember(handle: string, rating: number | null, accepted: Accepted[], period: Period, now: Date): Scored {
  const start = periodStart(period, now);
  const within = accepted.filter((a) => a.at >= start);
  const solved = within.length;
  const activeDays = new Set(within.map((a) => dayOf(a.at))).size;
  const days = periodDays(period, now);
  let spanDays: number;
  if (days === null) {
    const dated = accepted.map((a) => a.at).filter((t) => t > 0);
    spanDays = dated.length === 0 ? 1 : Math.max(1, dayOf(Math.floor(now.getTime() / 1000)) - dayOf(Math.min(...dated)) + 1);
  } else {
    spanDays = days;
  }
  const consistency = Math.min(100, Math.round((activeDays / spanDays) * 100));
  return { handle, rating, solved, activeDays, consistency, score: solved + 2 * activeDays };
}

/** Pure: sorts by score, then consistency, rating and handle. Equal scores share a rank (competition ranking: 1, 1, 3). */
export function rankRows(rows: Scored[]): Row[] {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || b.consistency - a.consistency || (b.rating ?? -1) - (a.rating ?? -1) || a.handle.localeCompare(b.handle),
  );
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((row, index) => {
    if (row.score !== previous) {
      rank = index + 1;
      previous = row.score;
    }
    return { ...row, rank };
  });
}

async function groupRecipient(secret: string, chatId: string) {
  const row = await db.telegramRecipient.findUnique({ where: { chatHash: hashTelegramId(secret, chatId) }, select: { id: true, kind: true } });
  if (!row || row.kind !== "group") throw new ApiError(409, "group_not_enabled", "A group admin needs to send /enable first.");
  return row;
}

async function cachedRating(handle: string, now: Date): Promise<number | null | undefined> {
  const row = await db.cfCache.findUnique({ where: { key: `user:${handle.toLowerCase()}` } });
  if (!row || now.getTime() - row.fetchedAt.getTime() >= FRESH_MS) return undefined;
  return (row.payload as { rating?: number | null }).rating ?? null;
}

export async function groupLeaderboard(secret: string, chatId: string, period: Period, now: Date, options: { budgetMs?: number } = {}) {
  const budget = options.budgetMs ?? LEADERBOARD_BUDGET_MS;
  const deadline = Date.now() + budget;
  const group = await groupRecipient(secret, chatId);
  // A refresh also checks the students queued for checking, within its share of the budget.
  await checkPending(group.id, now, Math.floor(budget * 0.4));
  const rosterRows = await db.groupRoster.findMany({ where: { recipientId: group.id, status: "valid" }, orderBy: { addedAt: "asc" }, select: { handle: true } });
  const checking = await db.groupRoster.count({ where: { recipientId: group.id, status: "pending" } });
  const usesConnectedFallback = rosterRows.length === 0;
  const roster = usesConnectedFallback
    ? (await db.cfHandle.findMany({ where: { recipientId: group.id }, select: { handle: true } })).map((r) => r.handle)
    : rosterRows.map((r) => r.handle);
  const known = roster.length
    ? await db.cfHandle.findMany({ where: { OR: roster.map((h) => ({ handle: { equals: h, mode: "insensitive" as const } })) }, select: { handle: true } })
    : [];
  const knownSet = new Set(known.map((k) => k.handle.toLowerCase()));
  const registered = roster.filter((h) => knownSet.has(h.toLowerCase()));
  const notRegistered = roster.filter((h) => !knownSet.has(h.toLowerCase()));

  // Stored solves for the period, read in one query. Nothing here calls Codeforces.
  const solveRows = registered.length
    ? await db.cfSolve.findMany({
        where: { handle: { in: registered.map((h) => h.toLowerCase()) }, acceptedAt: { gte: new Date(periodStart(period, now) * 1000) } },
        select: { handle: true, problemRef: true, acceptedAt: true },
      })
    : [];
  const byHandle = new Map<string, Accepted[]>();
  for (const r of solveRows) {
    const list = byHandle.get(r.handle) ?? [];
    list.push({ ref: r.problemRef, at: Math.floor(r.acceptedAt.getTime() / 1000) });
    byHandle.set(r.handle, list);
  }
  const states = await syncStates(registered);

  const scored: Scored[] = [];
  const pending: string[] = [];
  for (const handle of registered) {
    let state: SyncState | undefined = states.get(handle.toLowerCase());
    const stale = !state || !state.backfilled || now.getTime() - state.syncedAt.getTime() >= FRESH_MS;
    if (stale && Date.now() < deadline) {
      try {
        state = await syncHandle(handle, now, !state?.backfilled);
      } catch (e) {
        if (!(e instanceof CodeforcesError)) throw e;
      }
    }
    if (!state?.backfilled) {
      // Never read in full, so its numbers cannot be shown honestly yet.
      pending.push(handle);
      continue;
    }
    let rating = await cachedRating(handle, now);
    if (rating === undefined && Date.now() < deadline) {
      try {
        rating = (await userInfo(handle, now)).rating;
      } catch (e) {
        if (!(e instanceof CodeforcesError)) throw e;
      }
    }
    scored.push(scoreMember(handle, rating ?? null, byHandle.get(handle.toLowerCase()) ?? [], period, now));
  }
  return {
    period,
    rows: rankRows(scored),
    rosterCount: roster.length,
    registered: registered.length,
    notRegistered,
    pending,
    checking,
    usesConnectedFallback,
    checkedAt: now.toISOString(),
  };
}
