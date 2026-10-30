import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/** The UTC calendar day, the same day boundary the streak uses. A student's daily challenge changes at 00:00 UTC. */
export const utcDay = (now: Date): string => now.toISOString().slice(0, 10);

const RECENT_DAYS = 14;

/** Deterministic order for one user and one day, so the pick does not depend on database row order. */
const rankKey = (userId: string, day: string, problemId: string) => createHash("sha256").update(`${userId}|${day}|${problemId}`).digest("hex");

export type DailyProblem = { id: string; slug: string; title: string; difficulty: string; samples: { input: string; expected: string }[] };

/**
 * The user's challenge for a UTC day. It is an original, published problem with at least one hidden test, which the user has not
 * solved and was not given in the last two weeks. The assignment is stored, so asking again the same day returns the same problem.
 * Only public sample cases are returned. Hidden tests never leave the server.
 */
export async function dailyChallengeFor(userId: string, now: Date): Promise<DailyProblem | null> {
  const day = utcDay(now);
  const existing = await db.challengeAssignment.findUnique({ where: { userId_day: { userId, day } }, select: { problemId: true } });
  let problemId = existing?.problemId ?? null;

  if (!problemId) {
    const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
    const [solved, recent] = await Promise.all([
      db.problemSolve.findMany({ where: { userId }, select: { problemId: true } }),
      db.challengeAssignment.findMany({ where: { userId, createdAt: { gte: since } }, select: { problemId: true } }),
    ]);
    const excluded = new Set([...solved.map((s) => s.problemId), ...recent.map((r) => r.problemId)]);
    const candidates = await db.problem.findMany({
      where: { kind: "INTERNAL", status: "PUBLISHED", testCases: { some: { isSample: false } } },
      select: { id: true },
    });
    const pick = candidates
      .filter((c) => !excluded.has(c.id))
      .sort((a, b) => rankKey(userId, day, a.id).localeCompare(rankKey(userId, day, b.id)))[0];
    if (!pick) return null;
    // createMany with skipDuplicates is atomic on the unique (userId, day). If two requests race, both read the same row afterwards.
    await db.challengeAssignment.createMany({ data: [{ userId, day, problemId: pick.id }], skipDuplicates: true });
    const stored = await db.challengeAssignment.findUnique({ where: { userId_day: { userId, day } }, select: { problemId: true } });
    problemId = stored?.problemId ?? pick.id;
  }

  const problem = await db.problem.findUnique({
    where: { id: problemId },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      testCases: { where: { isSample: true }, select: { input: true, expected: true }, orderBy: { id: "asc" } },
    },
  });
  if (!problem) return null;
  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    samples: problem.testCases.map((t) => ({ input: t.input, expected: t.expected })),
  };
}
