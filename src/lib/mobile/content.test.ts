import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ problemFindMany: vi.fn(), lessonFindMany: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { problem: { findMany: m.problemFindMany }, lesson: { findMany: m.lessonFindMany } } }));
vi.mock("@/lib/cache", () => ({ cached: async (_n: string, _t: number, load: () => Promise<unknown>) => load() }));

import { LESSONS_V2 } from "@/content/lessons-v2";
import { TOPICS } from "@/lib/curriculum";
import { buildContent, etagMatches, getContent, loadContentSources, publicProblem, type ContentSources, type ProblemRow } from "@/lib/mobile/content";

// Canaries: if any of these text values reaches a response, something private leaked.
const HIDDEN_INPUT = "HIDDEN-INPUT-canary-7731";
const HIDDEN_EXPECTED = "HIDDEN-EXPECTED-canary-7731";
const USER_EMAIL = "victim-canary-7731@example.test";
const PASSWORD_HASH = "scrypt$canary7731";
const ADMIN_NOTE = "ADMIN-ONLY-canary-7731";

const problem = (over: Partial<ProblemRow> = {}): ProblemRow => ({
  id: "p1", slug: "two-sum", title: "Two Sum", kind: "INTERNAL", difficulty: "EASY", source: null, externalUrl: null, statement: "Add two numbers.",
  inputSpec: "two ints", outputSpec: "their sum", constraints: "small", timeLimitMs: 1000, memoryLimitMb: 256, position: 1,
  topics: [{ topic: { slug: "arrays" } }, { topic: { slug: "python-basics" } }],
  testCases: [{ input: "1 2", expected: "3", explanation: "1+2", isSample: true }],
  _count: { testCases: 3 },
  ...over,
});
const src = (over: Partial<ContentSources> = {}): ContentSources => ({ problems: [problem()], customLessons: [], ...over });
const parse = (s: ContentSources) => JSON.parse(buildContent(s).body);

beforeEach(() => { m.problemFindMany.mockReset(); m.lessonFindMany.mockReset(); });

describe("what the database is asked for", () => {
  it("selects only PUBLISHED problems and lessons, only sample test cases, and only named columns", async () => {
    m.problemFindMany.mockResolvedValue([]); m.lessonFindMany.mockResolvedValue([]);
    await loadContentSources();
    const q = m.problemFindMany.mock.calls[0][0];
    expect(q.where).toEqual({ status: "PUBLISHED" });
    expect(q.select.testCases.where).toEqual({ isSample: true });
    expect(q.select._count).toEqual({ select: { testCases: true } });
    expect(q.include).toBeUndefined();
    expect(Object.keys(q.select)).not.toEqual(expect.arrayContaining(["status", "createdAt", "updatedAt", "submissions", "mistakes", "solves", "revisits", "normalizedUrl"]));
    const l = m.lessonFindMany.mock.calls[0][0];
    expect(l.where).toEqual({ slug: "main", status: "PUBLISHED" });
    expect(l.include).toBeUndefined();
  });
});

describe("hidden tests, drafts and private data never reach the response", () => {
  it("copies only sample test cases, even when the query result contains hidden ones", () => {
    const leaky = problem({
      testCases: [
        { input: "1 2", expected: "3", explanation: null, isSample: true },
        { input: HIDDEN_INPUT, expected: HIDDEN_EXPECTED, explanation: "hidden", isSample: false },
      ],
    });
    const body = buildContent(src({ problems: [leaky] })).body;
    expect(body).not.toContain(HIDDEN_INPUT);
    expect(body).not.toContain(HIDDEN_EXPECTED);
    expect(JSON.parse(body).problems[0].samples).toEqual([{ input: "1 2", expected: "3", explanation: null }]);
    expect(JSON.parse(body).problems[0].testCount).toBe(3); // a count only
  });

  it("drops unexpected columns on problem rows (user data, server-only and admin fields)", () => {
    const extra = { ...problem(), email: USER_EMAIL, passwordHash: PASSWORD_HASH, adminNotes: ADMIN_NOTE, status: "PUBLISHED", normalizedUrl: ADMIN_NOTE, createdAt: new Date(), user: { email: USER_EMAIL } } as unknown as ProblemRow;
    const body = buildContent(src({ problems: [extra] })).body;
    for (const c of [USER_EMAIL, PASSWORD_HASH, ADMIN_NOTE]) expect(body).not.toContain(c);
    expect(Object.keys(JSON.parse(body).problems[0]).sort()).toEqual(["constraints", "difficulty", "externalUrl", "id", "inputSpec", "kind", "memoryLimitMb", "outputSpec", "position", "samples", "slug", "source", "statement", "testCount", "timeLimitMs", "title", "topics"]);
  });

  it("drops unexpected fields on custom-lesson rows", () => {
    const row = { topic: { slug: "arrays" }, sections: [{ body: "# Custom arrays", language: "python", secret: ADMIN_NOTE }], authorEmail: USER_EMAIL } as unknown as ContentSources["customLessons"][number];
    const body = buildContent(src({ customLessons: [row] })).body;
    expect(body).not.toContain(ADMIN_NOTE);
    expect(body).not.toContain(USER_EMAIL);
  });

  it("a hostile draft is excluded by the query, and an unexpected field inside a built-in lesson is dropped or fails closed", () => {
    // (Drafts are excluded by `where: { status: "PUBLISHED" }`, asserted above. Here: the allowlist and the strict schema.)
    const slug = Object.keys(LESSONS_V2)[0];
    const orig = LESSONS_V2[slug];
    try {
      LESSONS_V2[slug] = { ...orig, secretTopLevel: ADMIN_NOTE, sections: orig.sections.map((s) => ({ ...s, secretSection: ADMIN_NOTE })) } as unknown as typeof orig;
      expect(buildContent(src()).body).not.toContain(ADMIN_NOTE); // top-level and section-level extras are not copied
      const nested = orig.sections.map((s) => (s.kind === "example" ? { ...s, steps: [{ title: "t", body: "b", secret: ADMIN_NOTE }] } : s));
      if (!orig.sections.some((s) => s.kind === "example")) throw new Error("fixture lesson has no example section");
      LESSONS_V2[slug] = { ...orig, sections: nested } as unknown as typeof orig;
      expect(() => buildContent(src())).toThrow("content serializer rejected"); // nested extras fail closed instead of being sent
    } finally { LESSONS_V2[slug] = orig; }
  });
});

