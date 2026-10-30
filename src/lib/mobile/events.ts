import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { LESSONS_V2 } from "@/content/lessons-v2";
import { bySlug } from "@/lib/curriculum";
import { nextReviewDate, unlockState } from "@/lib/recommend";
import { passMark } from "@/lib/mastery";
import { NOTE_MAX, NOTE_MIN, firstDueAt, outsideKeyOf, revisitTargetFor } from "@/lib/revisit";
import { parseMistake, type MistakeInput } from "@/lib/mistake-validation";
import { canonicalJson, sha256Hex } from "@/lib/mobile/canonical";

/**
 * Sync push: applies client events to the server. Every rule is decided here, never by the client.
 *
 *  - Each event is applied in its OWN database transaction: the idempotency row (SyncEvent), the effects and the stored
 *    outcome commit together or not at all. An unexpected error rolls the event back and it is simply retried later.
 *  - A duplicate (same user and event id, same content) returns the stored outcome and applies nothing.
 *    The same id with different content is rejected as `id_reuse` and never returns another event's outcome.
 *  - Events in one request are applied in array order. After an infrastructure failure the rest of the batch is NOT
 *    attempted, so order is preserved and the client retries from the first unacknowledged event.
 *  - The client's `at` is validated but never used for awards, streaks, completion times or review scheduling.
 *    These helpers rebuild small pieces of the website's server actions on a transaction client, because those actions use
 *    the global client and cannot join a transaction. The pure helpers (unlockState, nextReviewDate, passMark, parseMistake,
 *    revisitTargetFor) are shared, so the rules cannot drift where it matters most.
 */

export type Outcome = { status: "accepted"; details?: Record<string, unknown> } | { status: "rejected"; reason: string; details?: Record<string, unknown> };
type Tx = Prisma.TransactionClient;

const accepted = (details?: Record<string, unknown>): Outcome => (details ? { status: "accepted", details } : { status: "accepted" });
const reject = (reason: string, details?: Record<string, unknown>): Outcome => (details ? { status: "rejected", reason, details } : { status: "rejected", reason });

// ---- envelope ----
export const MAX_EVENTS_PER_PUSH = 50;
export const pushSchema = z.object({
  events: z.array(z.object({ id: z.string().uuid(), type: z.string().min(1).max(40), payload: z.unknown(), at: z.string().max(64) }).strict()).min(1).max(MAX_EVENTS_PER_PUSH),
}).strict();
export type PushEvent = z.infer<typeof pushSchema>["events"][number];

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const EARLIEST = Date.parse("2020-01-01T00:00:00Z");
const MAX_FUTURE_MS = 24 * 3_600_000;
/** Generous on purpose: `at` is never used for a decision, and rejecting a phone with a wrong clock would strand its data. */
export function validAt(at: string, now: Date): boolean {
  if (!ISO.test(at)) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && t >= EARLIEST && t <= now.getTime() + MAX_FUTURE_MS;
}

// ---- payloads ----
const slugField = z.string().min(1).max(80);
const idField = z.string().min(1).max(64);
const uuid = z.string().uuid();

const noteCreate = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20000),
  tags: z.array(z.string().max(60)).max(20).transform((t) => [...new Set(t.map((x) => x.trim().toLowerCase()).filter(Boolean))]).refine((t) => t.length <= 5 && t.every((x) => /^[a-z0-9-]{1,24}$/.test(x)), "Up to 5 tags, letters, numbers and dashes only"),
}).strict();

const mistakeCreate = z.object({
  id: uuid,
  type: z.string().max(40),
  reason: z.string().max(40).nullable().optional(),
  problemId: z.string().max(64).nullable().optional(),
  outsideTitle: z.string().max(300).nullable().optional(),
  outsideUrl: z.string().max(600).nullable().optional(),
  misunderstood: z.string().max(6000),
  correctIdea: z.string().max(6000),
  recognizeNextTime: z.string().max(6000),
}).strict();

type Prepared<T> = { reject: Outcome } | { data: T };
type Handler<T> = {
  schema: z.ZodType<unknown>;
  /** Stateless checks only (no database). A failure here is not stored: replaying it gives the same answer. */
  prepare: (payload: unknown) => Prepared<T>;
  apply: (tx: Tx, userId: string, data: T, now: Date) => Promise<Outcome>;
};
const handler = <T>(h: Handler<T>) => h as unknown as Handler<unknown>;
const plain = <S extends z.ZodTypeAny>(schema: S) => ({ schema, prepare: (p: unknown) => ({ data: schema.parse(p) as z.infer<S> }) });

