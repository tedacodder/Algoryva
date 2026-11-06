import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseStandings, type Standings } from "./standings";
import type { CfContest, CfProblem } from "@/lib/codeforces/pick";

/**
 * Public Codeforces API, read-only and anonymous. Only documented methods are used:
 *   problemset.problems, contest.list, user.info, user.status.
 * Every response is cached in CfCache, and calls are spaced at least two seconds apart, which is the documented limit.
 * Nothing here throws raw network errors into the bot: failures become CodeforcesError, and the last good copy is served when one exists.
 */
const BASE = "https://codeforces.com/api";
const PROBLEMSET_TTL_MS = 24 * 3_600_000;
const CONTESTS_TTL_MS = 10 * 60_000;
export const USER_TTL_MS = 10 * 60_000;
const USER_AGENT = "codeforces-daily-bot/1.0 (+https://algoryva.vercel.app)";
const MIN_GAP_MS = process.env.NODE_ENV === "test" ? 0 : 2100;

export class CodeforcesError extends Error {
  constructor(message: string, readonly kind: "not_found" | "unavailable") {
    super(message);
  }
}

type Json = Record<string, unknown>;

let queue: Promise<void> = Promise.resolve();
let lastCallAt = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs calls one at a time, at least MIN_GAP_MS apart. */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    return task();
  });
  queue = run.then(() => undefined, () => undefined);
  return run;
}

type Envelope<T> = { status?: string; result?: T; comment?: string };

/** Fetches and parses one API response. Network failures become CodeforcesError(unavailable). A non-JSON body counts as unavailable. */
async function fetchEnvelope<T>(url: URL): Promise<Envelope<T>> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new CodeforcesError(`${url.pathname} unreachable`, "unavailable");
  }
  const parsed: unknown = await res.json().catch(() => null);
  return parsed !== null && typeof parsed === "object" ? (parsed as Envelope<T>) : {};
}

async function call<T>(method: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}/${method}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return throttled(async () => {
    const body = await fetchEnvelope<T>(url);
    if (body.status === "OK" && body.result !== undefined) return body.result;
    if (body.status === "FAILED" && /not found/i.test(body.comment ?? "")) throw new CodeforcesError(`${method}: not found`, "not_found");
    throw new CodeforcesError(`${method} unavailable`, "unavailable");
  });
}

const isFresh = (fetchedAt: Date, ttl: number, now: Date) => now.getTime() - fetchedAt.getTime() < ttl;

async function cached<T>(key: string, ttlMs: number, now: Date, load: () => Promise<T>): Promise<T | null> {
  const row = await db.cfCache.findUnique({ where: { key } });
  if (row && isFresh(row.fetchedAt, ttlMs, now)) return row.payload as unknown as T;
  try {
    const value = await load();
    const payload = value as unknown as Prisma.InputJsonValue;
    await db.cfCache.upsert({ where: { key }, create: { key, payload, fetchedAt: now }, update: { payload, fetchedAt: now } });
    return value;
  } catch (e) {
    if (e instanceof CodeforcesError && e.kind === "not_found") throw e;
    return row ? (row.payload as unknown as T) : null;
  }
}

/** The problemset, trimmed to what the bot uses. Null only when Codeforces is unreachable and nothing was cached. */
export function problemset(now: Date): Promise<CfProblem[] | null> {
  return cached<CfProblem[]>("problemset", PROBLEMSET_TTL_MS, now, async () => {
    const result = await call<{ problems: Json[] }>("problemset.problems");
    return result.problems
      .filter((p) => typeof p.contestId === "number" && typeof p.index === "string" && typeof p.name === "string")
      .map((p) => ({
        contestId: p.contestId as number,
        index: p.index as string,
        name: p.name as string,
        ...(typeof p.rating === "number" ? { rating: p.rating } : {}),
        tags: Array.isArray(p.tags) ? (p.tags as unknown[]).filter((t): t is string => typeof t === "string") : [],
      }));
  });
}

