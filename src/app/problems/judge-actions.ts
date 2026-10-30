"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { gradeOutput } from "@/lib/judge";
import { contestState } from "@/lib/contests";
import { HOUR, isBlocked, record } from "@/lib/rate-limit";
import { awardContestSolve, awardSolve } from "@/lib/solve";
import { passRevisit } from "@/lib/revisit-store";
import { NOT_RECORDED_CONTEST, NOT_RECORDED_PRACTICE } from "@/lib/solve-messages";

/** Only public samples carry input, expected and actual. Hidden tests return just the verdict. */
export type CheckResult = { isSample: boolean; pass: boolean; input?: string; expected?: string; actual?: string };
/** `note` is set whenever a full match did NOT earn a solve (or the check was refused), so the UI never claims a solve that was not recorded. */
export type CheckState = { results: CheckResult[]; allPass: boolean; note?: string } | undefined;

const MAX_OUTPUT_CHARS = 20_000;
const MAX_CHECKS_PER_HOUR = 40; // per user and problem; stops the per-test pass/fail verdicts being used to guess hidden outputs

const refused = (note: string): CheckState => ({ results: [], allPass: false, note });

// Grades pasted output against hidden tests server-side. This is string comparison, not a code sandbox: no user code ever runs here.
// A solve is recorded only here (or by toggleSolved for EXTERNAL problems), after authentication and a full server-side match.
export async function checkOutput(_: CheckState, form: FormData): Promise<CheckState> {
  // Authenticate before touching any test data: per-test verdicts must not be available to anonymous callers.
  const user = await requireUser();
  const problemId = String(form.get("problemId") ?? "");
  const outputs = form.getAll("output").map(String);
  const contestId = String(form.get("contestId") ?? "");
  // Samples first, so "Test 1" in the UI is always the public sample. Visibility comes from the database row, never from the request.
  const problem = await db.problem.findFirst({ where: { id: problemId, status: "PUBLISHED", kind: "INTERNAL" }, include: { testCases: { orderBy: [{ isSample: "desc" }, { id: "asc" }] } } });
  if (!problem) return { results: [], allPass: false };

  // Keyed by a real problem id (not the raw request value) so attackers cannot create unbounded keys.
  const rateKey = `check:${user.id}:${problem.id}`;
  if (await isBlocked(rateKey, MAX_CHECKS_PER_HOUR, HOUR)) return refused("Too many checks on this problem. Wait a while and try again.");
  await record(rateKey);

  const results: CheckResult[] = problem.testCases.map((t, i) => {
    const actual = (outputs[i] ?? "").slice(0, MAX_OUTPUT_CHARS + 1);
    const pass = actual.length <= MAX_OUTPUT_CHARS && gradeOutput(t.expected, actual);
    return t.isSample ? { isSample: true, input: t.input, expected: t.expected, actual: actual.slice(0, MAX_OUTPUT_CHARS), pass } : { isSample: false, pass };
  });
  const allPass = results.length > 0 && results.every((r) => r.pass);
  if (!allPass) return { results, allPass };

  // Public sample output is shown on the page, so matching it alone proves nothing. At least one hidden test must exist and have matched.
  if (!problem.testCases.some((t) => !t.isSample)) {
    return { results, allPass, note: "This problem has no hidden tests, so matching the sample cannot mark it solved." };
  }

  // Only a verified pass (every server-side test matched) awards a solve. Awards are idempotent, see lib/solve.ts.
  // A verified full match also passes a revisit that is already due. Only the judge can pass one, never a self-report.
  await passRevisit(user.id, problem.id, new Date());
  if (contestId) {
    const c = await db.contest.findFirst({ where: { id: contestId, status: "PUBLISHED" }, select: { durationMin: true } });
    if (!c) return { results, allPass, note: "Contest not found, so this pass was not counted." };
    const state = await contestState(contestId, c.durationMin, user.id);
    if (!state.started) return { results, allPass, note: "Start the contest timer first. This pass was not counted." };
    if (!state.running) return { results, allPass, note: "The contest timer has ended, so this pass was not counted. Solve it from the problem page to practice." };
    const inContest = await db.contestProblem.findUnique({ where: { contestId_problemId: { contestId, problemId: problem.id } }, select: { problemId: true } });
    if (!inContest) return { results, allPass, note: "This problem is not part of that contest, so this pass was not counted." };
    // A false result means no new solve was recorded: it was already counted, or the timer ended or the entry changed between the
    // checks above and this write. The student must be told, never shown a solve that was not recorded.
    const recorded = await awardContestSolve(state.entry.id, user.id, problem.id, "OUTPUT_MATCHED");
    if (!recorded) return { results, allPass, note: NOT_RECORDED_CONTEST };
  } else {
    const recorded = await awardSolve(user.id, problem.id, "OUTPUT_MATCHED");
    if (!recorded) return { results, allPass, note: NOT_RECORDED_PRACTICE };
  }
  revalidatePath("/problems", "layout");
  return { results, allPass };
}
