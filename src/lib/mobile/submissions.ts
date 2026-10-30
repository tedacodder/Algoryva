import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { checkOrThrow, limitOrThrow } from "@/lib/api/limits";
import { gradeOutput } from "@/lib/judge";
import { NOT_RECORDED_PRACTICE } from "@/lib/solve-messages";
import { HOUR, record } from "@/lib/rate-limit";
import { canonicalJson, sha256Hex } from "@/lib/mobile/canonical";

/**
 * POST /api/v1/submissions. This is the website's output checker (src/app/problems/judge-actions.ts) behind a bearer token.
 * It compares pasted text with the stored expected outputs. NO code is compiled or run. "accepted" means every stored test
 * matched, the same as "all pass" on the website, and is no stronger verification than that.
 *
 * Preserved from the website: authentication before any test data is read; PUBLISHED + INTERNAL problems only; samples first,
 * then hidden tests by id; one output per test in that order (a missing output is ""); the 20,000-character limit per output;
 * at least one hidden test is needed before anything counts as solved; the shared `check:{user}:{problem}` limit of 40 per hour;
 * the revisit pass and the solve award, written once.
 * Added for mobile: a client id makes a retry return the stored verdict instead of grading, awarding or rate-limiting again.
 */
export const MAX_OUTPUT_CHARS = 20_000;
export const MAX_CHECKS_PER_HOUR = 40;
export const MAX_SUBMISSIONS_PER_HOUR = 240;

export const submissionSchema = z.object({
  problemId: z.string().min(1).max(64),
  clientId: z.string().uuid(),
  output: z.union([z.string(), z.array(z.string()).max(100)]),
}).strict();
export type SubmissionInput = z.infer<typeof submissionSchema>;

export type CheckResult = { isSample: boolean; pass: boolean; input?: string; expected?: string; actual?: string };
export type Verdict = "accepted" | "wrong_answer" | "not_recorded";
export type SubmissionResponse = { clientId: string; verdict: Verdict; allPass: boolean; solved: boolean; results: CheckResult[]; note?: string; replayed?: boolean };

type TestRow = { isSample: boolean; input: string; expected: string };

/** Pure grading, identical to the website's: the same slice, the same limit, the same normalisation (lib/judge.ts). */
export function gradeTests(tests: TestRow[], outputs: string[]): { results: CheckResult[]; allPass: boolean; hasHidden: boolean } {
  const results: CheckResult[] = tests.map((t, i) => {
    const actual = (outputs[i] ?? "").slice(0, MAX_OUTPUT_CHARS + 1);
    const pass = actual.length <= MAX_OUTPUT_CHARS && gradeOutput(t.expected, actual);
    return t.isSample ? { isSample: true, input: t.input, expected: t.expected, actual: actual.slice(0, MAX_OUTPUT_CHARS), pass } : { isSample: false, pass };
  });
  return { results, allPass: results.length > 0 && results.every((r) => r.pass), hasHidden: tests.some((t) => !t.isSample) };
}

export const NO_HIDDEN_NOTE = "This problem has no hidden tests, so matching the sample cannot mark it solved.";
export const NO_TESTS_NOTE = "This problem has no tests yet, so it cannot be checked.";

type Stored = { verdict: Verdict; allPass: boolean; solved: boolean; results: CheckResult[]; note?: string };
/** What is stored for replays: the learner's own pasted text is not kept. */
const stripActual = (rs: CheckResult[]): CheckResult[] => rs.map((r) => (r.isSample ? { isSample: true, pass: r.pass, input: r.input, expected: r.expected } : { isSample: false, pass: r.pass }));

function replay(row: { payloadHash: string; outcome: unknown }, hash: string, clientId: string): SubmissionResponse {
  if (row.payloadHash !== hash) throw new ApiError(409, "client_id_reuse", "This client id was already used for a different submission.");
  return { clientId, ...(row.outcome as Stored), replayed: true };
}

export async function submit(userId: string, input: SubmissionInput): Promise<SubmissionResponse> {
  const outputs = typeof input.output === "string" ? [input.output] : input.output;
  // A string and a one-element array are the same submission, so a retry may use either form.
  const payloadHash = sha256Hex(canonicalJson({ type: "submission", problemId: input.problemId, output: outputs }));
  const key = { userId_id: { userId, id: input.clientId } };

  // A retry is answered from the stored verdict: no test data is read and no rate-limit budget is used.
  const stored = await db.syncEvent.findUnique({ where: key, select: { payloadHash: true, outcome: true } });
  if (stored) return replay(stored, payloadHash, input.clientId);

  await limitOrThrow(`v1-submit:${userId}`, MAX_SUBMISSIONS_PER_HOUR, HOUR, "Too many submissions. Try again later.");

  // Visibility comes from the database row, never from the request.
  const problem = await db.problem.findFirst({
    where: { id: input.problemId, status: "PUBLISHED", kind: "INTERNAL" },
    include: { testCases: { orderBy: [{ isSample: "desc" }, { id: "asc" }] } },
  });
  if (!problem) throw new ApiError(404, "not_found", "Problem not found.");

  // Keyed by a real problem id (not the raw request value) so a caller cannot create unbounded keys.
  const rateKey = `check:${userId}:${problem.id}`;
  await checkOrThrow(rateKey, MAX_CHECKS_PER_HOUR, HOUR, "Too many checks on this problem. Wait a while and try again.");
  await record(rateKey);

  const { results, allPass, hasHidden } = gradeTests(problem.testCases, outputs);
  const counts = allPass && hasHidden;
  const note = results.length === 0 ? NO_TESTS_NOTE : allPass && !hasHidden ? NO_HIDDEN_NOTE : undefined;
  const verdict: Verdict = counts ? "accepted" : allPass || results.length === 0 ? "not_recorded" : "wrong_answer";
  const now = new Date();

  return db.$transaction(async (tx) => {
    const ins = await tx.syncEvent.createMany({ data: [{ userId, id: input.clientId, type: "submission", payloadHash, outcome: { status: "pending" } }], skipDuplicates: true });
    if (ins.count === 0) {
      const again = await tx.syncEvent.findUnique({ where: key, select: { payloadHash: true, outcome: true } });
      if (!again) throw new Error("sync event vanished");
      return replay(again, payloadHash, input.clientId);
    }
    let txNote = note;
    if (counts) {
      // As on the website: a full verified match passes a revisit that is already due, then awards the solve once.
      await tx.revisit.updateMany({ where: { userId, problemId: problem.id, passedAt: null, dueAt: { lte: now } }, data: { passedAt: now, dueAt: null, passedBy: "judge" } });
      const { count } = await tx.problemSolve.createMany({ data: [{ userId, problemId: problem.id, verification: "OUTPUT_MATCHED" }], skipDuplicates: true });
      if (count > 0) await tx.activity.create({ data: { userId, type: "problem_solved" } });
      else txNote = NOT_RECORDED_PRACTICE; // same explanation the website gives for an already-counted pass
    }
    const solved = counts ? true : (await tx.problemSolve.findUnique({ where: { userId_problemId: { userId, problemId: problem.id } }, select: { userId: true } })) !== null;
    const stored: Stored = { verdict, allPass, solved, results: stripActual(results), ...(txNote ? { note: txNote } : {}) };
    await tx.syncEvent.update({ where: key, data: { outcome: stored as unknown as Prisma.InputJsonValue } });
    return { clientId: input.clientId, verdict, allPass, solved, results, ...(txNote ? { note: txNote } : {}) };
  });
}
