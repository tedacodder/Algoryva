import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrations";
import { openTestDb } from "../test-support/node-sqlite";
import { seedContent, T0, DAY } from "../test-support/seed";
import { applyLocal, enqueueLocal, type LocalAction } from "./apply";
import { applySnapshot, clearServerMirror, countPending, readSyncState, replayOutbox } from "./snapshot";
import { emptyState } from "../test-support/fake-api";
import type { SqlDb } from "../db/sql";
import type { ServerNote, SyncState } from "../api/types";

let db: SqlDb & { close(): void };
beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
  await seedContent(db);
});
const outbox = () => db.getAllAsync<{ id: string; type: string }>("SELECT id, type FROM outbox ORDER BY seq");
const progress = (slug: string) => db.getFirstAsync<{ completed_at: string | null; review_step: number | null; review_due_at: string | null }>(
  "SELECT completed_at, review_step, review_due_at FROM progress WHERE topic_slug = ?", [slug]);
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

describe("local rules and the outbox", () => {
  it("completing an unlocked topic applies it locally and queues exactly one event", async () => {
    const r = await enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0);
    assert.deepEqual(r, { applied: true });
    assert.equal((await progress("python-basics"))?.completed_at, T0.toISOString());
    assert.equal((await progress("python-basics"))?.review_step, 0);
    assert.equal((await progress("python-basics"))?.review_due_at, new Date(T0.getTime() + DAY).toISOString(), "the first review is due one day later");
    assert.deepEqual((await outbox()).map((o) => o.type), ["topic.complete"]);
  });

  it("a locked topic is refused locally and nothing is queued", async () => {
    const r = await enqueueLocal(db, { type: "topic.complete", payload: { slug: "lists-tuples" } }, id(), T0);
    assert.deepEqual(r, { applied: false, reason: "prerequisites_missing" });
    assert.equal(await progress("lists-tuples"), null);
    assert.equal(await countPending(db), 0);
  });

  it("completing the prerequisite first unlocks the next topic", async () => {
    await enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0);
    const r = await enqueueLocal(db, { type: "topic.complete", payload: { slug: "lists-tuples" } }, id(), T0);
    assert.deepEqual(r, { applied: true });
  });

  it("a review counts only when due, and good advances the step", async () => {
    await enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0);
    const early = await applyLocal(db, { type: "topic.review", payload: { slug: "python-basics", rating: "good" } }, T0);
    assert.deepEqual(early, { applied: false, reason: "not_due" });
    const later = new Date(T0.getTime() + 2 * DAY);
    assert.deepEqual(await applyLocal(db, { type: "topic.review", payload: { slug: "python-basics", rating: "good" } }, later), { applied: true });
    assert.equal((await progress("python-basics"))?.review_step, 1);
  });

  it("an external solve is recorded for external problems only", async () => {
    assert.deepEqual(await enqueueLocal(db, { type: "solve.external", payload: { problemId: "ext-1", solved: true } }, id(), T0), { applied: true });
    assert.equal((await db.getAllAsync("SELECT * FROM solves")).length, 1);
    assert.deepEqual(await enqueueLocal(db, { type: "solve.external", payload: { problemId: "p1", solved: true } }, id(), T0), { applied: false, reason: "not_applicable" });
    assert.deepEqual(await enqueueLocal(db, { type: "solve.external", payload: { problemId: "nope", solved: true } }, id(), T0), { applied: false, reason: "unknown_problem" });
    await enqueueLocal(db, { type: "solve.external", payload: { problemId: "ext-1", solved: false } }, id(), T0);
    assert.equal((await db.getAllAsync("SELECT * FROM solves")).length, 0);
  });

  it("notes and mistakes are stored locally and queued; deletes are queued too", async () => {
    const noteId = id();
    await enqueueLocal(db, { type: "note.create", payload: { id: noteId, title: "Heap", body: "Sift up on insert", tags: ["heap"] } }, id(), T0);
    assert.equal((await db.getAllAsync("SELECT * FROM notes")).length, 1);
    const mId = id();
    const bad = await enqueueLocal(db, { type: "mistake.create", payload: { id: mId, type: "NOPE", misunderstood: "abc", correctIdea: "abc", recognizeNextTime: "abc" } }, id(), T0);
    assert.equal(bad.applied, false);
    const good = await enqueueLocal(db, { type: "mistake.create", payload: { id: mId, type: "CONCEPTUAL", misunderstood: "abc", correctIdea: "abc", recognizeNextTime: "abc" } }, id(), T0);
    assert.equal(good.applied, true);
    await enqueueLocal(db, { type: "note.delete", payload: { id: noteId } }, id(), T0);
    assert.equal((await db.getAllAsync("SELECT * FROM notes")).length, 0);
    assert.deepEqual((await outbox()).map((o) => o.type), ["note.create", "mistake.create", "note.delete"]);
  });

  it("if the outbox write fails, the local change is rolled back too (both or neither)", async () => {
    const realRun = db.runAsync.bind(db);
    db.runAsync = async (sql, params) => {
      if (sql.startsWith("INSERT INTO outbox")) throw new Error("disk full");
      return realRun(sql, params);
    };
    await assert.rejects(enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0), /disk full/);
    db.runAsync = realRun;
    assert.equal(await progress("python-basics"), null, "the completion must not survive without its outbox entry");
    assert.equal(await countPending(db), 0);
  });

  it("an unknown action type is refused, never thrown", async () => {
    assert.deepEqual(await applyLocal(db, { type: "bogus", payload: {} } as unknown as LocalAction, T0), { applied: false, reason: "unknown_type" });
  });
});