async function completedSlugs(tx: Tx, userId: string): Promise<Set<string>> {
  const rows = await tx.topicProgress.findMany({ where: { userId, completedAt: { not: null } }, select: { topicId: true } });
  const topics = await tx.topic.findMany({ where: { id: { in: rows.map((r) => r.topicId) } }, select: { slug: true } });
  return new Set(topics.map((t) => t.slug));
}

async function scheduleOnTx(tx: Tx, userId: string, target: NonNullable<ReturnType<typeof revisitTargetFor>>, now: Date): Promise<void> {
  const dueAt = firstDueAt(now);
  if (target.kind === "site") {
    await tx.revisit.upsert({
      where: { userId_problemId: { userId, problemId: target.problemId } },
      create: { userId, problemId: target.problemId, dueAt, step: 0 },
      update: { dueAt, step: 0, passedAt: null, passedBy: null, note: null },
    });
  } else {
    const outsideKey = outsideKeyOf(target.title, target.url);
    await tx.revisit.upsert({
      where: { userId_outsideKey: { userId, outsideKey } },
      create: { userId, outsideKey, outsideTitle: target.title, outsideUrl: target.url, dueAt, step: 0 },
      update: { outsideTitle: target.title, outsideUrl: target.url, dueAt, step: 0, passedAt: null, passedBy: null, note: null },
    });
  }
}

