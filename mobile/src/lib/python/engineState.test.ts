import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { INITIAL_ENGINE, reduceEngine, startingPercent, type EngineState } from "./engineState";

const starting: EngineState = { ...INITIAL_ENGINE, stage: "starting", uri: "file:///x/runner.html" };

describe("engine messages", () => {
  it("ignores messages when nothing is starting", () => {
    assert.equal(reduceEngine(INITIAL_ENGINE, { kind: "ready" }), INITIAL_ENGINE);
    assert.equal(reduceEngine(INITIAL_ENGINE, { kind: "stage", text: "x", pct: 50 }), INITIAL_ENGINE);
  });
  it("records each stage message while starting", () => {
    const s = reduceEngine(starting, { kind: "stage", text: "Loading the Python core", pct: 15 });
    assert.equal(s.stageText, "Loading the Python core");
    assert.equal(s.stagePct, 15);
  });
  it("records each file once, and shows the last file requested", () => {
    let s = reduceEngine(starting, { kind: "fetch", text: "pyodide.asm.wasm", status: "start" });
    assert.deepEqual(s.loaded, []);
    s = reduceEngine(s, { kind: "fetch", text: "pyodide.asm.wasm", status: "done" });
    s = reduceEngine(s, { kind: "fetch", text: "pyodide.asm.wasm", status: "done" });
    assert.deepEqual(s.loaded, ["pyodide.asm.wasm"]);
    assert.equal(s.lastFetch, "pyodide.asm.wasm: done");
  });
  it("becomes ready once, and reports 100 percent", () => {
    const s = reduceEngine(starting, { kind: "ready" });
    assert.equal(s.stage, "ready");
    assert.equal(startingPercent(s), 100);
  });
  it("becomes an error only while starting, and keeps the message", () => {
    const s = reduceEngine(starting, { kind: "error", text: "Python could not start: boom" });
    assert.equal(s.stage, "error");
    assert.equal(s.error, "Python could not start: boom");
    assert.equal(reduceEngine(s, { kind: "ready" }).stage, "error");
  });
});