/** Upcoming contests only (phase BEFORE), trimmed. Null when unreachable and nothing cached. */
export function upcomingContests(now: Date): Promise<CfContest[] | null> {
  return cached<CfContest[]>("contests", CONTESTS_TTL_MS, now, async () => {
    const all = await call<Json[]>("contest.list", { gym: "false" });
    return all
      .filter((c) => c.phase === "BEFORE" && typeof c.id === "number" && typeof c.startTimeSeconds === "number")
      .map((c) => ({
        id: c.id as number,
        name: String(c.name ?? `Contest ${c.id}`),
        startTimeSeconds: c.startTimeSeconds as number,
        durationSeconds: typeof c.durationSeconds === "number" ? c.durationSeconds : 0,
        phase: "BEFORE",
      }));
  });
}

/**
 * A Codeforces user's public handle and rating. Throws CodeforcesError(not_found) for an unknown handle.
 * Returns the handle with Codeforces' own capitalisation.
 */
export async function userInfo(handle: string, now: Date): Promise<{ handle: string; rating: number | null }> {
  const key = `user:${handle.toLowerCase()}`;
  const row = await db.cfCache.findUnique({ where: { key } });
  if (row && isFresh(row.fetchedAt, USER_TTL_MS, now)) return row.payload as unknown as { handle: string; rating: number | null };
  try {
    const result = await call<Json[]>("user.info", { handles: handle });
    const u = result[0] ?? {};
    const info = { handle: String(u.handle ?? handle), rating: typeof u.rating === "number" ? u.rating : null };
    const payload = info as unknown as Prisma.InputJsonValue;
    await db.cfCache.upsert({ where: { key }, create: { key, payload, fetchedAt: now }, update: { payload, fetchedAt: now } });
    return info;
  } catch (e) {
    if (e instanceof CodeforcesError && e.kind === "not_found") throw e;
    if (row) return row.payload as unknown as { handle: string; rating: number | null };
    throw new CodeforcesError("user.info unavailable", "unavailable");
  }
}

/** An accepted problem and when it was first accepted (Unix seconds). */
export type Accepted = { ref: string; at: number };

/**
 * Accepted problems for a handle, one entry per problem with its first accepted time. One user.status call fills this cache,
 * and the solved list shares that call. Returns null when Codeforces is unreachable and nothing is cached.
 */
async function loadAccepted(handle: string, now: Date): Promise<Accepted[] | null> {
  const key = `accepted:${handle.toLowerCase()}`;
  const row = await db.cfCache.findUnique({ where: { key } });
  if (row && isFresh(row.fetchedAt, USER_TTL_MS, now)) return row.payload as unknown as Accepted[];
  try {
    const subs = await call<Json[]>("user.status", { handle, from: "1", count: "10000" });
    const first = new Map<string, Accepted>();
    for (const s of subs) {
      const problem = s.problem as Json | undefined;
      if (s.verdict === "OK" && problem && typeof problem.contestId === "number" && typeof problem.index === "string") {
        const ref = `${problem.contestId}/${problem.index}`;
        const at = typeof s.creationTimeSeconds === "number" ? s.creationTimeSeconds : 0;
        const previous = first.get(ref);
        if (!previous || at < previous.at) first.set(ref, { ref, at });
      }
    }
    const list = [...first.values()];
    const payload = list as unknown as Prisma.InputJsonValue;
    await db.cfCache.upsert({ where: { key }, create: { key, payload, fetchedAt: now }, update: { payload, fetchedAt: now } });
    return list;
  } catch (e) {
    if (e instanceof CodeforcesError && e.kind === "not_found") throw e;
    return row ? (row.payload as unknown as Accepted[]) : null;
  }
}

/** Accepted problems with their times. Null when unknown. */
export async function userAccepted(handle: string, now: Date): Promise<Accepted[] | null> {
  return loadAccepted(handle, now);
}

/**
 * The problems a handle has solved (verdict OK), as "contestId/index" references. Null when Codeforces is unreachable and nothing is cached,
 * in which case callers do not exclude anything and say so.
 */
