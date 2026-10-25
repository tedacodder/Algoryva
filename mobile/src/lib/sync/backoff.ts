/**
 * Retry delay after a failed sync: exponential (2s, 4s, 8s, ...), capped at 10 minutes, with jitter so many phones do not retry
 * together. `random` returns a number in [0, 1). The result is between half and one and a half times the step, and never above the cap.
 */
export const BACKOFF_BASE_MS = 2_000;
export const BACKOFF_CAP_MS = 600_000;

export function backoffDelayMs(failures: number, random: () => number, base = BACKOFF_BASE_MS, cap = BACKOFF_CAP_MS): number {
  const step = base * 2 ** Math.max(0, failures - 1);
  const jittered = step * (0.5 + random());
  return Math.round(Math.min(cap, jittered));
}
