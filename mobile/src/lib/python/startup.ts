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
