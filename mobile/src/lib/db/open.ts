import * as SQLite from "expo-sqlite";
import type { SqlDb } from "./sql";
import { migrate } from "./migrations";

/**
 * Opens the app's database on the phone and applies migrations. The file lives in the app's private storage.
 * Opened once per app run and shared; repositories receive the handle, so they stay testable.
 */
const DB_NAME = "algoryva.db";
let opening: Promise<SqlDb> | null = null;

export function getDatabase(): Promise<SqlDb> {
  opening ??= (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    const adapter: SqlDb = {
      execAsync: (sql) => db.execAsync(sql),
      runAsync: (sql, params) => db.runAsync(sql, params ?? []).then(() => undefined),
      getAllAsync: <T,>(sql: string, params?: (string | number | null)[]) => db.getAllAsync<T>(sql, params ?? []),
      getFirstAsync: <T,>(sql: string, params?: (string | number | null)[]) => db.getFirstAsync<T>(sql, params ?? []),
      withTransactionAsync: (task) => db.withTransactionAsync(task),
    };
    await migrate(adapter);
    return adapter;
  })();
  opening.catch(() => {
    opening = null; // let the next call retry (for example after a storage error)
  });
  return opening;
}
