import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { hashTelegramId } from "@/lib/telegram/bot-auth";
import { CodeforcesError, userAccepted, userInfo, type Accepted } from "@/lib/codeforces/client";

/**
 * The group leaderboard. Each member is ranked on what they did in the period: problems solved, active days, and consistency.
 * Score = solved + 2 × active days. Ties break on consistency, then rating, then handle, so the order is always the same.
 * Codeforces is rate-limited, so one request checks at most FETCH_BUDGET members. The rest are reported as pending.
 */
export const FETCH_BUDGET = 12;
export const PERIOD_DAYS = { week: 7, month: 30, all: null } as const;
export type Period = keyof typeof PERIOD_DAYS;
const DAY = 86_400;

export type Row = { rank: number; handle: string; rating: number | null; solved: number; activeDays: number; consistency: number; score: number };
type Scored = Omit<Row, "rank">;

const dayOf = (seconds: number) => Math.floor(seconds / DAY);

export function periodStart(period: Period, now: Date): number {
  const days = PERIOD_DAYS[period];
  return days === null ? 0 : Math.floor(now.getTime() / 1000) - days * DAY;
}

/** Pure: one member's numbers for a period. Consistency is active days as a share of the period (for all-time, of the days since the first solve). */
export function scoreMember(handle: string, rating: number | null, accepted: Accepted[], period: Period, now: Date): Scored {
  const start = periodStart(period, now);
  const within = accepted.filter((a) => a.at >= start);
  const solved = within.length;
  const activeDays = new Set(within.map((a) => dayOf(a.at))).size;
  let spanDays: number;
  if (PERIOD_DAYS[period] === null) {
    const dated = accepted.map((a) => a.at).filter((t) => t > 0);
    spanDays = dated.length === 0 ? 1 : Math.max(1, dayOf(Math.floor(now.getTime() / 1000)) - dayOf(Math.min(...dated)) + 1);
  } else {
    spanDays = PERIOD_DAYS[period] as number;
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

async function cachedAccepted(handle: string, now: Date): Promise<Accepted[] | null> {
  const row = await db.cfCache.findUnique({ where: { key: `accepted:${handle.toLowerCase()}` } });
  if (!row || now.getTime() - row.fetchedAt.getTime() >= 10 * 60_000) return null;
  return row.payload as unknown as Accepted[];
}

export async function groupLeaderboard(secret: string, chatId: string, period: Period, now: Date) {
  const group = await groupRecipient(secret, chatId);
  const rosterRows = await db.groupRoster.findMany({ where: { recipientId: group.id }, orderBy: { addedAt: "asc" }, select: { handle: true } });
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

  const scored: Scored[] = [];
  const pending: string[] = [];
  let budget = FETCH_BUDGET;
  for (const handle of registered) {
    let accepted = await cachedAccepted(handle, now);
    if (!accepted && budget > 0) {
      budget -= 1;
      try {
        accepted = await userAccepted(handle, now);
      } catch (e) {
        if (!(e instanceof CodeforcesError)) throw e;
        accepted = null;
      }
    }
    if (!accepted) {
      pending.push(handle);
      continue;
    }
    let rating: number | null = null;
    try {
      rating = (await userInfo(handle, now)).rating;
    } catch (e) {
      if (!(e instanceof CodeforcesError)) throw e;
    }
    scored.push(scoreMember(handle, rating, accepted, period, now));
  }
  return {
    period,
    rows: rankRows(scored),
    rosterCount: roster.length,
    registered: registered.length,
    notRegistered,
    pending,
    usesConnectedFallback,
    checkedAt: now.toISOString(),
  };
}
