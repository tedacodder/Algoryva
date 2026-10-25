import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { ev, seedBasics, topicId } from "@/lib/test-support/seed";
import { LESSONS_V2 } from "@/content/lessons-v2";
import { processEvent, processEvents, pushSchema, validAt } from "@/lib/mobile/events";

const U = "u1";
const count = (t: string) => db.rows(t).length;
const completeEv = (slug: string, id?: string) => ev("topic.complete", { slug }, id);
async function complete(...slugs: string[]) { for (const s of slugs) await processEvent(U, completeEv(s)); }

beforeEach(() => { db.reset(); seedBasics(db, [U, "u2"]); });

describe("envelope and stateless validation", () => {
  it("accepts 1-50 events with uuid ids and rejects the rest at the envelope", () => {
    const one = ev("note.delete", { id: "x" });
    expect(pushSchema.safeParse({ events: [one] }).success).toBe(true);
    expect(pushSchema.safeParse({ events: [] }).success).toBe(false);
    expect(pushSchema.safeParse({ events: Array.from({ length: 51 }, () => ev("note.delete", { id: "x" })) }).success).toBe(false);
    expect(pushSchema.safeParse({ events: [{ ...one, id: "not-a-uuid" }] }).success).toBe(false);
    expect(pushSchema.safeParse({ events: [{ ...one, extra: 1 }] }).success).toBe(false);
    expect(pushSchema.safeParse({ events: [one], more: 1 }).success).toBe(false);
  });

  it("rejects unknown types, bad payloads and absurd times, and does not store those (replay answers the same)", async () => {
    expect(await processEvent(U, ev("nope", {}))).toEqual({ status: "rejected", reason: "unknown_type" });
    expect(await processEvent(U, ev("topic.complete", { slug: "python-basics", extra: 1 }))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("topic.complete", undefined))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("topic.complete", { slug: "python-basics" }, undefined, "yesterday"))).toEqual({ status: "rejected", reason: "invalid_time" });
    expect(await processEvent(U, ev("topic.complete", { slug: "python-basics" }, undefined, "2019-12-31T00:00:00Z"))).toMatchObject({ reason: "invalid_time" });
    expect(await processEvent(U, ev("topic.complete", { slug: "python-basics" }, undefined, new Date(Date.now() + 3 * 86_400_000).toISOString()))).toMatchObject({ reason: "invalid_time" });
    expect(count("syncEvent")).toBe(0);
    expect(count("topicProgress")).toBe(0);
  });

  it("validAt is generous about clock skew but needs an ISO time with an offset", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    expect(validAt("2026-10-18T14:00:00+02:00", now)).toBe(true);
    expect(validAt("2026-10-18T11:00:00.123Z", now)).toBe(true);
    expect(validAt("2026-10-18T12:00:00", now)).toBe(false);
    expect(validAt("2026-10-19T13:00:00Z", now)).toBe(false);
  });
});

describe("topic.complete", () => {
  it("applies the website's rules and records progress, a review item and activity", async () => {
    expect(await processEvent(U, completeEv("lists-tuples"))).toMatchObject({ status: "rejected", reason: "prerequisites_missing" });
    expect(await processEvent(U, completeEv("python-basics"))).toEqual({ status: "accepted" });
    expect(await processEvent(U, completeEv("lists-tuples"))).toEqual({ status: "accepted" });
    expect(db.rows("topicProgress").map((r) => r.topicId).sort()).toEqual([topicId("lists-tuples"), topicId("python-basics")]);
    expect(count("reviewItem")).toBe(2);
    expect(db.rows("activity").every((a) => a.type === "topic_complete")).toBe(true);
    expect(await processEvent(U, completeEv("no-such-topic"))).toMatchObject({ reason: "unknown_topic" });
  });

  it("uses server time for completion, not the client's `at`", async () => {
    await processEvent(U, ev("topic.complete", { slug: "python-basics" }, undefined, "2021-01-01T00:00:00Z"));
    const done = db.rows("topicProgress")[0].completedAt as Date;
    expect(Date.now() - done.getTime()).toBeLessThan(5_000);
  });

  it("a rejected prerequisite outcome is stored, so the replay returns the same rejection", async () => {
    const id = crypto.randomUUID();
    const first = await processEvent(U, completeEv("lists-tuples", id));
    await processEvent(U, completeEv("python-basics"));
    const again = await processEvent(U, completeEv("lists-tuples", id));
    expect(again).toEqual(first);
    expect(count("topicProgress")).toBe(1);
  });
});

