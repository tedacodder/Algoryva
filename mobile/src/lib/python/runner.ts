/**
 * Runs a Python program and returns what it printed. This is the logic the editor uses; it does not depend on the WebView, so it can
 * be tested with the same Pyodide build that the app ships.
 *
 *  - stdout and stderr are captured separately, and each is capped so a runaway print loop cannot fill memory.
 *  - input(): the lines the learner typed are supplied in order. When the program asks for more than were supplied, input() raises
 *    EOFError, exactly as it does on a closed terminal, and the run ends with that error.
 *  - Errors are returned as text (the last line of the traceback), never thrown into the app.
 */
export const MAX_OUTPUT_CHARS = 64_000;

export type RunResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  error: string | null;
  truncated: boolean;
  durationMs: number;
};

/** The minimal interface of a Python runtime. Pyodide satisfies it through createPyodideRuntime. */
export interface PythonRuntime {
  setStdout(handler: (line: string) => void): void;
  setStderr(handler: (line: string) => void): void;
  setStdin(next: () => string | undefined): void;
  runPython(code: string): unknown;
}

export class OutputBuffer {
  private parts: string[] = [];
  private size = 0;
  truncated = false;
  push(text: string): void {
    if (this.truncated) return;
    if (this.size + text.length > MAX_OUTPUT_CHARS) {
      this.parts.push(text.slice(0, Math.max(0, MAX_OUTPUT_CHARS - this.size)));
      this.size = MAX_OUTPUT_CHARS;
      this.truncated = true;
      return;
    }
    this.parts.push(text);
    this.size += text.length;
  }
  text(): string {
    return this.parts.join("");
  }
}

/** The last line of a traceback is the error; the full traceback is noise for a learner on a phone. */
export function lastErrorLine(message: string): string {
  const lines = message.trimEnd().split("\n").filter((l) => l.trim().length > 0);
  return lines[lines.length - 1] ?? "Error";
}

export async function runProgram(runtime: PythonRuntime, code: string, stdinLines: string[], now: () => number = Date.now): Promise<RunResult> {
  const out = new OutputBuffer();
  const err = new OutputBuffer();
  const lines = [...stdinLines];
  const started = now();
  runtime.setStdout((line) => out.push(line + "\n"));
  runtime.setStderr((line) => err.push(line + "\n"));
  runtime.setStdin(() => (lines.length > 0 ? lines.shift() : undefined));
  let error: string | null = null;
  try {
    runtime.runPython(code);
  } catch (e) {
    error = lastErrorLine(e instanceof Error ? e.message : String(e));
    err.push(error + "\n");
  }
  return {
    ok: error === null,
    stdout: out.text(),
    stderr: err.text(),
    error,
    truncated: out.truncated || err.truncated,
    durationMs: now() - started,
  };
}

/**
 * Adapts a loaded Pyodide instance to PythonRuntime. Each run gets its own globals, so one run cannot see another run's variables.
 * The Pyodide module is passed in, so this file has no runtime dependency and can be tested with the same build the app ships.
 */
export function createPyodideRuntime(py: PyodideLike): PythonRuntime {
  return {
    setStdout: (h) => py.setStdout({ batched: h }),
    setStderr: (h) => py.setStderr({ batched: h }),
    setStdin: (next) => py.setStdin({ stdin: () => next() }),
    runPython: (code) => py.runPython(code, { globals: py.toPy({}) }),
  };
}

/** The part of the Pyodide API that the runtime uses. */
export type PyodideLike = {
  setStdout(opts: { batched(s: string): void }): void;
  setStderr(opts: { batched(s: string): void }): void;
  setStdin(opts: { stdin(): string | undefined }): void;
  runPython(code: string, opts?: { globals?: unknown }): unknown;
  toPy(value: unknown): unknown;
};
