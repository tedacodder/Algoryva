import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTags, checkNote } from "./note";
import { nextTopic } from "./next";

describe("tags", () => {
  it("lower-cases, trims, removes duplicates and empties", () => {
    assert.deepEqual(parseTags(" Heap, dp,DP, ,graphs "), { ok: true, tags: ["heap", "dp", "graphs"] });
    assert.deepEqual(parseTags(""), { ok: true, tags: [] });
  });
  it("refuses more than five tags and characters outside the allowed set", () => {
    assert.equal(parseTags("a,b,c,d,e,f").ok, false);
    assert.equal(parseTags("bad tag").ok, false);
    assert.equal(parseTags("x".repeat(25)).ok, false);
  });
});

describe("note text", () => {
  it("needs a title and a body within the limits", () => {
    assert.equal(checkNote("", "body").ok, false);
    assert.equal(checkNote("title", "   ").ok, false);
    assert.equal(checkNote("t".repeat(121), "body").ok, false);
    assert.deepEqual(checkNote("Heap", "Sift up on insert"), { ok: true });
  });
});

describe("next topic", () => {
  const topics = [
    { slug: "a", position: 0, status: "PUBLISHED", prereqs: [] },
    { slug: "b", position: 1, status: "PUBLISHED", prereqs: ["a"] },
    { slug: "c", position: 2, status: "COMING_SOON", prereqs: [] },
  ];
  it("starts with the first unlocked, unfinished topic in course order", () => {
    assert.equal(nextTopic(topics, new Set())?.slug, "a");
    assert.equal(nextTopic(topics, new Set(["a"]))?.slug, "b");
  });
  it("skips coming-soon topics and returns null when everything available is done", () => {
    assert.equal(nextTopic(topics, new Set(["a", "b"])), null);
  });
  it("never offers a topic whose prerequisites are not finished", () => {
    assert.equal(nextTopic([{ slug: "b", position: 1, status: "PUBLISHED", prereqs: ["a"] }], new Set())?.slug ?? null, null);
  });
});
