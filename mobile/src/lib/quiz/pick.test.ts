import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickRandom, passNeeded, percent } from "./pick";

describe("practice selection", () => {
  it("returns the requested number of distinct items, never repeating one", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const picked = pickRandom(items, 5, () => 0.42);
    assert.equal(picked.length, 5);
    assert.equal(new Set(picked).size, 5);
    assert.ok(picked.every((x) => items.includes(x)));
  });
  it("returns everything when asked for more than exist", () => {
    assert.equal(pickRandom([1, 2], 10).length, 2);
  });
  it("uses the random source, so the choice is repeatable with a fixed source", () => {
    const a = pickRandom(["a", "b", "c", "d"], 3, () => 0.1);
    const b = pickRandom(["a", "b", "c", "d"], 3, () => 0.1);
    assert.deepEqual(a, b);
  });
});

describe("scoring", () => {
  it("passes at 80%, rounded up, as the lessons do", () => {
    assert.equal(passNeeded(5), 4);
    assert.equal(passNeeded(10), 8);
    assert.equal(passNeeded(15), 12);
  });
  it("percent is rounded and safe for zero questions", () => {
    assert.equal(percent(7, 10), 70);
    assert.equal(percent(1, 3), 33);
    assert.equal(percent(0, 0), 0);
  });
});