describe("idempotency", () => {
  it("a duplicate event returns its original outcome and applies nothing again", async () => {
    await complete("python-basics");
    const id = crypto.randomUUID();
    const first = await processEvent(U, ev("topic.review", { slug: "python-basics", rating: "good" }, id));
    db.rows("reviewItem")[0].dueAt = new Date(Date.now() - 1000); // due again: without idempotency a replay would advance again
    const stepBefore = db.rows("reviewItem")[0].step;
    const activities = count("activity");
    const again = await processEvent(U, ev("topic.review", { slug: "python-basics", rating: "good" }, id));
    expect(again).toEqual(first);
    expect(db.rows("reviewItem")[0].step).toBe(stepBefore);
    expect(count("activity")).toBe(activities);
  });

  it("two concurrent copies of one event apply the effect once", async () => {
    await complete("python-basics");
    db.rows("reviewItem")[0].dueAt = new Date(Date.now() - 1000);
    const e = ev("topic.review", { slug: "python-basics", rating: "good" });
    const [a, b] = await Promise.all([processEvent(U, e), processEvent(U, e)]);
    expect(a).toEqual({ status: "accepted" });
    expect(b).toEqual({ status: "accepted" });
    expect(db.rows("reviewItem")[0].step).toBe(1);
    expect(db.rows("activity").filter((r) => r.type === "review")).toHaveLength(1);
    expect(count("syncEvent")).toBe(2); // the completion and the review
  });

  it("the same id with different content is a conflict and never returns another event's outcome", async () => {
    const id = crypto.randomUUID();
    await processEvent(U, completeEv("python-basics", id));
    expect(await processEvent(U, ev("topic.complete", { slug: "sets-dicts" }, id))).toEqual({ status: "rejected", reason: "id_reuse" });
    expect(await processEvent(U, ev("note.delete", { id: "n" }, id))).toEqual({ status: "rejected", reason: "id_reuse" });
    expect(count("topicProgress")).toBe(1);
  });

  it("is scoped to the user: the same event id from two users is two independent events", async () => {
    const id = crypto.randomUUID();
    expect(await processEvent(U, completeEv("python-basics", id))).toEqual({ status: "accepted" });
    expect(await processEvent("u2", completeEv("python-basics", id))).toEqual({ status: "accepted" });
    expect(db.rows("topicProgress").map((r) => r.userId).sort()).toEqual([U, "u2"]);
  });

  it("key order in the payload does not make a retry look like a different event", async () => {
    const id = crypto.randomUUID();
    await processEvent(U, ev("topic.review", { slug: "python-basics", rating: "good" }, id));
    expect(await processEvent(U, ev("topic.review", { rating: "good", slug: "python-basics" }, id))).not.toEqual({ status: "rejected", reason: "id_reuse" });
  });
});

describe("transactions and failures", () => {
  it("an unexpected error rolls back the event and its idempotency row, so a retry applies it cleanly", async () => {
    const id = crypto.randomUUID();
    db.failNext("activity.create");
    await expect(processEvent(U, completeEv("python-basics", id))).rejects.toThrow("injected failure");
    expect(count("syncEvent")).toBe(0);
    expect(count("topicProgress")).toBe(0);
    expect(count("reviewItem")).toBe(0);
    expect(await processEvent(U, completeEv("python-basics", id))).toEqual({ status: "accepted" });
    expect(count("topicProgress")).toBe(1);
  });

  it("partial results: an infrastructure failure after some events returns those events and omits the rest", async () => {
    const events = [completeEv("python-basics"), completeEv("sets-dicts"), completeEv("lists-tuples")];
    // Allow the first event's reviewItem.upsert, fail the second's: count calls with a wrapper.
    const original = db.reviewItem.upsert.bind(db.reviewItem);
    let calls = 0;
    db.reviewItem.upsert = (async (a: Parameters<typeof original>[0]) => { if (++calls === 2) throw new Error("injected failure: second event"); return original(a); }) as typeof original;
    const r = await processEvents(U, events);
    expect(r.accepted).toEqual([events[0].id]);
    expect(r.rejected).toEqual([]);
    expect(db.rows("syncEvent").map((e) => e.id)).toEqual([events[0].id]); // 2nd rolled back, 3rd never tried
    expect(count("topicProgress")).toBe(1);
  });

  it("the first event failing throws, so the route can answer 500 and the client backs off", async () => {
    db.failNext("topic.findUnique", 1);
    await expect(processEvents(U, [completeEv("python-basics")])).rejects.toThrow();
  });

  it("applies events in array order inside one request", async () => {
    const r = await processEvents(U, [completeEv("python-basics"), completeEv("lists-tuples"), completeEv("arrays")]);
    expect(r.accepted).toHaveLength(2); // arrays also needs complexity
    expect(r.rejected).toEqual([{ id: expect.any(String), reason: "prerequisites_missing" }]);
  });

  it("the same id twice in one request is reported once; with different content the second is an id_reuse rejection", async () => {
    const id = crypto.randomUUID();
    const same = await processEvents(U, [completeEv("python-basics", id), completeEv("python-basics", id)]);
    expect(same.accepted).toEqual([id]);
    const id2 = crypto.randomUUID();
    const diff = await processEvents(U, [completeEv("sets-dicts", id2), completeEv("lists-tuples", id2)]);
    expect(diff.accepted).toEqual([id2]);
    expect(diff.rejected).toEqual([{ id: id2, reason: "id_reuse" }]);
    expect(count("topicProgress")).toBe(2);
  });
});

