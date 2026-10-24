import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrations";
import { openTestDb } from "../test-support/node-sqlite";
import { sampleContent } from "../test-support/fixtures";
import { isContentResponse, loadLesson, loadProblem, loadProblems, loadTopics, readContentState, storeContentSnapshot } from "./repository";
import type { SqlDb } from "../db/sql";

let db: SqlDb & { close(): void };
beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
});

const when = new Date("2026-10-20T10:00:00Z");

describe("storing a snapshot", () => {
  it("round-trips topics, lessons and problems exactly", async () => {
    const data = sampleContent();
    await storeContentSnapshot(db, { etag: '"v1"', data }, when);
    assert.deepEqual(await loadTopics(db), data.topics);
    assert.deepEqual(await loadLesson(db, "python-basics"), data.lessons[0]);
    assert.deepEqual(await loadLesson(db, "lists-tuples"), data.lessons[1]);
    assert.deepEqual(await loadProblems(db), data.problems);
    assert.deepEqual(await loadProblem(db, "sum-two"), data.problems[0]);
    assert.equal(await loadLesson(db, "not-a-topic"), null);
    assert.equal(await loadProblem(db, "nope"), null);
  });

  it("records the version, ETag and fetch time", async () => {
    await storeContentSnapshot(db, { etag: '"v1"', data: sampleContent("v1") }, when);
    assert.deepEqual(await readContentState(db), { version: "v1", etag: '"v1"', fetchedAt: "2026-10-20T10:00:00.000Z" });
  });

  it("a new snapshot replaces the old one completely (no leftovers from the previous version)", async () => {
    await storeContentSnapshot(db, { etag: '"v1"', data: sampleContent("v1") }, when);
    const v2 = sampleContent("v2");
    v2.topics = [v2.topics[0]!];
    v2.lessons = [v2.lessons[0]!];
    v2.problems = [];
    await storeContentSnapshot(db, { etag: '"v2"', data: v2 }, when);
    assert.equal((await loadTopics(db)).length, 1);
    assert.equal(await loadLesson(db, "lists-tuples"), null);
    assert.deepEqual(await loadProblems(db), []);
    assert.equal((await readContentState(db))?.version, "v2");
  });

  it("a failed write rolls back and keeps the previous snapshot intact", async () => {
    await storeContentSnapshot(db, { etag: '"v1"', data: sampleContent("v1") }, when);
    const broken = sampleContent("v2");
    // Two problems with the same slug violate the UNIQUE constraint half-way through the write.
    broken.problems = [broken.problems[0]!, { ...broken.problems[0]!, id: "p2" }];
    await assert.rejects(storeContentSnapshot(db, { etag: '"v2"', data: broken }, when));
    assert.equal((await readContentState(db))?.version, "v1");
    assert.equal((await loadTopics(db)).length, 2);
    assert.equal((await loadProblems(db)).length, 1);
  });

  it("refuses data with the wrong shape before writing anything", async () => {
    await storeContentSnapshot(db, { etag: '"v1"', data: sampleContent("v1") }, when);
    await assert.rejects(storeContentSnapshot(db, { etag: '"x"', data: { version: 1 } as never }, when), /expected shape/);
    assert.equal((await readContentState(db))?.version, "v1");
  });

  it("isContentResponse accepts the snapshot and rejects partial objects", () => {
    assert.equal(isContentResponse(sampleContent()), true);
    assert.equal(isContentResponse({ version: "v", topics: [] }), false);
    assert.equal(isContentResponse(null), false);
  });
});
