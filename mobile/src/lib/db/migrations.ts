import type { SqlDb } from "./sql";

/**
 * Schema migrations for the on-device database. Rules:
 *  - A migration that has shipped is never edited. Add a new one instead.
 *  - Migrations only add tables and columns, so an older app version can keep reading a newer database.
 *  - Each migration runs in its own transaction and is recorded in schema_migrations, so re-running is a no-op.
 *
 * Tables written in this phase: content_meta, topics, lessons, problems (server content).
 * Learner tables (progress, solves, mistakes, notes, outbox, sync_state) are created now and filled by Phase 4 onward.
 */
export type Migration = { version: number; name: string; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "content-and-learner-tables",
    sql: `
      CREATE TABLE content_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version TEXT NOT NULL,
        etag TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      );
      CREATE TABLE topics (
        slug TEXT PRIMARY KEY,
        position INTEGER NOT NULL,
        title TEXT NOT NULL,
        level TEXT NOT NULL,
        status TEXT NOT NULL,
        json TEXT NOT NULL
      );
      CREATE INDEX topics_position ON topics (position);
      CREATE TABLE lessons (
        topic_slug TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        json TEXT NOT NULL
      );
      CREATE TABLE problems (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        position INTEGER NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        json TEXT NOT NULL
      );
      CREATE INDEX problems_position ON problems (position);
      CREATE TABLE progress (
        topic_slug TEXT PRIMARY KEY,
        completed_at TEXT,
        review_step INTEGER,
        review_due_at TEXT,
        quiz_best INTEGER,
        quiz_total INTEGER,
        quiz_attempts INTEGER,
        quiz_passed_at TEXT,
        origin TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE solves (
        problem_id TEXT PRIMARY KEY,
        solved_at TEXT NOT NULL,
        origin TEXT NOT NULL
      );
      CREATE TABLE mistakes (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        origin TEXT NOT NULL
      );
      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        tags TEXT NOT NULL,
        created_at TEXT NOT NULL,
        origin TEXT NOT NULL
      );
      CREATE TABLE outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT
      );
      CREATE TABLE sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        cursor TEXT
      );
    `,
  },
  {
    version: 2,
    name: "revisits-and-sync-account",
    sql: `
      CREATE TABLE revisits (
        id TEXT PRIMARY KEY,
        problem_id TEXT,
        outside_title TEXT,
        outside_url TEXT,
        due_at TEXT,
        step INTEGER NOT NULL,
        passed_at TEXT,
        passed_by TEXT,
        note TEXT
      );
      ALTER TABLE sync_state ADD COLUMN account_id TEXT;
    `,
  },
  {
    version: 3,
    name: "submissions",
    sql: `
      CREATE TABLE submissions (
        client_id TEXT PRIMARY KEY,
        problem_id TEXT NOT NULL,
        outputs TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'judged', 'refused')),
        verdict TEXT,
        last_error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX submissions_problem ON submissions (problem_id, created_at);
    `,
  },
  {
    version: 4,
    name: "preferences",
    sql: `
      CREATE TABLE prefs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 5,
    name: "python-snippets",
    sql: `
      CREATE TABLE snippets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
];

/** Applies every migration that has not run yet, in version order. Returns the number applied in this call. */
export async function migrate(db: SqlDb, now: () => Date = () => new Date()): Promise<number> {
  const versions = MIGRATIONS.map((m) => m.version);
  if (new Set(versions).size !== versions.length || versions.some((v, i) => i > 0 && v <= versions[i - 1]!)) {
    throw new Error("Migrations must have unique, ascending versions.");
  }
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  const done = new Set((await db.getAllAsync<{ version: number }>("SELECT version FROM schema_migrations")).map((r) => r.version));
  let applied = 0;
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.runAsync("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)", [m.version, m.name, now().toISOString()]);
    });
    applied++;
  }
  return applied;
}
