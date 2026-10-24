import type { SqlDb } from "../db/sql";

/** Saved Python programs, kept on this device. Names are trimmed and limited so the list stays readable. */
export type Snippet = { id: string; name: string; code: string; updatedAt: string };

export const SNIPPET_NAME_MAX = 60;
export const SNIPPET_CODE_MAX = 100_000;

export function checkSnippet(name: string, code: string): { ok: true; name: string } | { ok: false; error: string } {
  const clean = name.trim();
  if (clean.length === 0) return { ok: false, error: "Give the program a name." };
  if (clean.length > SNIPPET_NAME_MAX) return { ok: false, error: `The name can be ${SNIPPET_NAME_MAX} characters at most.` };
  if (code.length > SNIPPET_CODE_MAX) return { ok: false, error: "This program is too long to save." };
  return { ok: true, name: clean };
}

/** Saves a program. Saving an existing id replaces it. */
export async function saveSnippet(db: SqlDb, s: { id: string; name: string; code: string; now: Date }): Promise<void> {
  await db.runAsync(
    "INSERT INTO snippets (id, name, code, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, code = excluded.code, updated_at = excluded.updated_at",
    [s.id, s.name, s.code, s.now.toISOString()],
  );
}

export async function listSnippets(db: SqlDb): Promise<Snippet[]> {
  const rows = await db.getAllAsync<{ id: string; name: string; code: string; updated_at: string }>(
    "SELECT id, name, code, updated_at FROM snippets ORDER BY updated_at DESC",
  );
  return rows.map((r) => ({ id: r.id, name: r.name, code: r.code, updatedAt: r.updated_at }));
}

export async function deleteSnippet(db: SqlDb, id: string): Promise<void> {
  await db.runAsync("DELETE FROM snippets WHERE id = ?", [id]);
}
