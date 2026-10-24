import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findMatches, nextMatch, namesInProgram, replaceAll, suggestionsAt, wordBeforeCursor } from "./completion";

describe("autocomplete", () => {
  it("finds the word before the cursor", () => {
    assert.deepEqual(wordBeforeCursor("x = pri", 7), { start: 4, word: "pri" });
    assert.deepEqual(wordBeforeCursor("x = 1 ", 6), { start: 6, word: "" });
  });
  it("suggests keywords and built-ins that start with the word", () => {
    const s = suggestionsAt("pri", 3);
    assert.ok(s.options.includes("print"));
    assert.ok(s.options.every((o) => o.startsWith("pri")));
  });
  it("suggests names the program defines before built-ins", () => {
    const code = "def compute_total(items):\n    return 0\ncom";
    const s = suggestionsAt(code, code.length);
    assert.equal(s.options[0], "compute_total");
  });
  it("suggests nothing for an empty word, and does not repeat an exact match", () => {
    assert.deepEqual(suggestionsAt("x = ", 4).options, []);
    assert.equal(suggestionsAt("print", 5).options.includes("print"), false);
  });
  it("finds names defined by def, class, assignment and for loops", () => {
    const names = namesInProgram("class Box:\n    pass\ndef go():\n    pass\nsize = 3\nfor item in []:\n    pass\n");
    assert.deepEqual(names.sort(), ["Box", "go", "item", "size"]);
  });
});

describe("find and replace", () => {
  it("finds every match, case-insensitively by default", () => {
    assert.deepEqual(findMatches("Cat cat CAT", "cat"), [0, 4, 8]);
    assert.deepEqual(findMatches("Cat cat", "cat", true), [4]);
    assert.deepEqual(findMatches("abc", ""), []);
  });
  it("moves to the next match and wraps to the first", () => {
    const m = [2, 10, 30];
    assert.equal(nextMatch(m, 0), 2);
    assert.equal(nextMatch(m, 11), 30);
    assert.equal(nextMatch(m, 31), 2);
    assert.equal(nextMatch([], 0), null);
  });
  it("replaces every match and reports the count", () => {
    assert.deepEqual(replaceAll("a-b-a", "a", "x"), { text: "x-b-x", count: 2 });
    assert.deepEqual(replaceAll("abc", "z", "y"), { text: "abc", count: 0 });
    assert.deepEqual(replaceAll("aaa", "aa", "b"), { text: "ba", count: 1 });
  });
});