export async function userSolved(handle: string, now: Date): Promise<string[] | null> {
  return cached<string[]>(`solved:${handle.toLowerCase()}`, USER_TTL_MS, now, async () => {
    const list = await loadAccepted(handle, now);
    if (list === null) throw new CodeforcesError("user.status unavailable", "unavailable");
    return list.map((x) => x.ref);
  });
}

/** Contests of every kind on Codeforces (not gym), so a running or finished one can be found. */
export async function contestsAll(now: Date): Promise<{ id: number; name: string; startTimeSeconds: number; durationSeconds: number; phase: string }[] | null> {
  return cached(`contest.list:all`, 5 * 60_000, now, async () => {
    const list = await call<Json[]>("contest.list", { gym: "false" });
    return list.map((c) => ({
      id: Number(c.id),
      name: String(c.name),
      startTimeSeconds: Number(c.startTimeSeconds ?? 0),
      durationSeconds: Number(c.durationSeconds ?? 0),
      phase: String(c.phase ?? ""),
    }));
  });
}

/** A contest's standings: the top of the field, or only the given handles. Refreshed every five minutes, so a live contest stays current. */
export async function contestStandings(contestId: number, handles: string[], top: number, now: Date): Promise<Standings | null> {
  const scope = handles.length ? handles.map((h) => h.toLowerCase()).sort().join(",") : `top${top}`;
  return cached<Standings>(`standings:${contestId}:${scope}`, 5 * 60_000, now, async () => {
    const params: Record<string, string> = handles.length
      ? { contestId: String(contestId), handles: handles.join(";"), from: "1", count: "10000" } // a short count could cut off a member ranked low in a big contest
      : { contestId: String(contestId), from: "1", count: String(top) };
    return parseStandings(await call<Json>("contest.standings", params));
  });
}

export type RatingChange = { contestId: number; oldRating: number; newRating: number; rank: number };

/** A handle's rating history: one entry per rated contest. */
export async function userRatingHistory(handle: string, now: Date): Promise<RatingChange[] | null> {
  return cached<RatingChange[]>(`rating-history:${handle.toLowerCase()}`, USER_TTL_MS, now, async () => {
    const list = await call<Json[]>("user.rating", { handle });
    return list.map((c) => ({ contestId: Number(c.contestId), oldRating: Number(c.oldRating), newRating: Number(c.newRating), rank: Number(c.rank) }));
  });
}

export type Profile = { handle: string; rating: number | null; maxRating: number | null; rank: string | null; maxRank: string | null };

/** A handle's current profile: rating, best rating, rank and best rank. */
export async function userProfile(handle: string, now: Date): Promise<Profile | null> {
  return cached<Profile>(`profile:${handle.toLowerCase()}`, USER_TTL_MS, now, async () => {
    const [u] = await call<Json[]>("user.info", { handles: handle });
    return {
      handle: String(u.handle),
      rating: u.rating == null ? null : Number(u.rating),
      maxRating: u.maxRating == null ? null : Number(u.maxRating),
      rank: u.rank == null ? null : String(u.rank),
      maxRank: u.maxRank == null ? null : String(u.maxRank),
    };
  });
}

export type ProbeResult = { status: string; comment: string | null; rows: { rank: number; handle: string; type: string }[] };

/** A direct, uncached check of one handle in one contest: what Codeforces returns right now. Used by /cfcheck to test the API from the server. */
export async function probeStanding(contestId: number, handle: string, unofficial: boolean): Promise<ProbeResult> {
  try {
    const data = await call<Json>("contest.standings", { contestId: String(contestId), handles: handle, from: "1", count: "10000", showUnofficial: unofficial ? "true" : "false" });
    const rows = ((data.rows as Json[] | undefined) ?? []).map((r) => {
      const party = r.party as Json;
      const member = ((party.members as Json[] | undefined) ?? [])[0] ?? {};
      return { rank: Number(r.rank), handle: String(member.handle ?? ""), type: String(party.participantType ?? "") };
    });
    return { status: "OK", comment: null, rows };
  } catch (e) {
    return { status: "FAILED", comment: e instanceof Error ? e.message.slice(0, 200) : "unknown error", rows: [] };
  }
}

