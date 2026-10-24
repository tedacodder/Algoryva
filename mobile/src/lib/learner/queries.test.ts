import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrations";
import { openTestDb } from "../test-support/node-sqlite";
import { seedContent } from "../test-support/seed";
import { loadDueRevisits } from "./queries";
import type { SqlDb } from "../db/sql";

let db: SqlDb & { close(): void };
beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
  await seedContent(db);
});
const now = "2026-10-20T10:00:00.000Z";

describe("due revisits", () => {
  it("lists only unpassed revisits that are due, with the problem title for site problems", async () => {
    await db.runAsync("INSERT INTO revisits (id, problem_id, outside_title, outside_url, due_at, step, passed_at) VALUES ('r1', 'p1', NULL, NULL, '2026-10-19T00:00:00.000Z', 0, NULL)");
    await db.runAsync("INSERT INTO revisits (id, problem_id, outside_title, outside_url, due_at, step, passed_at) VALUES ('r2', NULL, 'Two Sum', 'https://x.test/a', '2026-10-20T09:00:00.000Z', 0, NULL)");
    await db.runAsync("INSERT INTO revisits (id, problem_id, outside_title, outside_url, due_at, step, passed_at) VALUES ('r3', 'p1', NULL, NULL, '2026-10-25T00:00:00.000Z', 0, NULL)");
    await db.runAsync("INSERT INTO revisits (id, problem_id, outside_title, outside_url, due_at, step, passed_at) VALUES ('r4', 'p1', NULL, NULL, '2026-10-18T00:00:00.000Z', 1, '2026-10-18T01:00:00.000Z')");
    const due = await loadDueRevisits(db, now);
    assert.deepEqual(due.map((d) => d.id), ["r1", "r2"]);
    assert.equal(due[0]!.problemTitle, "Sum two");
    assert.equal(due[1]!.outsideTitle, "Two Sum");
  });
});
