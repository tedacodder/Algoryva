import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrations";
import { openTestDb } from "../test-support/node-sqlite";
import { readThemePreference, writeThemePreference } from "./prefs";
import { resolveMode } from "./theme-types";

describe("theme preference", () => {
  it("defaults to following the phone", async () => {
    const db = openTestDb();
    await migrate(db);
    assert.equal(await readThemePreference(db), "system");
    db.close();
  });

  it("saves and reads back light and dark, and replaces the earlier choice", async () => {
    const db = openTestDb();
    await migrate(db);
    await writeThemePreference(db, "dark");
    assert.equal(await readThemePreference(db), "dark");
    await writeThemePreference(db, "light");
    assert.equal(await readThemePreference(db), "light");
    assert.equal((await db.getAllAsync("SELECT key FROM prefs")).length, 1);
    db.close();
  });

  it("ignores an unknown stored value and falls back to following the phone", async () => {
    const db = openTestDb();
    await migrate(db);
    await db.runAsync("INSERT INTO prefs (key, value) VALUES ('theme', 'purple')");
    assert.equal(await readThemePreference(db), "system");
    db.close();
  });
});

describe("resolving the mode", () => {
  it("system follows the phone, and an explicit choice always wins", () => {
    assert.equal(resolveMode("system", "dark"), "dark");
    assert.equal(resolveMode("system", "light"), "light");
    assert.equal(resolveMode("system", null), "light");
    assert.equal(resolveMode("light", "dark"), "light");
    assert.equal(resolveMode("dark", "light"), "dark");
  });
});