describe("quiz answers and explanations", () => {
  it("are stripped from every built-in lesson", () => {
    const body = parse(src());
    const lessons = body.lessons.filter((l: { source: string }) => l.source === "builtin");
    expect(lessons.length).toBe(Object.keys(LESSONS_V2).length);
    for (const l of lessons) for (const c of l.checks) expect(Object.keys(c).sort()).toEqual(c.kind ? ["kind", "options", "q"] : ["options", "q"]);
    // `why` is a legitimate key in complexity tables, so check structure instead of searching the text:
    // no object anywhere has an `answer` key, and no quiz question has `why`.
    const walk = (v: unknown, path: string): string[] => (Array.isArray(v) ? v.flatMap((x, i) => walk(x, `${path}[${i}]`)) : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [...(k === "answer" ? [`${path}.answer`] : []), ...walk(x, `${path}.${k}`)]) : []);
    expect(walk(body, "$")).toEqual([]);
  });
  it("covers every question, and the strict schema accepts all real lessons and sections", () => {
    const body = parse(src());
    const questions = body.lessons.reduce((n: number, l: { checks?: unknown[] }) => n + (l.checks?.length ?? 0), 0);
    expect(questions).toBe(Object.values(LESSONS_V2).reduce((n, l) => n + l.checks.length, 0));
    expect(body.topics).toHaveLength(TOPICS.length);
  });
});

describe("custom lessons", () => {
  it("a published custom lesson replaces the built-in text for its topic, as on the website", () => {
    const body = parse(src({ customLessons: [{ topic: { slug: "arrays" }, sections: [{ body: "# My arrays lesson" }] }] }));
    const arrays = body.lessons.filter((l: { topicSlug: string }) => l.topicSlug === "arrays");
    expect(arrays).toEqual([{ topicSlug: "arrays", source: "custom", markdown: "# My arrays lesson" }]);
    expect(body.lessons.filter((l: { topicSlug: string }) => l.topicSlug === "sorting-basics")[0].source).toBe("builtin");
  });
  it("a custom lesson without a section does not replace the built-in one; unknown topics are ignored", () => {
    const body = parse(src({ customLessons: [{ topic: { slug: "arrays" }, sections: [] }, { topic: { slug: "not-a-topic" }, sections: [{ body: "x" }] }] }));
    expect(body.lessons.find((l: { topicSlug: string }) => l.topicSlug === "arrays").source).toBe("builtin");
    expect(JSON.stringify(body)).not.toContain("not-a-topic");
  });
});

describe("problems", () => {
  it("keeps EXTERNAL problems without a statement, and sorts topic slugs", () => {
    const p = publicProblem(problem({ kind: "EXTERNAL", statement: null, source: "codeforces", externalUrl: "https://codeforces.com/x", testCases: [], _count: { testCases: 0 } }));
    expect(p).toMatchObject({ kind: "EXTERNAL", statement: null, samples: [], testCount: 0, topics: ["arrays", "python-basics"] });
  });
});

describe("version and ETag", () => {
  it("are derived from the body only: stable for equal content, different when content differs", () => {
    const a = buildContent(src()), b = buildContent(src());
    expect(a).toEqual(b);
    expect(a.etag).toBe(`"${a.version}"`);
    expect(buildContent(src({ problems: [problem({ title: "Two Sum!" })] })).etag).not.toBe(a.etag);
    expect(buildContent(src({ customLessons: [{ topic: { slug: "arrays" }, sections: [{ body: "x" }] }] })).etag).not.toBe(a.etag);
  });
  it("etagMatches handles lists, weak validators and *", () => {
    expect(etagMatches('"abc"', '"abc"')).toBe(true);
    expect(etagMatches('W/"abc"', '"abc"')).toBe(true);
    expect(etagMatches('"zzz", "abc"', '"abc"')).toBe(true);
    expect(etagMatches("*", '"abc"')).toBe(true);
    expect(etagMatches('"abd"', '"abc"')).toBe(false);
    expect(etagMatches(null, '"abc"')).toBe(false);
  });
  it("getContent is user-independent: it needs no request context at all", async () => {
    m.problemFindMany.mockResolvedValue([problem()]); m.lessonFindMany.mockResolvedValue([]);
    const a = await getContent(); const b = await getContent();
    expect(a.etag).toBe(b.etag);
  });
});