export const HANDLERS: Record<string, Handler<unknown>> = {
  "topic.complete": handler({
    ...plain(z.object({ slug: slugField }).strict()),
    apply: async (tx, userId, p: { slug: string }, now) => {
      const def = bySlug.get(p.slug);
      if (!def || def.status !== "PUBLISHED") return reject("unknown_topic");
      const state = unlockState(p.slug, await completedSlugs(tx, userId));
      if (!state.unlocked) return reject("prerequisites_missing", { missing: state.missing });
      const topic = await tx.topic.findUnique({ where: { slug: p.slug }, select: { id: true } });
      if (!topic) return reject("unknown_topic");
      await tx.topicProgress.upsert({ where: { userId_topicId: { userId, topicId: topic.id } }, update: { completedAt: now }, create: { userId, topicId: topic.id, completedAt: now } });
      await tx.reviewItem.upsert({ where: { userId_topicId: { userId, topicId: topic.id } }, update: {}, create: { userId, topicId: topic.id, step: 0, dueAt: nextReviewDate(now, 0) } });
      await tx.activity.create({ data: { userId, type: "topic_complete" } });
      return accepted();
    },
  }),

  "topic.review": handler({
    ...plain(z.object({ slug: slugField, rating: z.enum(["good", "again"]) }).strict()),
    // Extra rule compared with the website: a review counts only while it is due, so a stale offline rating cannot advance
    // an item another device already advanced.
    apply: async (tx, userId, p: { slug: string; rating: "good" | "again" }, now) => {
      const topic = await tx.topic.findUnique({ where: { slug: p.slug }, select: { id: true } });
      if (!topic) return reject("unknown_topic");
      const item = await tx.reviewItem.findUnique({ where: { userId_topicId: { userId, topicId: topic.id } } });
      if (!item) return reject("not_applicable");
      if (item.dueAt.getTime() > now.getTime()) return reject("not_due");
      const step = p.rating === "good" ? item.step + 1 : 0;
      await tx.reviewItem.update({ where: { id: item.id }, data: { step, dueAt: nextReviewDate(now, step) } });
      await tx.activity.create({ data: { userId, type: "review" } });
      return accepted();
    },
  }),

  "quiz.submit": handler<{ slug: string; answers: number[] }>({
    schema: z.object({ slug: slugField, answers: z.array(z.number().int()).min(1).max(100) }).strict(),
    prepare: (payload) => {
      const p = z.object({ slug: slugField, answers: z.array(z.number().int()).min(1).max(100) }).strict().parse(payload);
      const lesson = LESSONS_V2[p.slug];
      if (!lesson) return { reject: reject("not_applicable") };
      if (p.answers.length !== lesson.checks.length) return { reject: reject("invalid_payload", { expected: lesson.checks.length }) };
      return { data: p };
    },
    apply: async (tx, userId, p, now) => {
      const lesson = LESSONS_V2[p.slug];
      const score = lesson.checks.reduce((n, c, i) => n + (p.answers[i] === c.answer ? 1 : 0), 0);
      const total = lesson.checks.length;
      const passed = score >= passMark(total);
      const topic = await tx.topic.findUnique({ where: { slug: p.slug }, select: { id: true } });
      if (!topic) return reject("unknown_topic");
      const prev = await tx.quizResult.findUnique({ where: { userId_topicId: { userId, topicId: topic.id } } });
      const firstPass = passed && !prev?.passedAt;
      await tx.quizResult.upsert({
        where: { userId_topicId: { userId, topicId: topic.id } },
        create: { userId, topicId: topic.id, bestScore: score, total, passedAt: passed ? now : null },
        update: { bestScore: Math.max(prev?.bestScore ?? 0, score), total, attempts: { increment: 1 }, ...(firstPass ? { passedAt: now } : {}) },
      });
      if (firstPass) await tx.activity.create({ data: { userId, type: "quiz_pass" } });
      return accepted({ score, total, passed, firstPass });
    },
  }),

  "solve.external": handler({
    ...plain(z.object({ problemId: idField, solved: z.boolean() }).strict()),
    apply: async (tx, userId, p: { problemId: string; solved: boolean }) => {
      const problem = await tx.problem.findFirst({ where: { id: p.problemId, status: "PUBLISHED" }, select: { id: true, kind: true } });
      if (!problem) return reject("unknown_problem");
      // Problems on this site are marked solved only by the judge (POST /submissions), never by a client event.
      if (problem.kind !== "EXTERNAL") return reject("not_applicable");
      if (p.solved) {
        const { count } = await tx.problemSolve.createMany({ data: [{ userId, problemId: problem.id, verification: "SELF_REPORTED" }], skipDuplicates: true });
        if (count > 0) await tx.activity.create({ data: { userId, type: "problem_solved" } });
      } else {
        await tx.problemSolve.deleteMany({ where: { userId, problemId: problem.id } });
      }
      return accepted();
    },
  }),

  "mistake.create": handler<{ id: string; value: MistakeInput }>({
    schema: mistakeCreate,
    prepare: (payload) => {
      const p = mistakeCreate.parse(payload);
      // Same rules as the website, by running the website's own parser on the same fields.
      const form = new FormData();
      for (const k of ["type", "reason", "problemId", "outsideTitle", "outsideUrl", "misunderstood", "correctIdea", "recognizeNextTime"] as const) form.set(k, p[k] ?? "");
      const r = parseMistake(form);
      return r.ok ? { data: { id: p.id, value: r.value } } : { reject: reject("invalid_payload", { message: r.error }) };
    },
    apply: async (tx, userId, p, now) => {
      const v = p.value;
      const problem = v.problemId ? await tx.problem.findFirst({ where: { id: v.problemId, status: "PUBLISHED" }, select: { id: true, kind: true, title: true, externalUrl: true } }) : null;
      if (v.problemId && !problem) return reject("unknown_problem");
      const existing = await tx.mistake.findUnique({ where: { id: p.id }, select: { userId: true } });
      if (existing) return existing.userId === userId ? accepted() : reject("id_conflict");
      await tx.mistake.create({ data: { ...v, id: p.id, userId } });
      const target = revisitTargetFor({ problemId: problem?.id ?? null, problem, outsideTitle: v.outsideTitle, outsideUrl: v.outsideUrl });
      if (target) await scheduleOnTx(tx, userId, target, now);
      return accepted();
    },
  }),

  "mistake.delete": handler({
    ...plain(z.object({ id: idField }).strict()),
    apply: async (tx, userId, p: { id: string }) => {
      await tx.mistake.deleteMany({ where: { id: p.id, userId } }); // owner-scoped: another user's id is a silent no-op
      return accepted();
    },
  }),

  "note.create": handler({
    ...plain(noteCreate),
    apply: async (tx, userId, p: z.infer<typeof noteCreate>) => {
      const existing = await tx.note.findUnique({ where: { id: p.id }, select: { userId: true } });
      if (existing) return existing.userId === userId ? accepted() : reject("id_conflict");
      await tx.note.create({ data: { id: p.id, userId, title: p.title, body: p.body, tags: p.tags } });
      return accepted();
    },
  }),

  "note.delete": handler({
    ...plain(z.object({ id: idField }).strict()),
    apply: async (tx, userId, p: { id: string }) => {
      await tx.note.deleteMany({ where: { id: p.id, userId } });
      return accepted();
    },
  }),

  "revisit.report_outside": handler<{ id: string; note: string }>({
    schema: z.object({ id: idField, note: z.string().max(2000) }).strict(),
    prepare: (payload) => {
      const p = z.object({ id: idField, note: z.string().max(2000) }).strict().parse(payload);
      const note = p.note.trim();
      if (note.length < NOTE_MIN || note.length > NOTE_MAX) return { reject: reject("invalid_payload", { message: `The note needs ${NOTE_MIN}-${NOTE_MAX} characters.` }) };
      return { data: { id: p.id, note } };
    },
    apply: async (tx, userId, p, now) => {
      const r = await tx.revisit.updateMany({ where: { id: p.id, userId, problemId: null, passedAt: null, dueAt: { lte: now } }, data: { passedAt: now, dueAt: null, passedBy: "self", note: p.note } });
      return r.count === 0 ? reject("not_applicable") : accepted();
    },
  }),
};

