import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withDbLock } from "./lock";

describe("the database write queue", () => {
  it("runs sections strictly one after another, even when they are started together", async () => {
    const order: string[] = [];
    const task = (name: string, ms: number) => withDbLock(async () => {
      order.push(`${name}:start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${name}:end`);
      return name;
    });
    const results = await Promise.all([task("a", 15), task("b", 1), task("c", 5)]);
    assert.deepEqual(results, ["a", "b", "c"]);
    assert.deepEqual(order, ["a:start", "a:end", "b:start", "b:end", "c:start", "c:end"]);
  });

  it("a failing section does not block the ones queued after it", async () => {
    const failing = withDbLock(async () => { throw new Error("boom"); });
    const after = withDbLock(async () => "still runs");
    await assert.rejects(failing, /boom/);
    assert.equal(await after, "still runs");
  });
});
