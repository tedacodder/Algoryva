import type { SqlDb } from "../db/sql";
import type { MistakePayload, SyncEventInput } from "../api/types";
import { nextReviewDate, NOTE_MAX, NOTE_MIN, unlockState } from "../rules/schedule";
import { checkMistake } from "../rules/mistake";

/**
 * Local learner changes. Each change is applied to the device's tables AND written to the outbox in the same transaction, so a
 * crash can never leave a change applied but unsent, or sent but not applied.
 *
 * The local rules refuse what the server would obviously refuse (a locked topic, an unknown problem). The server still decides
 * everything: an accepted local change can still be rejected later, and the next sync replaces it with the server's version.
 * Clocks: `now` is the device time. It is sent as `at` and used for display only; the server ignores it for awards and order.
 */
type Distribute<T> = T extends unknown ? Omit<T, "id" | "at"> : never;
export type LocalAction = Distribute<SyncEventInput>;

export type LocalResult = { applied: true } | { applied: false; reason: string };

const iso = (d: Date) => d.toISOString();
const refuse = (reason: string): LocalResult => ({ applied: false, reason });

export async function completedSlugs(db: SqlDb): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ topic_slug: string }>("SELECT topic_slug FROM progress WHERE completed_at IS NOT NULL");
  return new Set(rows.map((r) => r.topic_slug));
}

/** Applies one action to the local tables. Expected refusals are returned, not thrown. */
export async function applyLocal(db: SqlDb, action: LocalAction, now: Date): Promise<LocalResult> {
  switch (action.type) {
    case "topic.complete": {
      const row = await db.getFirstAsync<{ json: string }>("SELECT json FROM topics WHERE slug = ?", [action.payload.slug]);
      if (!row) return refuse("unknown_topic");
      const topic = JSON.parse(row.json) as { prereqs: string[]; status: string };
      if (topic.status !== "PUBLISHED") return refuse("unknown_topic");
      const state = unlockState(topic.prereqs, await completedSlugs(db));
      if (!state.unlocked) return refuse("prerequisites_missing");
      await db.runAsync(
        `INSERT INTO progress (topic_slug, completed_at, review_step, review_due_at, origin, updated_at)
         VALUES (?, ?, 0, ?, 'local', ?)
         ON CONFLICT(topic_slug) DO UPDATE SET
           completed_at = COALESCE(progress.completed_at, excluded.completed_at),
           review_step = COALESCE(progress.review_step, 0),
           review_due_at = COALESCE(progress.review_due_at, excluded.review_due_at),
           updated_at = excluded.updated_at`,
        [action.payload.slug, iso(now), iso(nextReviewDate(now, 0)), iso(now)],
      );
      return { applied: true };
    }

    case "topic.review": {
      const row = await db.getFirstAsync<{ review_step: number | null; review_due_at: string | null }>(
        "SELECT review_step, review_due_at FROM progress WHERE topic_slug = ?", [action.payload.slug],
      );
      if (!row || row.review_step === null) return refuse("not_applicable");
      if (!row.review_due_at || row.review_due_at > iso(now)) return refuse("not_due");
      const step = action.payload.rating === "good" ? row.review_step + 1 : 0;
      await db.runAsync(
        "UPDATE progress SET review_step = ?, review_due_at = ?, updated_at = ? WHERE topic_slug = ?",
        [step, iso(nextReviewDate(now, step)), iso(now), action.payload.slug],
      );
      return { applied: true };
    }

    case "quiz.submit": {
      const topic = await db.getFirstAsync<{ slug: string }>("SELECT slug FROM topics WHERE slug = ?", [action.payload.slug]);
      if (!topic) return refuse("not_applicable");
      // The score is decided by the server. Here the answers only wait in the outbox.
      return { applied: true };
    }

    case "solve.external": {
      const row = await db.getFirstAsync<{ json: string }>("SELECT json FROM problems WHERE id = ?", [action.payload.problemId]);
      if (!row) return refuse("unknown_problem");
      if ((JSON.parse(row.json) as { kind: string }).kind !== "EXTERNAL") return refuse("not_applicable");
      if (action.payload.solved) {
        await db.runAsync("INSERT OR IGNORE INTO solves (problem_id, solved_at, origin) VALUES (?, ?, 'local')", [action.payload.problemId, iso(now)]);
      } else {
        await db.runAsync("DELETE FROM solves WHERE problem_id = ?", [action.payload.problemId]);
      }
      return { applied: true };
    }

    case "mistake.create": {
      const payload: MistakePayload = action.payload;
      const check = checkMistake(payload);
      if (!check.ok) return refuse(`invalid: ${check.error}`);
      const { id, ...fields } = payload;
      await db.runAsync("INSERT OR IGNORE INTO mistakes (id, json, created_at, origin) VALUES (?, ?, ?, 'local')", [id, JSON.stringify(fields), iso(now)]);
      return { applied: true };
    }

    case "mistake.delete":
      await db.runAsync("DELETE FROM mistakes WHERE id = ?", [action.payload.id]);
      return { applied: true };

    case "note.create": {
      const p = action.payload;
      const title = p.title.trim();
      const body = p.body.trim();
      if (title.length < 1 || title.length > 120 || body.length < 1 || body.length > 20000) return refuse("invalid: note length");
      await db.runAsync(
        "INSERT OR IGNORE INTO notes (id, title, body, tags, created_at, origin) VALUES (?, ?, ?, ?, ?, 'local')",
        [p.id, title, body, JSON.stringify(p.tags), iso(now)],
      );
      return { applied: true };
    }

    case "note.delete":
      await db.runAsync("DELETE FROM notes WHERE id = ?", [action.payload.id]);
      return { applied: true };

    case "revisit.report_outside": {
      const note = action.payload.note.trim();
      if (note.length < NOTE_MIN || note.length > NOTE_MAX) return refuse("invalid: note length");
      const due = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM revisits WHERE id = ? AND problem_id IS NULL AND passed_at IS NULL AND due_at IS NOT NULL AND due_at <= ?",
        [action.payload.id, iso(now)],
      );
      if (!due) return refuse("not_applicable");
      await db.runAsync("UPDATE revisits SET passed_at = ?, due_at = NULL, passed_by = 'self', note = ? WHERE id = ?", [iso(now), note, action.payload.id]);
      return { applied: true };
    }

    default:
      return refuse("unknown_type");
  }
}

/**
 * Applies the action and queues it for the server only when the local rules accept it. Both writes share one transaction:
 * if the outbox insert fails, the local change is rolled back as well.
 */
export async function enqueueLocal(db: SqlDb, action: LocalAction, id: string, now: Date): Promise<LocalResult> {
  let result: LocalResult = refuse("not_run");
  await db.withTransactionAsync(async () => {
    result = await applyLocal(db, action, now);
    if (!result.applied) return;
    await db.runAsync("INSERT INTO outbox (id, type, payload, at, attempts) VALUES (?, ?, ?, ?, 0)", [id, action.type, JSON.stringify(action.payload), iso(now)]);
  });
  return result;
}