describe("topic.review", () => {
  it("needs an existing, due item, and good advances while again resets", async () => {
    expect(await processEvent(U, ev("topic.review", { slug: "python-basics", rating: "good" }))).toMatchObject({ reason: "not_applicable" });
    await complete("python-basics");
    expect(await processEvent(U, ev("topic.review", { slug: "python-basics", rating: "good" }))).toMatchObject({ reason: "not_due" });
    db.rows("reviewItem")[0].dueAt = new Date(Date.now() - 1000);
    expect(await processEvent(U, ev("topic.review", { slug: "python-basics", rating: "good" }))).toEqual({ status: "accepted" });
    expect(db.rows("reviewItem")[0].step).toBe(1);
    expect((db.rows("reviewItem")[0].dueAt as Date).getTime()).toBeGreaterThan(Date.now());
    db.rows("reviewItem")[0].dueAt = new Date(Date.now() - 1000);
    await processEvent(U, ev("topic.review", { slug: "python-basics", rating: "again" }));
    expect(db.rows("reviewItem")[0].step).toBe(0);
  });

  it("two devices rating the same due item: the second is not_due and nothing advances twice", async () => {
    await complete("python-basics");
    db.rows("reviewItem")[0].dueAt = new Date(Date.now() - 1000);
    const a = await processEvent(U, ev("topic.review", { slug: "python-basics", rating: "good" }));
    const b = await processEvent(U, ev("topic.review", { slug: "python-basics", rating: "good" }));
    expect(a.status).toBe("accepted");
    expect(b).toMatchObject({ status: "rejected", reason: "not_due" });
    expect(db.rows("reviewItem")[0].step).toBe(1);
  });
});

describe("quiz.submit", () => {
  const slug = Object.keys(LESSONS_V2)[0];
  const lesson = LESSONS_V2[slug];
  const right = lesson.checks.map((c) => c.answer);
  const wrong = lesson.checks.map((c) => (c.answer + 1) % c.options.length);

  it("scores on the server from the lesson data", async () => {
    expect(await processEvent(U, ev("quiz.submit", { slug, answers: [0] }))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("quiz.submit", { slug: "no-such", answers: [0] }))).toMatchObject({ reason: "not_applicable" });
    const r = await processEvent(U, ev("quiz.submit", { slug, answers: right }));
    expect(r).toEqual({ status: "accepted", details: { score: lesson.checks.length, total: lesson.checks.length, passed: true, firstPass: true } });
    expect(db.rows("quizResult")[0]).toMatchObject({ bestScore: lesson.checks.length, attempts: 1 });
    expect(db.rows("activity").filter((a) => a.type === "quiz_pass")).toHaveLength(1);
  });

  it("keeps the best score, counts attempts, and awards the pass activity once; a replay adds no attempt", async () => {
    await processEvent(U, ev("quiz.submit", { slug, answers: right }));
    const id = crypto.randomUUID();
    await processEvent(U, ev("quiz.submit", { slug, answers: wrong }, id));
    await processEvent(U, ev("quiz.submit", { slug, answers: wrong }, id)); // retry
    const q = db.rows("quizResult")[0];
    expect(q.bestScore).toBe(lesson.checks.length);
    expect(q.attempts).toBe(2);
    expect(db.rows("activity").filter((a) => a.type === "quiz_pass")).toHaveLength(1);
  });

  it("the quiz result is not influenced by a client-claimed score", async () => {
    const r = await processEvent(U, ev("quiz.submit", { slug, answers: wrong, score: 99 }));
    expect(r).toMatchObject({ reason: "invalid_payload" }); // strict payload: unknown field
  });
});

