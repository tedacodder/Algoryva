import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyProgressText, formatMB, startingText, startupHint, STARTUP_HINT_AFTER_S } from "./startup";

describe("Python startup messages", () => {
  it("shows which file is being copied and how far along the copy is", () => {
    assert.equal(formatMB(9_598_218), "9.2 MB");
    assert.match(copyProgressText(3, 5, "pyodide.asm.wasm", 9_598_218), /3 of 5 files\. Now: pyodide\.asm\.wasm, 9\.2 MB/);
  });
  it("shows the runtime's latest stage with a running timer", () => {
    assert.equal(startingText(12, "Loading the Python core"), "Loading the Python core… 12s");
    assert.equal(startingText(0, null), "Preparing… 0s");
  });
  it("offers help only after the wait is long, never before", () => {
    assert.equal(startupHint(STARTUP_HINT_AFTER_S - 1), null);
    assert.match(startupHint(STARTUP_HINT_AFTER_S) ?? "", /Restart Python/);
  });
});
