import type { SqlDb } from "../db/sql";
import { ApiError } from "../api/client";
import type { SubmissionRequest, SubmissionResponse } from "../api/types";
import { checkOutputs } from "./rules";

/**
 * Judging offline. An answer is saved on the phone with a client id and waits as "pending". Only the server's verdict is ever shown
 * as a result. The phone never decides "accepted" itself.
 *
 *  - The client id makes retries safe: the server returns the stored verdict for a repeated id and awards nothing twice.
 *  - A verdict with `solved` also marks the problem solved on the phone, because the server said so.
 *  - Network errors, 429 and 5xx leave the answer pending and throw, so the sync engine backs off and retries.
 *  - Answers the server refuses for good (unknown problem, reused id, invalid request) become "refused" and are not retried.
 */
export type SubmitApi = { submit(input: SubmissionRequest): Promise<SubmissionResponse> };
export type Lock = <T>(fn: () => Promise<T>) => Promise<T>;
const noLock: Lock = (fn) => fn();

export type QueueResult = { ok: true } | { ok: false; reason: string };

export async function queueSubmission(
  db: SqlDb,
  input: { problemId: string; outputs: string[]; clientId: string; now: Date },
): Promise<QueueResult> {
  const check = checkOutputs(input.outputs);
  if (!check.ok) return { ok: false, reason: check.error };
  const row = await db.getFirstAsync<{ json: string }>("SELECT json FROM problems WHERE id = ?", [input.problemId]);
  if (!row) return { ok: false, reason: "This problem is not available." };
  if ((JSON.parse(row.json) as { kind: string }).kind !== "INTERNAL") {
    return { ok: false, reason: "This problem is solved on an external site. Mark it solved instead." };
  }
  try {
    await db.runAsync(
      "INSERT INTO submissions (client_id, problem_id, outputs, created_at, status, attempts) VALUES (?, ?, ?, ?, 'pending', 0)",
      [input.clientId, input.problemId, JSON.stringify(input.outputs), input.now.toISOString()],
    );
  } catch {
    return { ok: false, reason: "This answer was already saved." };
  }
  return { ok: true };
}

/** Errors the server gives for a request that can never succeed, so it is not retried. */
const REFUSED_CODES = new Set(["not_found", "client_id_reuse", "invalid_request"]);

export async function processSubmissions(
  db: SqlDb,
  api: SubmitApi,
  now: () => Date,
  lock: Lock = noLock,
): Promise<{ judged: number; refused: number }> {
  const rows = await db.getAllAsync<{ client_id: string; problem_id: string; outputs: string }>(
    "SELECT client_id, problem_id, outputs FROM submissions WHERE status = 'pending' ORDER BY created_at",
  );
  let judged = 0;
  let refused = 0;
  for (const r of rows) {
    let verdict: SubmissionResponse;
    try {
      verdict = await api.submit({ problemId: r.problem_id, clientId: r.client_id, output: JSON.parse(r.outputs) as string[] });
    } catch (e) {
      if (e instanceof ApiError && REFUSED_CODES.has(e.code)) {
        await lock(() => db.runAsync("UPDATE submissions SET status = 'refused', last_error = ? WHERE client_id = ?", [e.message, r.client_id]));
        refused++;
        continue;
      }
      // Not a verdict: keep the answer pending, count the attempt, and let the caller back off.
      await lock(() => db.runAsync("UPDATE submissions SET attempts = attempts + 1, last_error = ? WHERE client_id = ?", [e instanceof Error ? e.message : "error", r.client_id]));
      throw e;
    }
    await lock(async () => {
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          "UPDATE submissions SET status = 'judged', verdict = ?, last_error = NULL WHERE client_id = ?",
          [JSON.stringify(verdict), r.client_id],
        );
        if (verdict.solved) {
          await db.runAsync("INSERT OR IGNORE INTO solves (problem_id, solved_at, origin) VALUES (?, ?, 'server')", [r.problem_id, now().toISOString()]);
        }
      });
    });
    judged++;
  }
  return { judged, refused };
}

export type SubmissionView = {
  clientId: string;
  createdAt: string;
  status: "pending" | "judged" | "refused";
  verdict: SubmissionResponse | null;
  message: string | null;
};

/** The most recent answers for a problem, newest first. */
export async function loadSubmissions(db: SqlDb, problemId: string): Promise<SubmissionView[]> {
  const rows = await db.getAllAsync<{ client_id: string; created_at: string; status: "pending" | "judged" | "refused"; verdict: string | null; last_error: string | null }>(
    "SELECT client_id, created_at, status, verdict, last_error FROM submissions WHERE problem_id = ? ORDER BY created_at DESC LIMIT 5",
    [problemId],
  );
  return rows.map((r) => ({
    clientId: r.client_id,
    createdAt: r.created_at,
    status: r.status,
    verdict: r.verdict ? (JSON.parse(r.verdict) as SubmissionResponse) : null,
    message: r.status === "refused" ? r.last_error : null,
  }));
}