export const EVENT_TYPES = Object.keys(HANDLERS);

// ---- processing ----
type StoredRow = { payloadHash: string; outcome: unknown };
const asOutcome = (v: unknown): Outcome => v as Outcome;
const fromStored = (stored: StoredRow, hash: string): Outcome => (stored.payloadHash === hash ? asOutcome(stored.outcome) : reject("id_reuse"));
const PENDING = { status: "pending" } as const;

/** One event, one transaction. Returns the final outcome (stored, replayed, or freshly applied). */
export async function processEvent(userId: string, ev: PushEvent, now: Date = new Date()): Promise<Outcome> {
  const payloadHash = sha256Hex(canonicalJson({ type: ev.type, payload: ev.payload ?? null }));

  // A stored event (duplicate or id reuse) is answered before any validation, so replays never depend on current rules.
  const stored = await db.syncEvent.findUnique({ where: { userId_id: { userId, id: ev.id } }, select: { payloadHash: true, outcome: true } });
  if (stored) return fromStored(stored, payloadHash);

  const h = HANDLERS[ev.type];
  if (!h) return reject("unknown_type");
  if (!validAt(ev.at, now)) return reject("invalid_time");
  let prepared: Prepared<unknown>;
  try { prepared = h.prepare(ev.payload); } catch (e) {
    if (e instanceof z.ZodError) return reject("invalid_payload", { field: e.issues[0]?.path.join(".") ?? "" });
    throw e;
  }
  if ("reject" in prepared) return prepared.reject;

  const data = prepared.data;
  return db.$transaction(async (tx) => {
    // The primary key is the gate: of two concurrent requests with the same event, one inserts and the other waits for
    // it, then inserts nothing and reads the committed outcome. Only the inserting request applies the effect.
    const ins = await tx.syncEvent.createMany({ data: [{ userId, id: ev.id, type: ev.type, payloadHash, outcome: PENDING }], skipDuplicates: true });
    if (ins.count === 0) {
      const again = await tx.syncEvent.findUnique({ where: { userId_id: { userId, id: ev.id } }, select: { payloadHash: true, outcome: true } });
      if (!again) throw new Error("sync event vanished"); // not expected; rolls back and the client retries
      return fromStored(again, payloadHash);
    }
    const outcome = await h.apply(tx, userId, data, now);
    await tx.syncEvent.update({ where: { userId_id: { userId, id: ev.id } }, data: { outcome: outcome as unknown as Prisma.InputJsonValue } });
    return outcome;
  });
}

export type PushResult = { accepted: string[]; rejected: { id: string; reason: string }[]; results: Record<string, Record<string, unknown>> };

export async function processEvents(userId: string, events: PushEvent[]): Promise<PushResult> {
  const out: PushResult = { accepted: [], rejected: [], results: {} };
  const seen = new Set<string>();
  let processed = 0;
  for (const ev of events) {
    let o: Outcome;
    try {
      o = await processEvent(userId, ev);
    } catch (e) {
      if (processed === 0) throw e; // nothing was acknowledged: report the failure so the client backs off and retries
      console.error("[sync] stopped the batch after an unexpected error:", e instanceof Error ? e.name : typeof e);
      break; // later events may depend on this one, so none of them are attempted
    }
    processed++;
    if (seen.has(ev.id)) {
      // The same id twice in one request. Identical content is reported once. Different content is a client bug: say so.
      if (o.status === "rejected" && o.reason === "id_reuse") out.rejected.push({ id: ev.id, reason: "id_reuse" });
      continue;
    }
    seen.add(ev.id);
    if (o.status === "accepted") {
      out.accepted.push(ev.id);
      if (o.details) out.results[ev.id] = o.details;
    } else {
      out.rejected.push({ id: ev.id, reason: o.reason });
    }
  }
  return out;
}
