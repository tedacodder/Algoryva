import { createHash } from "node:crypto";

/** Pure Codeforces helpers. No network, no database, so they can be tested exhaustively. */
export type CfProblem = { contestId: number; index: string; name: string; rating?: number; tags: string[] };
export type CfContest = { id: number; name: string; startTimeSeconds: number; durationSeconds: number; phase: string };
export type RandomFilter = { minRating: number; maxRating: number; tags: string[] };

/** Daily problems are drawn from this rating band. A fixed band keeps the difficulty predictable for newcomers. */
export const DAILY_RANGE = { min: 800, max: 1400 } as const;
/** Random problems default to a wider band; a student can narrow it with /random. */
export const RANDOM_DEFAULT: RandomFilter = { minRating: 800, maxRating: 2000, tags: [] };

export const problemRef = (p: Pick<CfProblem, "contestId" | "index">) => `${p.contestId}/${p.index}`;
export const problemUrl = (p: Pick<CfProblem, "contestId" | "index">) => `https://codeforces.com/problemset/problem/${problemRef(p)}`;
export const contestUrl = (id: number) => `https://codeforces.com/contests/${id}`;

/**
 * A deterministic "random" pick for the daily problem. The seed is a hash of the chat and the UTC day, so every request for the same
 * chat and day returns the same problem, and different chats and days get different ones. Problems recently sent are skipped when possible.
 */
export function pickDailyProblem(problems: CfProblem[], seed: string, exclude: ReadonlySet<string> = new Set(), range = DAILY_RANGE): CfProblem | null {
  const inRange = problems
    .filter((p) => typeof p.rating === "number" && p.rating >= range.min && p.rating <= range.max && p.index.length > 0)
    .sort((a, b) => problemRef(a).localeCompare(problemRef(b)));
  const fresh = inRange.filter((p) => !exclude.has(problemRef(p)));
  const pool = fresh.length > 0 ? fresh : inRange;
  if (pool.length === 0) return null;
  const n = createHash("sha256").update(seed).digest().readUInt32BE(0) % pool.length;
  return pool[n];
}

/** Codeforces tags can contain spaces ("dfs and similar"). A dash works just as well in a command, so both forms compare equal. */
export const normaliseTag = (t: string) => t.trim().toLowerCase().replace(/[\s-]+/g, "-");

/** True when a problem is inside the rating band and carries every requested tag. */
export function matchesFilter(p: CfProblem, f: RandomFilter): boolean {
  if (typeof p.rating !== "number" || p.rating < f.minRating || p.rating > f.maxRating) return false;
  const have = new Set(p.tags.map(normaliseTag));
  return f.tags.every((t) => have.has(normaliseTag(t)));
}

/** A truly random pick (not seeded): every /random call gives a new problem. Problems in `exclude` are never returned. */
export function pickRandomProblem(problems: CfProblem[], filter: RandomFilter, exclude: ReadonlySet<string> = new Set(), rng: () => number = Math.random): CfProblem | null {
  const pool = problems.filter((p) => matchesFilter(p, filter) && !exclude.has(problemRef(p)));
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** Contests that start after `now` and no later than `minutes` from now, earliest first. Only contests not yet started count. */
export function contestsStartingWithin(contests: CfContest[], now: Date, minutes = 10): CfContest[] {
  const from = now.getTime();
  const to = from + minutes * 60_000;
  return contests
    .filter((c) => c.phase === "BEFORE" && c.startTimeSeconds * 1000 > from && c.startTimeSeconds * 1000 <= to)
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}

/** Contests in the list whose id is not in `seen`. Used to detect a contest the first time it is posted. */
export function newlyPosted(contests: CfContest[], seen: ReadonlySet<string>): CfContest[] {
  return contests.filter((c) => !seen.has(String(c.id)));
}

/** Contests ordered by start time, soonest first. */
export function soonestFirst(contests: CfContest[]): CfContest[] {
  return [...contests].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}