describe("solve.external", () => {
  beforeEach(() => {
    db.seed("problem", [
      { id: "ext1", slug: "ext1", kind: "EXTERNAL", status: "PUBLISHED" },
      { id: "int1", slug: "int1", kind: "INTERNAL", status: "PUBLISHED" },
      { id: "draft1", slug: "draft1", kind: "EXTERNAL", status: "DRAFT" },
    ]);
  });
  it("marks and unmarks external problems only", async () => {
    expect(await processEvent(U, ev("solve.external", { problemId: "int1", solved: true }))).toMatchObject({ reason: "not_applicable" });
    expect(await processEvent(U, ev("solve.external", { problemId: "nope", solved: true }))).toMatchObject({ reason: "unknown_problem" });
    expect(await processEvent(U, ev("solve.external", { problemId: "draft1", solved: true }))).toMatchObject({ reason: "unknown_problem" });
    expect(await processEvent(U, ev("solve.external", { problemId: "ext1", solved: true }))).toEqual({ status: "accepted" });
    await processEvent(U, ev("solve.external", { problemId: "ext1", solved: true })); // set again: no second award
    expect(count("problemSolve")).toBe(1);
    expect(db.rows("activity").filter((a) => a.type === "problem_solved")).toHaveLength(1);
    await processEvent(U, ev("solve.external", { problemId: "ext1", solved: false }));
    expect(count("problemSolve")).toBe(0);
  });
  it("is last-arrival-wins between devices", async () => {
    await processEvent(U, ev("solve.external", { problemId: "ext1", solved: false }));
    await processEvent(U, ev("solve.external", { problemId: "ext1", solved: true }));
    expect(count("problemSolve")).toBe(1);
  });
  it("can never mark a judge-graded problem solved, whatever the client sends", async () => {
    await processEvent(U, ev("solve.external", { problemId: "int1", solved: true }));
    expect(count("problemSolve")).toBe(0);
  });
});

describe("mistakes", () => {
  const base = { type: "CONCEPTUAL", misunderstood: "I mixed up the base case", correctIdea: "Check the empty input first", recognizeNextTime: "Whenever recursion appears" };
  beforeEach(() => { db.seed("problem", [{ id: "int1", slug: "int1", kind: "INTERNAL", status: "PUBLISHED", title: "Sum", externalUrl: null }]); });

  it("uses the website's own parser for the rules", async () => {
    const id = crypto.randomUUID();
    expect(await processEvent(U, ev("mistake.create", { id, ...base, type: "WHATEVER" }))).toMatchObject({ reason: "invalid_payload", details: { message: "Choose a mistake type." } });
    expect(await processEvent(U, ev("mistake.create", { id, ...base, misunderstood: "x" }))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("mistake.create", { id, ...base, outsideUrl: "http://insecure.example" , outsideTitle: "T!" }))).toMatchObject({ reason: "invalid_payload" });
    expect(count("mistake")).toBe(0);
  });

  it("creates the mistake with the client's id and schedules the same revisit as the website", async () => {
    const id = crypto.randomUUID();
    expect(await processEvent(U, ev("mistake.create", { id, ...base, problemId: "int1" }))).toEqual({ status: "accepted" });
    expect(db.rows("mistake")[0]).toMatchObject({ id, userId: U, problemId: "int1" });
    expect(db.rows("revisit")[0]).toMatchObject({ userId: U, problemId: "int1", step: 0 });
    const id2 = crypto.randomUUID();
    await processEvent(U, ev("mistake.create", { id: id2, ...base, outsideTitle: "Two Sum", outsideUrl: "https://example.com/two-sum" }));
    expect(db.rows("revisit")).toHaveLength(2);
    expect(db.rows("revisit")[1]).toMatchObject({ outsideTitle: "Two Sum", problemId: null });
  });

  it("rejects an unknown problem, and an id owned by another user", async () => {
    expect(await processEvent(U, ev("mistake.create", { id: crypto.randomUUID(), ...base, problemId: "nope" }))).toMatchObject({ reason: "unknown_problem" });
    const id = crypto.randomUUID();
    db.seed("mistake", [{ id, userId: "u2" }]);
    expect(await processEvent(U, ev("mistake.create", { id, ...base }))).toMatchObject({ reason: "id_conflict" });
    expect(db.rows("mistake")).toHaveLength(1);
  });

  it("delete is owner-scoped: another user's id is a no-op", async () => {
    db.seed("mistake", [{ id: "m-other", userId: "u2" }, { id: "m-mine", userId: U }]);
    expect(await processEvent(U, ev("mistake.delete", { id: "m-other" }))).toEqual({ status: "accepted" });
    await processEvent(U, ev("mistake.delete", { id: "m-mine" }));
    expect(db.rows("mistake").map((m) => m.id)).toEqual(["m-other"]);
  });
});

