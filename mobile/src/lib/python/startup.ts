/**
 * What the Python Runner tells the learner while it gets ready. Kept apart from the screen so the wording and the timing rules are tested.
 */
export const STARTUP_HINT_AFTER_S = 45;

export function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shown while the runtime files are copied to the phone (once, on first use). */
export function copyProgressText(done: number, total: number, name: string, bytes: number): string {
  return `Copying Python to this phone (first time only): ${done} of ${total} files. Now: ${name}, ${formatMB(bytes)}.`;
}

/** Shown while the runtime starts. `stage` is the latest message the runtime sent, or null before the first one. */
export function startingText(elapsedS: number, stage: string | null): string {
  const where = stage ?? "Preparing";
  return `${where}… ${elapsedS}s`;
}

/** After STARTUP_HINT_AFTER_S seconds without a ready signal, say what to do next. Returns null before that. */
export function startupHint(elapsedS: number): string | null {
  if (elapsedS < STARTUP_HINT_AFTER_S) return null;
  return "This is taking longer than usual. The first start can take a minute on an older phone. If it does not finish, tap Restart Python.";
}

/**
 * Progress for the start-up, as a percentage. Copying is measured in bytes. Starting is estimated from the runtime files it has
 * finished loading (weighted by size) and the stage it has reached. It is never 100 until the runtime says it is ready.
 */
export const LOAD_WEIGHTS: Record<string, number> = { "pyodide.js": 2, "pyodide.asm.mjs": 10, "pyodide.asm.wasm": 60, "python_stdlib.zip": 24, "pyodide-lock.json": 4 };

export function copyPercent(doneBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0;
  return Math.min(100, Math.round((doneBytes / totalBytes) * 100));
}

export function startPercent(loadedFiles: string[], stagePct: number, ready: boolean): number {
  if (ready) return 100;
  const fetched = loadedFiles.reduce((n, f) => n + (LOAD_WEIGHTS[f] ?? 0), 0);
  return Math.min(99, Math.max(stagePct, Math.round(fetched)));
}

/**
 * The runtime files the page needs by fetch. They are handed to the page as base64 data, because the WebView will not fetch files
 * from the phone's folder. Returns the address to fetch instead: the data address for a known file, otherwise the original address.
 */
export const INLINED_FILES = ["pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"] as const;

export function inlinedTarget(url: string, inlined: Record<string, string>): string {
  const name = url.split("/").pop()?.split("?")[0] ?? "";
  const data = inlined[name];
  if (data === undefined) return url;
  const type = name.endsWith(".wasm") ? "application/wasm" : name.endsWith(".json") ? "application/json" : "application/octet-stream";
  return `data:${type};base64,${data}`;
}
