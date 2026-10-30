import "server-only";
import { db } from "@/lib/db";
import { isRunning } from "@/lib/contest-scoring";

/**
 * Records a solve exactly once, and writes its activity (which feeds streaks and the week strip) only when this call inserted the row.
 * The insert relies on the composite primary key with skipDuplicates (INSERT ... ON CONFLICT DO NOTHING in Postgres), so repeated or
 * concurrent requests insert at most one row and write at most one activity. Returns true when this call created the solve.
 *
 * TRUST BOUNDARY: this helper cannot tell whether the caller verified anything. Call it only after server-side verification
 * (checkOutput's full test match) or for an EXTERNAL problem's self-report (toggleSolved). Never pass it a value taken from a request.
 */
export type SolveVerification = "OUTPUT_MATCHED" | "SELF_REPORTED";

export async function awardSolve(userId: string, problemId: string, verification: SolveVerification): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.problemSolve.createMany({ data: [{ userId, problemId, verification }], skipDuplicates: true });
    if (count === 0) return false;
    await tx.activity.create({ data: { userId, type: "problem_solved" } });
    return true;
  });
}

/**
 * The same guarantee for contest solves, keyed by the entry's (entryId, problemId) primary key. Unlike awardSolve, it re-checks
 * inside the transaction every fact the database can prove: the entry belongs to this user, the contest is published, the entry's
 * timer is still running, and the problem is in the contest. A caller bug therefore cannot grant a contest solve outside those rules.
 */
export async function awardContestSolve(entryId: string, userId: string, problemId: string, verification: SolveVerification): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const entry = await tx.contestEntry.findUnique({ where: { id: entryId }, select: { userId: true, contestId: true, startedAt: true, contest: { select: { status: true, durationMin: true } } } });
    if (!entry || entry.userId !== userId || entry.contest.status !== "PUBLISHED" || !isRunning(entry.startedAt, entry.contest.durationMin)) return false;
    const inContest = await tx.contestProblem.findUnique({ where: { contestId_problemId: { contestId: entry.contestId, problemId } }, select: { problemId: true } });
    if (!inContest) return false;
    const { count } = await tx.contestSolve.createMany({ data: [{ entryId, problemId, verification }], skipDuplicates: true });
    if (count === 0) return false;
    await tx.activity.create({ data: { userId, type: "problem_solved" } });
    return true;
  });
}
