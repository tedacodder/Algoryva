/**
 * One queue for every local write section. SQLite on one connection cannot run two transactions at once: a second BEGIN fails, and
 * a write made while another transaction is open can be rolled back with it. The sync engine and the user's actions therefore run
 * their write sections through this queue, one after another. Network calls are never made while holding it.
 */
let tail: Promise<unknown> = Promise.resolve();

export function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => undefined);
  return run;
}
