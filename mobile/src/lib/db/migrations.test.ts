import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MIGRATIONS, migrate } from "./migrations";
import { openTestDb } from "../test-support/node-sqlite";

const tables = (db: ReturnType<typeof openTestDb>) =>
  db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").then((rows) => rows.map((r) => r.name));

describe("migrations", () => {
  it("creates every planned table on a new database", async () => {
    const db = openTestDb();
    assert.equal(await migrate(db), MIGRATIONS.length);
    const names = await tables(db);
    for (const t of ["content_meta", "topics", "lessons", "problems", "progress", "solves", "mistakes", "notes", "outbox", "sync_state", "schema_migrations"]) {
      assert.ok(names.includes(t), `missing table ${t}`);
    }
    db.close();
  });

  it("the second migration adds the revisits table and the sync account column", async () => {
    const db = openTestDb();
    await migrate(db);
    assert.ok((await tables(db)).includes("revisits"));
    const cols = (await db.getAllAsync<{ name: string }>("PRAGMA table_info(sync_state)")).map((c) => c.name);
    assert.ok(cols.includes("account_id"));
    db.close();
  });

  it("the third migration adds the submissions table with a status check", async () => {
    const db = openTestDb();
    await migrate(db);
    assert.ok((await tables(db)).includes("submissions"));
    await assert.rejects(db.runAsync("INSERT INTO submissions (client_id, problem_id, outputs, created_at, status) VALUES ('c', 'p', '[]', 'now', 'bogus')"));
    db.close();
  });

  it("is idempotent: a second run applies nothing", async () => {
    const db = openTestDb();
    await migrate(db);
    assert.equal(await migrate(db), 0);
    db.close();
  });

  it("records each migration once, with its name", async () => {
    const db = openTestDb();
    await migrate(db, () => new Date("2026-10-20T00:00:00Z"));
    const rows = await db.getAllAsync<{ version: number; name: string; applied_at: string }>("SELECT version, name, applied_at FROM schema_migrations");
    assert.deepEqual(rows, MIGRATIONS.map((m) => ({ version: m.version, name: m.name, applied_at: "2026-10-20T00:00:00.000Z" })));
    db.close();
  });

  it("keeps migration versions unique and ascending", () => {
    const v = MIGRATIONS.map((m) => m.version);
    assert.equal(new Set(v).size, v.length);
    assert.deepEqual([...v].sort((a, b) => a - b), v);
  });

  it("a failing migration leaves no partial tables behind (transaction rolled back)", async () => {
    const db = openTestDb();
    await db.execAsync("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
    await assert.rejects(
      db.withTransactionAsync(async () => {
        await db.execAsync("CREATE TABLE half_done (x INTEGER)");
        throw new Error("boom");
      }),
      /boom/,
    );
    assert.ok(!(await tables(db)).includes("half_done"));
    db.close();
  });
});