describe("notes", () => {
  it("applies the website's bounds and normalises tags", async () => {
    const id = crypto.randomUUID();
    expect(await processEvent(U, ev("note.create", { id, title: " ", body: "b", tags: [] }))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("note.create", { id, title: "t", body: "", tags: [] }))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("note.create", { id, title: "t", body: "b", tags: ["a", "b", "c", "d", "e", "f"] }))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("note.create", { id, title: "t", body: "b", tags: ["Bad Tag"] }))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("note.create", { id, title: "x".repeat(121), body: "b", tags: [] }))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("note.create", { id, title: " Heap ", body: " body ", tags: ["DP", "dp", " graphs "] }))).toEqual({ status: "accepted" });
    expect(db.rows("note")[0]).toMatchObject({ id, userId: U, title: "Heap", body: "body", tags: ["dp", "graphs"] });
  });

  it("an id owned by another user is a conflict, and delete cannot touch it", async () => {
    db.seed("note", [{ id: "n-other", userId: "u2", title: "t", body: "b", tags: [] }]);
    expect(await processEvent(U, ev("note.create", { id: "00000000-0000-4000-8000-000000000001", title: "t", body: "b", tags: [] }))).toEqual({ status: "accepted" });
    expect(await processEvent(U, ev("note.delete", { id: "n-other" }))).toEqual({ status: "accepted" });
    expect(db.rows("note").map((n) => n.id)).toContain("n-other");
    db.seed("note", [{ id: "11111111-1111-4111-8111-111111111111", userId: "u2", title: "t", body: "b", tags: [] }]);
    expect(await processEvent(U, ev("note.create", { id: "11111111-1111-4111-8111-111111111111", title: "t", body: "b", tags: [] }))).toMatchObject({ reason: "id_conflict" });
  });

  it("a replayed create after a delete does not resurrect the note", async () => {
    const id = crypto.randomUUID();
    const createId = crypto.randomUUID();
    await processEvent(U, ev("note.create", { id, title: "t", body: "b", tags: [] }, createId));
    await processEvent(U, ev("note.delete", { id }));
    await processEvent(U, ev("note.create", { id, title: "t", body: "b", tags: [] }, createId)); // delayed retry of the original create
    expect(count("note")).toBe(0);
  });
});

describe("revisit.report_outside", () => {
  const due = () => ({ id: "r1", userId: U, problemId: null, outsideKey: "k", outsideTitle: "Two Sum", dueAt: new Date(Date.now() - 1000), step: 0, passedAt: null });
  const note = "I solved it using a hash map and one pass.";
  it("passes a due outside revisit as a self-report, only with a real explanation", async () => {
    db.seed("revisit", [due()]);
    expect(await processEvent(U, ev("revisit.report_outside", { id: "r1", note: "short" }))).toMatchObject({ reason: "invalid_payload" });
    expect(await processEvent(U, ev("revisit.report_outside", { id: "r1", note }))).toEqual({ status: "accepted" });
    expect(db.rows("revisit")[0]).toMatchObject({ passedBy: "self", note, dueAt: null });
    expect(await processEvent(U, ev("revisit.report_outside", { id: "r1", note }))).toMatchObject({ reason: "not_applicable" });
  });
  it("is not applicable before it is due, for a site problem, or for another user's revisit", async () => {
    db.seed("revisit", [{ ...due(), id: "future", dueAt: new Date(Date.now() + 86_400_000) }, { ...due(), id: "site", problemId: "p" , outsideKey: null }, { ...due(), id: "theirs", userId: "u2", outsideKey: "z" }]);
    for (const id of ["future", "site", "theirs"]) expect(await processEvent(U, ev("revisit.report_outside", { id, note }))).toMatchObject({ reason: "not_applicable" });
  });
});
