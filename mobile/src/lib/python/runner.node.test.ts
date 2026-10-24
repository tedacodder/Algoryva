import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPyodideRuntime, runProgram, OutputBuffer, MAX_OUTPUT_CHARS, lastErrorLine, type PythonRuntime } from "./runner";

/**
 * Runs real Python through the Pyodide build that the app ships (the same files, loaded from the local package, no network).
 * These tests check the behaviour a learner sees: printed output, typed input, errors, output limits, and fresh globals per run.
 */
let py: unknown;
let runtime: PythonRuntime;
let loadPyodide: (opts: { indexURL: string }) => Promise<unknown>;

before(async () => {
  const mod = await import("pyodide");
  loadPyodide = mod.loadPyodide as typeof loadPyodide;
  py = await loadPyodide({ indexURL: `${process.cwd()}/node_modules/pyodide/` });
  runtime = createPyodideRuntime(py as Parameters<typeof createPyodideRuntime>[0]);
});

describe("OutputBuffer", () => {
  it("caps output and reports that it was cut", () => {
    const b = new OutputBuffer();
    b.push("x".repeat(MAX_OUTPUT_CHARS));
    b.push("more");
    assert.equal(b.text().length, MAX_OUTPUT_CHARS);
    assert.equal(b.truncated, true);
  });
});

describe("error lines", () => {
  it("keeps only the last line of a traceback", () => {
    assert.equal(lastErrorLine("Traceback (most recent call last):\n  File \"x\", line 1\nZeroDivisionError: division by zero\n"), "ZeroDivisionError: division by zero");
  });
});

describe("running real Python", () => {
  it("prints what the program prints, with the interpreter's own output", async () => {
    const r = await runProgram(runtime, "print('hello', 1 + 2)\nprint([x * x for x in range(4)])", []);
    assert.equal(r.ok, true);
    assert.equal(r.stdout, "hello 3\n[0, 1, 4, 9]\n");
    assert.equal(r.error, null);
  });

  it("reads input() from the lines the learner typed, in order", async () => {
    const r = await runProgram(runtime, "name = input()\nn = int(input())\nprint(f'{name}: {n * 2}')", ["Ada", "21"]);
    assert.equal(r.stdout, "Ada: 42\n");
    assert.equal(r.ok, true);
  });

  it("ends the run with EOFError when input() asks for more than was typed", async () => {
    const r = await runProgram(runtime, "print(input())\nprint(input())", ["only one"]);
    assert.equal(r.stdout, "only one\n");
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /EOFError/);
  });

  it("reports a runtime error as one readable line and keeps the output printed before it", async () => {
    const r = await runProgram(runtime, "print('before')\nprint(1 / 0)\nprint('after')", []);
    assert.equal(r.stdout, "before\n");
    assert.equal(r.ok, false);
    assert.equal(r.error, "ZeroDivisionError: division by zero");
  });

  it("reports a syntax error instead of crashing", async () => {
    const r = await runProgram(runtime, "print('unclosed'", []);
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /SyntaxError|was never closed/);
  });

  it("each run starts with fresh variables", async () => {
    await runProgram(runtime, "secret = 42", []);
    const r = await runProgram(runtime, "print('secret' in globals())", []);
    assert.equal(r.stdout, "False\n");
  });

  it("the standard library works offline (math, json, collections)", async () => {
    const r = await runProgram(runtime, "import math, json, collections\nprint(math.isqrt(50), json.dumps({'a': 1}), collections.Counter('aab')['a'])", []);
    assert.equal(r.stdout, "7 {\"a\": 1} 2\n");
  });

  it("stderr is captured separately from stdout", async () => {
    const r = await runProgram(runtime, "import sys\nprint('out')\nprint('err', file=sys.stderr)", []);
    assert.equal(r.stdout, "out\n");
    assert.equal(r.stderr, "err\n");
  });
});
