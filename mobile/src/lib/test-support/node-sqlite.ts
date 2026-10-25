import { DatabaseSync } from "node:sqlite";
import type { SqlDb, SqlParam } from "../db/sql";

/**
 * A real SQLite database for Node tests, behind the same SqlDb interface the app uses on the phone. The SQL runs for real,
 * including constraints, transactions and rollback. Only the engine differs from expo-sqlite (both are SQLite).
 */
export function openTestDb(): SqlDb & { close(): void } {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  return {
    close: () => raw.close(),
    async execAsync(sql) {
      raw.exec(sql);
    },
    async runAsync(sql, params = []) {
      raw.prepare(sql).run(...(params as SqlParam[] as never[]));
    },
    async getAllAsync<T>(sql: string, params: SqlParam[] = []) {
      // Copy rows into plain objects: node:sqlite returns null-prototype rows, expo-sqlite returns ordinary objects.
      return (raw.prepare(sql).all(...(params as never[])) as object[]).map((r) => ({ ...r })) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlParam[] = []) {
      const row = raw.prepare(sql).get(...(params as never[])) as object | undefined;
      return row ? ({ ...row } as T) : null;
    },
    async withTransactionAsync(task) {
      raw.exec("BEGIN");
      try {
        await task();
        raw.exec("COMMIT");
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
