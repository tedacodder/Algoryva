import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrations";
import { openTestDb } from "../test-support/node-sqlite";
import { checkSnippet, deleteSnippet, listSnippets, saveSnippet, SNIPPET_NAME_MAX } from "./snippets";
import type { SqlDb } from "../db/sql";

let db: SqlDb & { close(): void };
beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
});

describe("saved programs", () => {
  it("saves, lists newest first, replaces on the same id, and deletes", async () => {
    await saveSnippet(db, { id: "a", name: "First", code: "print(1)", now: new Date("2026-10-01T00:00:00Z") });
    await saveSnippet(db, { id: "b", name: "Second", code: "print(2)", now: new Date("2026-10-02T00:00:00Z") });
    assert.deepEqual((await listSnippets(db)).map((s) => s.name), ["Second", "First"]);
    await saveSnippet(db, { id: "a", name: "First v2", code: "print(3)", now: new Date("2026-10-03T00:00:00Z") });
    const list = await listSnippets(db);
    assert.equal(list.length, 2);
    assert.equal(list[0]!.name, "First v2");
    assert.equal(list[0]!.code, "print(3)");
    await deleteSnippet(db, "b");
    assert.deepEqual((await listSnippets(db)).map((s) => s.id), ["a"]);
  });

  it("checks the name: required, trimmed, and not too long", () => {
    assert.deepEqual(checkSnippet("  Fib  ", "x"), { ok: true, name: "Fib" });
    assert.equal(checkSnippet("   ", "x").ok, false);
    assert.equal(checkSnippet("n".repeat(SNIPPET_NAME_MAX + 1), "x").ok, false);
  });
});
