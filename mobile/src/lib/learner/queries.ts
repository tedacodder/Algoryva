import type { SqlDb } from "../db/sql";
import type { ServerMistake, ServerNote } from "../api/types";

/** Read-only views of the learner's data, shaped for the screens. */
export type TopicProgress = {
  completedAt: string | null;
  reviewStep: number | null;
  reviewDueAt: string | null;
  quizBest: number | null;
  quizTotal: number | null;
  quizPassedAt: string | null;
};

export async function loadProgressMap(db: SqlDb): Promise<Map<string, TopicProgress>> {
  const rows = await db.getAllAsync<{ topic_slug: string; completed_at: string | null; review_step: number | null; review_due_at: string | null; quiz_best: number | null; quiz_total: number | null; quiz_passed_at: string | null }>(
    "SELECT topic_slug, completed_at, review_step, review_due_at, quiz_best, quiz_total, quiz_passed_at FROM progress",
  );
  return new Map(rows.map((r) => [r.topic_slug, {
    completedAt: r.completed_at, reviewStep: r.review_step, reviewDueAt: r.review_due_at,
    quizBest: r.quiz_best, quizTotal: r.quiz_total, quizPassedAt: r.quiz_passed_at,
  }]));
}

export async function loadSolvedIds(db: SqlDb): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ problem_id: string }>("SELECT problem_id FROM solves");
  return new Set(rows.map((r) => r.problem_id));
}

export async function countReviewsDue(db: SqlDb, nowIso: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM progress WHERE review_due_at IS NOT NULL AND review_due_at <= ?", [nowIso],
  );
  return row?.n ?? 0;
}

export async function loadMistakes(db: SqlDb): Promise<ServerMistake[]> {
  const rows = await db.getAllAsync<{ id: string; json: string; created_at: string }>("SELECT id, json, created_at FROM mistakes ORDER BY created_at DESC");
  return rows.map((r) => ({ ...(JSON.parse(r.json) as Omit<ServerMistake, "id" | "createdAt">), id: r.id, createdAt: r.created_at }));
}

export async function loadNotes(db: SqlDb): Promise<ServerNote[]> {
  const rows = await db.getAllAsync<{ id: string; title: string; body: string; tags: string; created_at: string }>(
    "SELECT id, title, body, tags, created_at FROM notes ORDER BY created_at DESC",
  );
  return rows.map((r) => ({ id: r.id, title: r.title, body: r.body, tags: JSON.parse(r.tags) as string[], createdAt: r.created_at }));
}

export type DueRevisit = {
  id: string;
  problemId: string | null;
  problemTitle: string | null;
  problemSlug: string | null;
  outsideTitle: string | null;
  outsideUrl: string | null;
  dueAt: string;
};

/** Revisits that are due now and not yet passed, oldest first. */
export async function loadDueRevisits(db: SqlDb, nowIso: string): Promise<DueRevisit[]> {
  const rows = await db.getAllAsync<{ id: string; problem_id: string | null; outside_title: string | null; outside_url: string | null; due_at: string; title: string | null; slug: string | null }>(
    `SELECT r.id, r.problem_id, r.outside_title, r.outside_url, r.due_at, p.title, p.slug
       FROM revisits r LEFT JOIN problems p ON p.id = r.problem_id
      WHERE r.passed_at IS NULL AND r.due_at IS NOT NULL AND r.due_at <= ?
      ORDER BY r.due_at`,
    [nowIso],
  );
  return rows.map((r) => ({
    id: r.id, problemId: r.problem_id, problemTitle: r.title, problemSlug: r.slug,
    outsideTitle: r.outside_title, outsideUrl: r.outside_url, dueAt: r.due_at,
  }));
}

export type DueTopicReview = { slug: string; title: string; step: number; dueAt: string };

/** Topic reviews that are due now (the website's "Reviews Due Today"). Works offline: it reads this device's progress. */
export async function loadDueTopicReviews(db: SqlDb, nowIso: string): Promise<DueTopicReview[]> {
  const rows = await db.getAllAsync<{ topic_slug: string; title: string; review_step: number; review_due_at: string }>(
    `SELECT p.topic_slug, t.title, p.review_step, p.review_due_at
       FROM progress p JOIN topics t ON t.slug = p.topic_slug
      WHERE p.review_step IS NOT NULL AND p.review_due_at IS NOT NULL AND p.review_due_at <= ?
      ORDER BY p.review_due_at`,
    [nowIso],
  );
  return rows.map((r) => ({ slug: r.topic_slug, title: r.title, step: r.review_step, dueAt: r.review_due_at }));
}

/** Minutes each lesson takes, by topic, for the curriculum cards. */
export async function loadLessonMinutes(db: SqlDb): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{ topic_slug: string; json: string }>("SELECT topic_slug, json FROM lessons");
  return new Map(rows.map((r) => [r.topic_slug, (JSON.parse(r.json) as { minutes?: number }).minutes ?? 0]));
}

/** Every built-in lesson's quiz questions, for practice mode. */
export async function loadAllQuizQuestions(db: SqlDb): Promise<{ topicSlug: string; title: string; question: import("../api/types").QuizQuestion }[]> {
  const rows = await db.getAllAsync<{ topic_slug: string; json: string; title: string | null }>(
    "SELECT l.topic_slug, l.json, t.title FROM lessons l JOIN topics t ON t.slug = l.topic_slug WHERE l.source = 'builtin'",
  );
  return rows.flatMap((r) => {
    const lesson = JSON.parse(r.json) as { checks?: import("../api/types").QuizQuestion[] };
    return (lesson.checks ?? []).map((question) => ({ topicSlug: r.topic_slug, title: r.title ?? r.topic_slug, question }));
  });
}

/** Topic reviews that are scheduled but not due yet, soonest first. Shown so the Reviews tab is never empty without explanation. */
export async function loadUpcomingTopicReviews(db: SqlDb, nowIso: string, limit = 20): Promise<DueTopicReview[]> {
  const rows = await db.getAllAsync<{ topic_slug: string; title: string; review_step: number; review_due_at: string }>(
    `SELECT p.topic_slug, t.title, p.review_step, p.review_due_at
       FROM progress p JOIN topics t ON t.slug = p.topic_slug
      WHERE p.review_step IS NOT NULL AND p.review_due_at IS NOT NULL AND p.review_due_at > ?
      ORDER BY p.review_due_at
      LIMIT ?`,
    [nowIso, limit],
  );
  return rows.map((r) => ({ slug: r.topic_slug, title: r.title, step: r.review_step, dueAt: r.review_due_at }));
}
