import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
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

/**
 * The problems a handle has solved (verdict OK), as "contestId/index" references. Null when Codeforces is unreachable and nothing is cached,
 * in which case callers do not exclude anything and say so. Only the most recent 10,000 submissions are read.
 */
export async function userSolved(handle: string, now: Date): Promise<string[] | null> {
  return cached<string[]>(`solved:${handle.toLowerCase()}`, USER_TTL_MS, now, async () => {
    const subs = await call<Json[]>("user.status", { handle, from: "1", count: "10000" });
    const refs = new Set<string>();
    for (const s of subs) {
      const problem = s.problem as Json | undefined;
      if (s.verdict === "OK" && problem && typeof problem.contestId === "number" && typeof problem.index === "string") {
        refs.add(`${problem.contestId}/${problem.index}`);
      }
    }
    return [...refs];
  });
}
