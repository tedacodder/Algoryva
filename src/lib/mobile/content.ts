import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { cached } from "@/lib/cache";
import { TOPICS } from "@/lib/curriculum";
import { LESSONS_V2 } from "@/content/lessons-v2";
import type { LessonV2, Section } from "@/content/lesson-types";
import { canonicalJson, sha256Hex } from "@/lib/mobile/canonical";

/**
 * The public content snapshot for the mobile app. It is the same for every caller (it never reads cookies or an
 * Authorization header), so it is safe to cache publicly and to use as an ETag. Everything goes through explicit
 * allowlists, and the assembled result is checked against a strict schema, so an unexpected field fails closed (500)
 * instead of being sent. Hidden tests are never selected from the database, quiz answers and explanations are dropped.
 */

// ---- strict output schema ----
const str = z.string();
const strs = z.array(str);
const o = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

const sectionSchema = z.discriminatedUnion("kind", [
  o({ kind: z.literal("intuition"), id: str, title: str, paras: strs }),
  o({ kind: z.literal("concept"), id: str, title: str, paras: strs, bullets: strs.optional() }),
  o({ kind: z.literal("naive"), id: str, title: str, paras: strs, code: str.optional(), cost: str }),
  o({ kind: z.literal("observation"), id: str, title: str, paras: strs }),
  o({ kind: z.literal("viz"), id: str, title: str, viz: str, paras: strs }),
  o({ kind: z.literal("example"), id: str, title: str, paras: strs, steps: z.array(o({ title: str, body: str })).optional(), table: o({ head: strs, rows: z.array(strs) }).optional() }),
  o({ kind: z.literal("code"), id: str, title: str, paras: strs, code: str, walkthrough: strs, pseudocode: str.optional() }),
  o({ kind: z.literal("complexity"), id: str, title: str, rows: z.array(o({ what: str, time: str, space: str, why: str })), paras: strs.optional() }),
  o({ kind: z.literal("edge"), id: str, title: str, items: z.array(o({ case: str, handle: str })) }),
  o({ kind: z.literal("mistakes"), id: str, title: str, items: z.array(o({ mistake: str, fix: str })) }),
  o({ kind: z.literal("recognize"), id: str, title: str, signals: strs, notThis: strs.optional(), paras: strs.optional() }),
  o({ kind: z.literal("worked"), id: str, title: str, problem: str, approach: strs, code: str, takeaway: str }),
]);

const topicSchema = o({ slug: str, title: str, level: str, prereqs: strs, status: z.enum(["PUBLISHED", "COMING_SOON"]), position: z.number().int() });

const builtinLessonSchema = o({
  topicSlug: str, source: z.literal("builtin"), minutes: z.number(), hook: str, objectives: strs, prereqNote: str.optional(),
  sections: z.array(sectionSchema), cheatSheet: z.array(o({ label: str, value: str })), summary: strs,
  checks: z.array(o({ q: str, options: strs, answer: z.number().int().nonnegative(), why: str, kind: z.enum(["concept", "trace", "recognize", "complexity"]).optional() })),
  nextNote: str.optional(),
});
const customLessonSchema = o({ topicSlug: str, source: z.literal("custom"), markdown: str });

const sampleSchema = o({ input: str, expected: str, explanation: str.nullable() });
const problemSchema = o({
  id: str, slug: str, title: str, kind: z.enum(["INTERNAL", "EXTERNAL"]), difficulty: str, source: str.nullable(), externalUrl: str.nullable(),
  statement: str.nullable(), inputSpec: str.nullable(), outputSpec: str.nullable(), constraints: str.nullable(),
  timeLimitMs: z.number().int().nullable(), memoryLimitMb: z.number().int().nullable(), position: z.number().int(),
  topics: strs, samples: z.array(sampleSchema), testCount: z.number().int().nonnegative(),
});

const bodySchema = o({ topics: z.array(topicSchema), lessons: z.array(z.union([builtinLessonSchema, customLessonSchema])), problems: z.array(problemSchema) });
export const contentSchema = o({ version: str, topics: bodySchema.shape.topics, lessons: bodySchema.shape.lessons, problems: bodySchema.shape.problems });
export type PublicContent = z.infer<typeof contentSchema>;

// ---- sources (what the database query returns; hidden tests are never selected) ----
export type ProblemRow = {
  id: string; slug: string; title: string; kind: "INTERNAL" | "EXTERNAL"; difficulty: string; source: string | null; externalUrl: string | null;
  statement: string | null; inputSpec: string | null; outputSpec: string | null; constraints: string | null;
  timeLimitMs: number | null; memoryLimitMb: number | null; position: number;
  topics: { topic: { slug: string } }[];
  testCases: { input: string; expected: string; explanation: string | null; isSample: boolean }[];
  _count: { testCases: number };
};
export type CustomLessonRow = { topic: { slug: string }; sections: { body: string }[] };
export type ContentSources = { problems: ProblemRow[]; customLessons: CustomLessonRow[] };

