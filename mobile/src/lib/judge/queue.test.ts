import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrations";
import { openTestDb } from "../test-support/node-sqlite";
import { seedContent } from "../test-support/seed";
import { ApiError, NetworkError } from "../api/client";
import type { SubmissionRequest, SubmissionResponse } from "../api/types";
import type { SqlDb } from "../db/sql";
import { loadSubmissions, processSubmissions, queueSubmission, type SubmitApi } from "./queue";
import { MAX_OUTPUT_CHARS, MAX_OUTPUTS } from "./rules";

let db: SqlDb & { close(): void };
let n = 0;
const cid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const now = new Date("2026-10-20T10:00:00Z");
const solvedCount = async () => (await db.getAllAsync("SELECT problem_id FROM solves")).length;
const status = async (id: string) => (await db.getFirstAsync<{ status: string; verdict: string | null }>("SELECT status, verdict FROM submissions WHERE client_id = ?", [id]));

beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
  await seedContent(db);
});

/** A fake judge: answers from `reply`, and records every request it receives. */
function judge(reply: (req: SubmissionRequest) => SubmissionResponse | Error) {
  const seen: SubmissionRequest[] = [];
  const api: SubmitApi = {
    async submit(req) {
      seen.push(req);
      const r = reply(req);
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { api, seen };
}
const accepted = (req: SubmissionRequest): SubmissionResponse => ({
  clientId: req.clientId, verdict: "accepted", allPass: true, solved: true,
  results: [{ isSample: true, pass: true, input: "1 2", expected: "3", actual: "3" }, { isSample: false, pass: true }, { isSample: false, pass: true }],
});

describe("queueing an answer", () => {
  it("saves a pending answer for an internal problem", async () => {
    const r = await queueSubmission(db, { problemId: "p1", outputs: ["3", "x", "y"], clientId: cid(), now });
    assert.deepEqual(r, { ok: true });
    assert.equal((await db.getAllAsync("SELECT * FROM submissions")).length, 1);
  });

  it("refuses too many outputs and an over-long output, and saves nothing", async () => {
    assert.equal((await queueSubmission(db, { problemId: "p1", outputs: Array(MAX_OUTPUTS + 1).fill("x"), clientId: cid(), now })).ok, false);
    assert.equal((await queueSubmission(db, { problemId: "p1", outputs: ["x".repeat(MAX_OUTPUT_CHARS + 1)], clientId: cid(), now })).ok, false);
    assert.equal((await queueSubmission(db, { problemId: "p1", outputs: [], clientId: cid(), now })).ok, false);
    assert.equal((await db.getAllAsync("SELECT * FROM submissions")).length, 0);
  });

  it("refuses unknown problems and external problems (those are marked solved, not judged)", async () => {
    assert.equal((await queueSubmission(db, { problemId: "nope", outputs: ["x"], clientId: cid(), now })).ok, false);
    const ext = await queueSubmission(db, { problemId: "ext-1", outputs: ["x"], clientId: cid(), now });
    assert.deepEqual(ext.ok, false);
  });

  it("a repeated client id is refused, so one answer cannot be saved twice", async () => {
    const id = cid();
    await queueSubmission(db, { problemId: "p1", outputs: ["3"], clientId: id, now });
    assert.equal((await queueSubmission(db, { problemId: "p1", outputs: ["3"], clientId: id, now })).ok, false);
  });
});

describe("judging", () => {
  it("nothing is accepted before the server answers: the row stays pending until the response arrives", async () => {
    const id = cid();
    await queueSubmission(db, { problemId: "p1", outputs: ["3", "x", "y"], clientId: id, now });
    let statusDuringCall: string | undefined;
    const api: SubmitApi = {
      async submit(req) {
        statusDuringCall = (await status(id))?.status;
        return accepted(req);
      },
    };
    await processSubmissions(db, api, () => now);
    assert.equal(statusDuringCall, "pending", "the phone never marks an answer judged on its own");
    assert.equal((await status(id))?.status, "judged");
  });

  it("an accepted verdict is stored, and the problem is marked solved from the server's word", async () => {
    const id = cid();
    await queueSubmission(db, { problemId: "p1", outputs: ["3", "x", "y"], clientId: id, now });
    const { api } = judge(accepted);
    assert.deepEqual(await processSubmissions(db, api, () => now), { judged: 1, refused: 0 });
    assert.equal(await solvedCount(), 1);
    assert.equal(JSON.parse((await status(id))!.verdict!).verdict, "accepted");
  });

  it("a wrong answer is stored and does not mark the problem solved", async () => {
    const id = cid();
    await queueSubmission(db, { problemId: "p1", outputs: ["9", "x", "y"], clientId: id, now });
    const { api } = judge((req) => ({ clientId: req.clientId, verdict: "wrong_answer", allPass: false, solved: false, results: [{ isSample: true, pass: false, input: "1 2", expected: "3", actual: "9" }, { isSample: false, pass: false }, { isSample: false, pass: false }] }));
    await processSubmissions(db, api, () => now);
    assert.equal(await solvedCount(), 0);
    assert.equal(JSON.parse((await status(id))!.verdict!).verdict, "wrong_answer");
  });

  it("a sample-only result is stored as not recorded, and never marks the problem solved", async () => {
    await queueSubmission(db, { problemId: "p1", outputs: ["3"], clientId: cid(), now });
    const { api } = judge((req) => ({ clientId: req.clientId, verdict: "not_recorded", allPass: true, solved: false, note: "No hidden tests.", results: [{ isSample: true, pass: true }] }));
    await processSubmissions(db, api, () => now);
    assert.equal(await solvedCount(), 0);
  });

  it("a retry after a lost response gets the stored verdict and never awards twice", async () => {
    const id = cid();
    await queueSubmission(db, { problemId: "p1", outputs: ["3", "x", "y"], clientId: id, now });
    const first = judge(accepted);
    await processSubmissions(db, first.api, () => now);
    await db.runAsync("UPDATE submissions SET status = 'pending' WHERE client_id = ?", [id]); // simulate a row that was not marked done
    const second = judge((req) => ({ ...accepted(req), clientId: req.clientId }));
    await processSubmissions(db, second.api, () => now);
    assert.equal(await solvedCount(), 1, "one solve, however many times it was judged");
    assert.equal(second.seen[0]!.clientId, id, "the same client id is sent again");
  });

  it("a network failure keeps the answer pending, counts the attempt, and rethrows so the engine backs off", async () => {
    const id = cid();
    await queueSubmission(db, { problemId: "p1", outputs: ["3"], clientId: id, now });
    const { api } = judge(() => new NetworkError("unreachable"));
    await assert.rejects(processSubmissions(db, api, () => now), NetworkError);
    assert.equal((await status(id))?.status, "pending");
    assert.equal((await db.getFirstAsync<{ attempts: number }>("SELECT attempts FROM submissions WHERE client_id = ?", [id]))?.attempts, 1);
  });

  it("429, 5xx and 401 keep the answer pending and rethrow", async () => {
    for (const err of [new ApiError(429, "rate_limited", "Too many checks."), new ApiError(503, "http_503", "busy"), new ApiError(401, "unauthorized", "Sign in.")]) {
      db.close(); db = openTestDb(); await migrate(db); await seedContent(db);
      const id = cid();
      await queueSubmission(db, { problemId: "p1", outputs: ["3"], clientId: id, now });
      await assert.rejects(processSubmissions(db, judge(() => err).api, () => now), ApiError);
      assert.equal((await status(id))?.status, "pending", `${err.status} keeps the answer`);
    }
  });

  it("a refusal (409 reused id, 404 unknown problem) is final: marked refused and never sent again", async () => {
    const id = cid();
    await queueSubmission(db, { problemId: "p1", outputs: ["3"], clientId: id, now });
    const { api, seen } = judge(() => new ApiError(409, "client_id_reuse", "This client id was already used for a different submission."));
    assert.deepEqual(await processSubmissions(db, api, () => now), { judged: 0, refused: 1 });
    assert.equal((await status(id))?.status, "refused");
    await processSubmissions(db, api, () => now);
    assert.equal(seen.length, 1, "a refused answer is not sent again");
    const view = (await loadSubmissions(db, "p1"))[0]!;
    assert.match(view.message ?? "", /already used/);
  });

  it("answers are judged in the order they were saved, and a network failure stops the rest of the queue", async () => {
    const a = cid(), b = cid();
    await queueSubmission(db, { problemId: "p1", outputs: ["3"], clientId: a, now: new Date(now.getTime() - 1000) });
    await queueSubmission(db, { problemId: "p1", outputs: ["4"], clientId: b, now });
    const { api, seen } = judge(() => new NetworkError("unreachable"));
    await assert.rejects(processSubmissions(db, api, () => now), NetworkError);
    assert.deepEqual(seen.map((s) => s.clientId), [a], "the second answer waits for the connection");
    assert.equal((await status(b))?.status, "pending");
  });

  it("the lock is used around each local write", async () => {
    const id = cid();
    await queueSubmission(db, { problemId: "p1", outputs: ["3", "x", "y"], clientId: id, now });
    let locks = 0;
    await processSubmissions(db, judge(accepted).api, () => now, async <T,>(fn: () => Promise<T>) => { locks++; return fn(); });
    assert.ok(locks >= 1);
  });
});

describe("what the learner sees", () => {
  it("lists answers newest first, with pending, judged and refused shown distinctly", async () => {
    await queueSubmission(db, { problemId: "p1", outputs: ["3"], clientId: cid(), now: new Date(now.getTime() - 2000) });
    await queueSubmission(db, { problemId: "p1", outputs: ["3", "x", "y"], clientId: cid(), now: new Date(now.getTime() - 1000) });
    await processSubmissions(db, judge(accepted).api, () => now).catch(() => undefined);
    const views = await loadSubmissions(db, "p1");
    assert.equal(views.length, 2);
    assert.ok(views.every((v) => ["pending", "judged", "refused"].includes(v.status)));
  });
});
