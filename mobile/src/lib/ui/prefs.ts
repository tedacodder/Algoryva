import type { SqlDb } from "../db/sql";
import type { Preference } from "./theme-types";

/** Saved on the device. The default is "system": follow the phone's light or dark setting. */
export async function readThemePreference(db: SqlDb): Promise<Preference> {
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM prefs WHERE key = 'theme'");
  return row?.value === "light" || row?.value === "dark" ? row.value : "system";
}

export async function writeThemePreference(db: SqlDb, p: Preference): Promise<void> {
  await db.runAsync("INSERT INTO prefs (key, value) VALUES ('theme', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [p]);
}
