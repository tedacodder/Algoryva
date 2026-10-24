import type { SqlDb } from "../db/sql";
import type { ServerMistake, ServerNote, SyncState } from "../api/types";
import { applyLocal, type LocalAction } from "./apply";

/**
 * The server's complete state for one account, as a single consistent snapshot (see fetchSnapshot).
 * Applying it replaces every server-origin row, then replays the device's unsent changes on top. The replay is what keeps offline
 * work visible and safe: a snapshot never erases an outbox entry.
 */
export type CompleteSnapshot = { cursor: string; state: SyncState; notes: ServerNote[]; mistakes: ServerMistake[] };

export const iso = (d: Date) => d.toISOString();

/** Replaces the mirror of server data with `snap`, then replays the outbox, all in one transaction. */
export async function applySnapshot(db: SqlDb, snap: CompleteSnapshot, accountId: string, now: Date): Promise<number> {
  let replayed = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM progress");
    await db.runAsync("DELETE FROM solves");
    await db.runAsync("DELETE FROM revisits");
    await db.runAsync("DELETE FROM mistakes");
    await db.runAsync("DELETE FROM notes");

    const bySlug = new Map<string, { completed: string | null; reviewStep: number | null; reviewDue: string | null; qBest: number | null; qTotal: number | null; qAttempts: number | null; qPassed: string | null }>();
    const row = (slug: string) => {
      let r = bySlug.get(slug);
      if (!r) bySlug.set(slug, (r = { completed: null, reviewStep: null, reviewDue: null, qBest: null, qTotal: null, qAttempts: null, qPassed: null }));
      return r;
    };
    for (const t of snap.state.topicProgress) row(t.slug).completed = t.completedAt;
    for (const r of snap.state.reviewItems) Object.assign(row(r.slug), { reviewStep: r.step, reviewDue: r.dueAt });
    for (const q of snap.state.quizResults) Object.assign(row(q.slug), { qBest: q.bestScore, qTotal: q.total, qAttempts: q.attempts, qPassed: q.passedAt });
    for (const [slug, r] of bySlug) {
      await db.runAsync(
        `INSERT INTO progress (topic_slug, completed_at, review_step, review_due_at, quiz_best, quiz_total, quiz_attempts, quiz_passed_at, origin, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'server', ?)`,
        [slug, r.completed, r.reviewStep, r.reviewDue, r.qBest, r.qTotal, r.qAttempts, r.qPassed, iso(now)],
      );
    }
    for (const s of snap.state.solves) {
      await db.runAsync("INSERT INTO solves (problem_id, solved_at, origin) VALUES (?, ?, 'server')", [s.problemId, s.solvedAt]);
    }
    for (const r of snap.state.revisits) {
      await db.runAsync(
        `INSERT INTO revisits (id, problem_id, outside_title, outside_url, due_at, step, passed_at, passed_by, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.problemId, r.outsideTitle, r.outsideUrl, r.dueAt, r.step, r.passedAt, r.passedBy, r.note],
      );
    }
    for (const m of snap.mistakes) {
      await db.runAsync("INSERT INTO mistakes (id, json, created_at, origin) VALUES (?, ?, ?, 'server')", [m.id, JSON.stringify(m), m.createdAt]);
    }
    for (const n of snap.notes) {
      await db.runAsync("INSERT INTO notes (id, title, body, tags, created_at, origin) VALUES (?, ?, ?, ?, ?, 'server')", [n.id, n.title, n.body, JSON.stringify(n.tags), n.createdAt]);
    }
    replayed = await replayOutbox(db, now);
    await db.runAsync(
      `INSERT INTO sync_state (id, cursor, account_id) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET cursor = excluded.cursor, account_id = excluded.account_id`,
      [snap.cursor, accountId],
    );
  });
  return replayed;
}

/** Re-applies every unsent change to the mirror, in the order it was made. Refused changes are skipped; the server decides them. */
export async function replayOutbox(db: SqlDb, now: Date): Promise<number> {
  const rows = await db.getAllAsync<{ type: string; payload: string }>("SELECT type, payload FROM outbox ORDER BY seq");
  for (const r of rows) {
    await applyLocal(db, { type: r.type, payload: JSON.parse(r.payload) } as LocalAction, now);
  }
  return rows.length;
}

export async function clearServerMirror(db: SqlDb, now: Date): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of ["progress", "solves", "revisits", "mistakes", "notes", "sync_state"]) await db.runAsync(`DELETE FROM ${t}`);
    await replayOutbox(db, now);
  });
}

export async function readSyncState(db: SqlDb): Promise<{ accountId: string | null; cursor: string | null } | null> {
  const row = await db.getFirstAsync<{ account_id: string | null; cursor: string | null }>("SELECT account_id, cursor FROM sync_state WHERE id = 1");
  return row ? { accountId: row.account_id, cursor: row.cursor } : null;
}

export async function countPending(db: SqlDb): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox");
  return row?.n ?? 0;
}