/** Only PUBLISHED rows, only sample test cases, and only the columns listed here. */
export async function loadContentSources(): Promise<ContentSources> {
  const [problems, customLessons] = await Promise.all([
    db.problem.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ position: "asc" }, { slug: "asc" }],
      select: {
        id: true, slug: true, title: true, kind: true, difficulty: true, source: true, externalUrl: true, statement: true,
        inputSpec: true, outputSpec: true, constraints: true, timeLimitMs: true, memoryLimitMb: true, position: true,
        topics: { select: { topic: { select: { slug: true } } } },
        testCases: { where: { isSample: true }, orderBy: { id: "asc" }, select: { input: true, expected: true, explanation: true, isSample: true } },
        _count: { select: { testCases: true } },
      },
    }),
    db.lesson.findMany({
      where: { slug: "main", status: "PUBLISHED" },
      select: { topic: { select: { slug: true } }, sections: { orderBy: { position: "asc" }, take: 1, select: { body: true } } },
    }),
  ]);
  return { problems, customLessons };
}

// ---- allowlisted serializers ----
const SECTION_KEYS: Record<Section["kind"], string[]> = {
  intuition: ["kind", "id", "title", "paras"], concept: ["kind", "id", "title", "paras", "bullets"],
  naive: ["kind", "id", "title", "paras", "code", "cost"], observation: ["kind", "id", "title", "paras"],
  viz: ["kind", "id", "title", "viz", "paras"], example: ["kind", "id", "title", "paras", "steps", "table"],
  code: ["kind", "id", "title", "paras", "code", "walkthrough", "pseudocode"], complexity: ["kind", "id", "title", "rows", "paras"],
  edge: ["kind", "id", "title", "items"], mistakes: ["kind", "id", "title", "items"],
  recognize: ["kind", "id", "title", "signals", "notThis", "paras"], worked: ["kind", "id", "title", "problem", "approach", "code", "takeaway"],
};
function publicSection(s: Section): Record<string, unknown> {
  const src = s as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of SECTION_KEYS[s.kind] ?? []) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

/** Built-in lesson with its quiz questions (answers and explanations included). Hidden test data is never part of a lesson. */
export function publicBuiltinLesson(topicSlug: string, l: LessonV2) {
  return {
    topicSlug, source: "builtin" as const, minutes: l.minutes, hook: l.hook, objectives: l.objectives,
    ...(l.prereqNote !== undefined ? { prereqNote: l.prereqNote } : {}),
    sections: l.sections.map(publicSection),
    cheatSheet: l.cheatSheet.map((c) => ({ label: c.label, value: c.value })),
    summary: l.summary,
    // Answers and explanations are published, as on the website, so the app can score a quiz offline. The server re-scores
    // every submission (quiz.submit) and is the record of truth.
    checks: l.checks.map((c) => ({ q: c.q, options: c.options, answer: c.answer, why: c.why, ...(c.kind !== undefined ? { kind: c.kind } : {}) })),
    ...(l.nextNote !== undefined ? { nextNote: l.nextNote } : {}),
  };
}

export function publicProblem(p: ProblemRow) {
  return {
    id: p.id, slug: p.slug, title: p.title, kind: p.kind, difficulty: p.difficulty,
    source: p.source ?? null, externalUrl: p.externalUrl ?? null, statement: p.statement ?? null,
    inputSpec: p.inputSpec ?? null, outputSpec: p.outputSpec ?? null, constraints: p.constraints ?? null,
    timeLimitMs: p.timeLimitMs ?? null, memoryLimitMb: p.memoryLimitMb ?? null, position: p.position,
    topics: p.topics.map((t) => t.topic.slug).sort(),
    // Defence in depth: even if a query returned hidden tests, only rows flagged as samples are copied.
    samples: p.testCases.filter((t) => t.isSample === true).map((t) => ({ input: t.input, expected: t.expected, explanation: t.explanation ?? null })),
    testCount: p._count.testCases,
  };
}

/** Assembles and validates the public content. `version` is a hash of the body, so it changes exactly when the content does. */
export function buildContent(src: ContentSources): { body: string; etag: string; version: string } {
  const customBySlug = new Map(src.customLessons.filter((l) => l.sections[0]).map((l) => [l.topic.slug, l.sections[0].body]));
  const topics = TOPICS.map((t, position) => ({ slug: t.slug, title: t.title, level: t.level, prereqs: [...t.prereqs], status: t.status, position }));
  const lessons = TOPICS.flatMap((t): unknown[] => {
    // As on the website, a published custom lesson replaces the built-in text for its topic.
    const custom = customBySlug.get(t.slug);
    if (custom !== undefined) return [{ topicSlug: t.slug, source: "custom" as const, markdown: custom }];
    const builtin = LESSONS_V2[t.slug];
    return builtin ? [publicBuiltinLesson(t.slug, builtin)] : [];
  });
  const problems = src.problems.map(publicProblem);
  const parts = bodySchema.safeParse({ topics, lessons, problems });
  if (!parts.success) {
    // Paths only, never values: a failure here may involve content that must not be logged.
    console.error("[content] serializer output rejected at", parts.error.issues.slice(0, 3).map((i) => i.path.join(".")));
    throw new Error("content serializer rejected its own output");
  }
  const version = sha256Hex(canonicalJson(parts.data)).slice(0, 16);
  const full = contentSchema.parse({ version, ...parts.data });
  return { body: JSON.stringify(full), etag: `"${version}"`, version };
}

const FIVE_MINUTES = 300;
export const getContent = async () => buildContent(await cached<ContentSources>("mobile-content", FIVE_MINUTES, loadContentSources));

/** True when an If-None-Match header names this ETag (weak validators allowed, `*` matches any current representation). */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").map((s) => s.trim().replace(/^W\//, "")).some((t) => t === "*" || t === etag);
}
