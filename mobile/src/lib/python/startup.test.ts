import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyPercent, copyProgressText, formatMB, inlinedTarget, startPercent, startingText, startupHint, STARTUP_HINT_AFTER_S } from "./startup";

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


describe("start-up percentage", () => {
  it("copy percentage follows bytes copied", () => {
    assert.equal(copyPercent(0, 100), 0);
    assert.equal(copyPercent(50, 200), 25);
    assert.equal(copyPercent(300, 200), 100);
  });
  it("start percentage uses the stage floor, then the files loaded", () => {
    assert.equal(startPercent([], 25, false), 25);
    assert.equal(startPercent(["pyodide.asm.wasm"], 25, false), 60);
    assert.equal(startPercent(["pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"], 25, false), 88);
  });
  it("never reports 100 before the runtime is ready, and 100 once it is", () => {
    assert.equal(startPercent(["pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json", "pyodide.asm.mjs"], 99, false), 99);
    assert.equal(startPercent([], 0, true), 100);
  });
});


describe("runtime files handed to the page", () => {
  it("returns a data address for a file that was inlined, with the right type", () => {
    const inlined = { "pyodide.asm.wasm": "AAEC" };
    assert.equal(inlinedTarget("file:///data/python/pyodide.asm.wasm", inlined), "data:application/wasm;base64,AAEC");
  });
  it("leaves other addresses alone", () => {
    assert.equal(inlinedTarget("https://example.com/x.js", {}), "https://example.com/x.js");
    assert.equal(inlinedTarget("file:///data/python/pyodide.asm.mjs", {}), "file:///data/python/pyodide.asm.mjs");
  });
  it("ignores query strings when matching a file name", () => {
    assert.equal(inlinedTarget("pyodide.asm.wasm?v=1", { "pyodide.asm.wasm": "AA" }), "data:application/wasm;base64,AA");
  });
});
