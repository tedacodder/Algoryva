/**
 * The small database surface the app uses. It matches the async API of expo-sqlite, so the same repository code runs on the
 * phone (expo-sqlite) and in Node tests (node:sqlite, see src/lib/test-support/node-sqlite.ts).
 */
export type SqlParam = string | number | null;

export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParam[]): Promise<void>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  /** Runs `task` in a transaction: committed if it resolves, rolled back if it throws. */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
