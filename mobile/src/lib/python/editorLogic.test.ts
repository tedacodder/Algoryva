import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyNewline, displayText, insertAt, lineNumbers, nextIndent } from "./editorLogic";

describe("automatic indentation", () => {
  it("keeps the indentation of the previous line", () => assert.equal(nextIndent("    x = 1"), "    "));
  it("adds one level after a line that opens a block", () => assert.equal(nextIndent("def f():"), "    "));
  it("adds one level after an indented block opener", () => assert.equal(nextIndent("    for i in r:  "), "        "));
  it("starts at column zero after a plain top-level line", () => assert.equal(nextIndent("print(1)"), ""));
  it("after Enter, inserts the indentation at the cursor and moves the cursor past it", () => {
    const prev = "for i in range(3):";
    const next = prev + "\n";
    const r = applyNewline(prev, next, next.length);
    assert.equal(r.text, "for i in range(3):\n    ");
    assert.equal(r.cursor, r.text.length);
  });
  it("leaves other edits alone", () => {
    const r = applyNewline("ab", "abc", 3);
    assert.equal(r.text, "abc");
  });
});

describe("inserting at the cursor", () => {
  it("replaces the selection with the inserted text", () => {
    assert.deepEqual(insertAt("print()", 6, 6, "''"), { text: "print('')", cursor: 8 });
    assert.deepEqual(insertAt("abc", 0, 3, "x"), { text: "x", cursor: 1 });
  });
  it("clamps positions that are outside the text", () => {
    assert.equal(insertAt("ab", 10, 10, "c").text, "abc");
  });
});

describe("line numbers", () => {
  it("numbers every line, including an empty last line", () => {
    assert.equal(lineNumbers("a\nb\n"), "1\n2\n3");
    assert.equal(lineNumbers(""), "1");
  });
});


describe("coloured layer matches the typing field", () => {
  it("keeps a trailing newline visible, so the layers stay aligned after Enter", () => {
    assert.equal(displayText("x = 1\n"), "x = 1\n ");
    assert.equal(displayText("x = 1\n\n"), "x = 1\n\n ");
  });
  it("leaves text that does not end in a newline unchanged", () => {
    assert.equal(displayText("x = 1"), "x = 1");
    assert.equal(displayText(""), " ");
  });
});
