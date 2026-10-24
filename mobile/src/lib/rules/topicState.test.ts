import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { topicStates } from "./topicState";

const T = [
  { slug: "a", position: 0, status: "PUBLISHED", prereqs: [] },
  { slug: "b", position: 1, status: "PUBLISHED", prereqs: ["a"] },
  { slug: "c", position: 2, status: "PUBLISHED", prereqs: ["a"] },
  { slug: "d", position: 3, status: "COMING_SOON", prereqs: [] },
];

describe("topic states", () => {
  it("marks the first unfinished unlocked topic as up next, and the other unlocked ones as available", () => {
    const s = topicStates(T, new Set());
    assert.equal(s.get("a"), "current");
    assert.equal(s.get("b"), "locked");
    assert.equal(s.get("c"), "locked");
    assert.equal(s.get("d"), "soon");
  });
  it("after completing the first topic, the next ones unlock and the first available one is up next", () => {
    const s = topicStates(T, new Set(["a"]));
    assert.equal(s.get("a"), "done");
    assert.equal(s.get("b"), "current");
    assert.equal(s.get("c"), "open");
  });
  it("coming-soon topics are never current, even when everything else is done", () => {
    const s = topicStates(T, new Set(["a", "b", "c"]));
    assert.equal(s.get("d"), "soon");
    assert.equal([...s.values()].includes("current"), false);
  });
});