const snapshotWith = (state: SyncState, notes: ServerNote[] = [], cursor = "C_SNAP"): { cursor: string; state: SyncState; notes: ServerNote[]; mistakes: [] } =>
  ({ cursor, state, notes, mistakes: [] });

describe("applying a server snapshot", () => {
  it("mirrors the server state and records the cursor and account", async () => {
    const state: SyncState = {
      topicProgress: [{ slug: "python-basics", completedAt: "2026-10-01T00:00:00.000Z" }],
      reviewItems: [{ slug: "python-basics", step: 2, dueAt: "2026-10-30T00:00:00.000Z" }],
      quizResults: [{ slug: "python-basics", bestScore: 5, total: 6, attempts: 2, passedAt: "2026-10-01T00:00:00.000Z" }],
      solves: [{ problemId: "ext-1", solvedAt: "2026-10-02T00:00:00.000Z" }],
      revisits: [],
    };
    await applySnapshot(db, snapshotWith(state, [{ id: "n1", title: "T", body: "B", tags: ["x"], createdAt: "2026-10-03T00:00:00.000Z" }]), "user-1", T0);
    const p = await db.getFirstAsync<{ review_step: number; quiz_best: number; quiz_attempts: number; origin: string }>("SELECT review_step, quiz_best, quiz_attempts, origin FROM progress WHERE topic_slug = 'python-basics'");
    assert.deepEqual(p, { review_step: 2, quiz_best: 5, quiz_attempts: 2, origin: "server" });
    assert.equal((await db.getAllAsync("SELECT * FROM solves")).length, 1);
    assert.deepEqual(await readSyncState(db), { accountId: "user-1", cursor: "C_SNAP" });
  });

  it("removes what the server no longer has (deletions made on the website reach the phone)", async () => {
    await applySnapshot(db, snapshotWith(emptyState(), [{ id: "n1", title: "T", body: "B", tags: [], createdAt: "2026-10-03T00:00:00.000Z" }]), "user-1", T0);
    assert.equal((await db.getAllAsync("SELECT * FROM notes")).length, 1);
    await applySnapshot(db, snapshotWith(emptyState(), [], "C2"), "user-1", T0);
    assert.equal((await db.getAllAsync("SELECT * FROM notes")).length, 0);
  });

  it("keeps unsent offline changes visible by replaying the outbox on top of the snapshot", async () => {
    await enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0);
    assert.equal((await countPending(db)), 1);
    const replayed = await applySnapshot(db, snapshotWith(emptyState()), "user-1", T0);
    assert.equal(replayed, 1);
    assert.equal((await progress("python-basics"))?.completed_at, T0.toISOString(), "the offline completion survives the snapshot");
    assert.equal(await countPending(db), 1, "a snapshot never erases an unsent change");
  });

  it("replay skips changes the server state makes impossible, and keeps them queued for the server to decide", async () => {
    await enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0);
    // The server says the topic was completed with a later review; a local review now cannot apply. It must not crash.
    await applySnapshot(db, snapshotWith({ ...emptyState(), topicProgress: [{ slug: "python-basics", completedAt: "2026-10-01T00:00:00.000Z" }] }), "user-1", T0);
    assert.equal(await countPending(db), 1);
  });

  it("clearing the server mirror keeps unsent changes and replays them as this device's own", async () => {
    await enqueueLocal(db, { type: "note.create", payload: { id: "n-local", title: "Mine", body: "offline note", tags: [] } }, id(), T0);
    await applySnapshot(db, snapshotWith(emptyState(), [{ id: "n-server", title: "S", body: "server", tags: [], createdAt: "2026-10-01T00:00:00.000Z" }]), "user-1", T0);
    await clearServerMirror(db, T0);
    assert.deepEqual((await db.getAllAsync<{ id: string }>("SELECT id FROM notes")).map((r) => r.id), ["n-local"]);
    assert.equal(await readSyncState(db), null);
  });

  it("replayOutbox is idempotent for notes (re-applying the same create adds nothing)", async () => {
    await enqueueLocal(db, { type: "note.create", payload: { id: "n-x", title: "X", body: "body", tags: [] } }, id(), T0);
    await replayOutbox(db, T0);
    await replayOutbox(db, T0);
    assert.equal((await db.getAllAsync("SELECT * FROM notes")).length, 1);
  });
});
