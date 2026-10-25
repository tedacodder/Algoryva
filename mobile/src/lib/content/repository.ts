import type { SqlDb } from "../db/sql";
import type { ContentLesson, ContentProblem, ContentResponse, ContentTopic } from "../api/types";

/**
 * Reads and writes the downloaded content snapshot. A snapshot replaces the whole previous one inside one transaction, so the app
 * never shows a mixture of two versions and a failed write leaves the previous snapshot untouched.
 */
export type ContentState = { version: string; etag: string; fetchedAt: string };

export async function readContentState(db: SqlDb): Promise<ContentState | null> {
  const row = await db.getFirstAsync<{ version: string; etag: string; fetched_at: string }>(
    "SELECT version, etag, fetched_at FROM content_meta WHERE id = 1",
  );
  return row ? { version: row.version, etag: row.etag, fetchedAt: row.fetched_at } : null;
}

/** Structural check on data from the network before anything is stored. It does not replace the server's strict schema. */
export function isContentResponse(v: unknown): v is ContentResponse {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Partial<Record<keyof ContentResponse, unknown>>;
  return typeof c.version === "string" && Array.isArray(c.topics) && Array.isArray(c.lessons) && Array.isArray(c.problems);
}

export async function storeContentSnapshot(db: SqlDb, snapshot: { etag: string; data: ContentResponse }, fetchedAt: Date): Promise<void> {
  if (!isContentResponse(snapshot.data)) throw new Error("Refusing to store content that does not have the expected shape.");
  const { data } = snapshot;
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM lessons");
    await db.runAsync("DELETE FROM problems");
    await db.runAsync("DELETE FROM topics");
    for (const t of data.topics as ContentTopic[]) {
      await db.runAsync(
        "INSERT INTO topics (slug, position, title, level, status, json) VALUES (?, ?, ?, ?, ?, ?)",
        [t.slug, t.position, t.title, t.level, t.status, JSON.stringify(t)],
      );
    }
    for (const l of data.lessons as ContentLesson[]) {
      await db.runAsync("INSERT INTO lessons (topic_slug, source, json) VALUES (?, ?, ?)", [l.topicSlug, l.source, JSON.stringify(l)]);
    }
    for (const p of data.problems as ContentProblem[]) {
      await db.runAsync(
        "INSERT INTO problems (id, slug, position, title, kind, difficulty, json) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [p.id, p.slug, p.position, p.title, p.kind, p.difficulty, JSON.stringify(p)],
      );
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO content_meta (id, version, etag, fetched_at) VALUES (1, ?, ?, ?)",
      [data.version, snapshot.etag, fetchedAt.toISOString()],
    );
  });
}

export async function loadTopics(db: SqlDb): Promise<ContentTopic[]> {
  const rows = await db.getAllAsync<{ json: string }>("SELECT json FROM topics ORDER BY position");
  return rows.map((r) => JSON.parse(r.json) as ContentTopic);
}

export async function loadLesson(db: SqlDb, topicSlug: string): Promise<ContentLesson | null> {
  const row = await db.getFirstAsync<{ json: string }>("SELECT json FROM lessons WHERE topic_slug = ?", [topicSlug]);
  return row ? (JSON.parse(row.json) as ContentLesson) : null;
}

export async function loadProblems(db: SqlDb): Promise<ContentProblem[]> {
  const rows = await db.getAllAsync<{ json: string }>("SELECT json FROM problems ORDER BY position");
  return rows.map((r) => JSON.parse(r.json) as ContentProblem);
}

export async function loadProblem(db: SqlDb, slug: string): Promise<ContentProblem | null> {
  const row = await db.getFirstAsync<{ json: string }>("SELECT json FROM problems WHERE slug = ?", [slug]);
  return row ? (JSON.parse(row.json) as ContentProblem) : null;
}
