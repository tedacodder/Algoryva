import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { seedBasics, topicId } from "@/lib/test-support/seed";
import { MISTAKES_PER_PAGE, NOTES_PER_PAGE, decodePageToken, encodePageToken, pull, readSnapshot } from "@/lib/mobile/pull";
import { ApiError } from "@/lib/api/errors";

const U = "u1";
const D = (s: string) => new Date(s);
const note = (id: string, extra: Record<string, unknown> = {}) => ({ id, userId: U, title: `t${id}`, body: `body ${id}`, tags: ["a"], createdAt: D("2026-01-01T00:00:00Z"), ...extra });
const mistake = (id: string, extra: Record<string, unknown> = {}) => ({ id, userId: U, problemId: null, outsideTitle: "Two Sum", outsideUrl: null, type: "CONCEPTUAL", reason: null, misunderstood: "m", correctIdea: "c", recognizeNextTime: "r", createdAt: D("2026-01-02T00:00:00Z"), ...extra });

function seedState() {
  db.seed("topicProgress", [{ userId: U, topicId: topicId("python-basics"), completedAt: D("2026-02-01T00:00:00Z") }]);
  db.seed("reviewItem", [{ id: "ri", userId: U, topicId: topicId("python-basics"), step: 1, dueAt: D("2026-03-01T00:00:00Z") }]);
  db.seed("quizResult", [{ userId: U, topicId: topicId("python-basics"), bestScore: 5, total: 6, attempts: 2, passedAt: D("2026-02-02T00:00:00Z") }]);
  db.seed("problemSolve", [{ userId: U, problemId: "p1", solvedAt: D("2026-02-03T00:00:00Z") }, { userId: U, problemId: "p2", solvedAt: D("2026-02-04T00:00:00Z") }]);
  db.seed("revisit", [{ id: "rv1", userId: U, problemId: "p1", outsideKey: null, outsideTitle: null, outsideUrl: null, dueAt: D("2026-04-01T00:00:00Z"), step: 0, passedAt: null, passedBy: null, note: null }]);
  db.seed("note", [note("n1"), note("n2")]);
  db.seed("mistake", [mistake("m1"), mistake("m2")]);
}
const fp = async (userId = U) => (await readSnapshot(userId)).fingerprint;

beforeEach(() => { db.reset(); seedBasics(db, [U, "u2"]); });

describe("fingerprint", () => {
  it("is identical for identical state, whatever order the rows come back in", async () => {
    seedState();
    const a = await fp();
    db.reset(); seedBasics(db, [U, "u2"]);
    // same data, every collection inserted in reverse order
    db.seed("note", [note("n2"), note("n1")]);
    db.seed("mistake", [mistake("m2"), mistake("m1")]);
    db.seed("problemSolve", [{ userId: U, problemId: "p2", solvedAt: D("2026-02-04T00:00:00Z") }, { userId: U, problemId: "p1", solvedAt: D("2026-02-03T00:00:00Z") }]);
    db.seed("revisit", [{ id: "rv1", userId: U, problemId: "p1", outsideKey: null, outsideTitle: null, outsideUrl: null, dueAt: D("2026-04-01T00:00:00Z"), step: 0, passedAt: null, passedBy: null, note: null }]);
    db.seed("quizResult", [{ userId: U, topicId: topicId("python-basics"), bestScore: 5, total: 6, attempts: 2, passedAt: D("2026-02-02T00:00:00Z") }]);
    db.seed("reviewItem", [{ id: "ri", userId: U, topicId: topicId("python-basics"), step: 1, dueAt: D("2026-03-01T00:00:00Z") }]);
    db.seed("topicProgress", [{ userId: U, topicId: topicId("python-basics"), completedAt: D("2026-02-01T00:00:00Z") }]);
    expect(await fp()).toBe(a);
  });

  const mutations: [string, () => void][] = [
    ["a note body changes (updatedAt untouched)", () => { db.rows("note")[0].body = "edited"; }],
    ["a note title changes", () => { db.rows("note")[0].title = "edited"; }],
    ["a note tag changes", () => { db.rows("note")[0].tags = ["b"]; }],
    ["a note is deleted", () => { db.t.note.rows = db.rows("note").slice(1); }],
    ["a note is added", () => { db.seed("note", [note("n3")]); }],
    ["a mistake field changes", () => { db.rows("mistake")[0].correctIdea = "other"; }],
    ["a mistake is deleted (as the website's deleteMany does)", () => { db.t.mistake.rows = db.rows("mistake").slice(1); }],
    ["a mistake loses its problem (admin deleted the problem, SET NULL)", () => { db.rows("mistake")[0].problemId = null; db.rows("mistake")[0].outsideTitle = "x"; }],
    ["a solve is removed (un-mark on the website)", () => { db.t.problemSolve.rows = db.rows("problemSolve").slice(1); }],
    ["a solve is added", () => { db.seed("problemSolve", [{ userId: U, problemId: "p3", solvedAt: D("2026-02-05T00:00:00Z") }]); }],
    ["a revisit is passed", () => { Object.assign(db.rows("revisit")[0], { passedAt: D("2026-05-01T00:00:00Z"), passedBy: "judge", dueAt: null }); }],
    ["the daily job moves a revisit's step", () => { db.rows("revisit")[0].step = 1; }],
    ["a review is rated", () => { db.rows("reviewItem")[0].step = 2; }],
    ["a quiz is retaken", () => { db.rows("quizResult")[0].attempts = 3; }],
    ["a topic completion time changes", () => { db.rows("topicProgress")[0].completedAt = D("2026-02-09T00:00:00Z"); }],
    ["a topic is completed", () => { db.seed("topicProgress", [{ userId: U, topicId: topicId("sets-dicts"), completedAt: D("2026-02-09T00:00:00Z") }]); }],
  ];
  for (const [name, mutate] of mutations) {
    it(`changes when ${name}`, async () => {
      seedState();
      const before = await fp();
      mutate();
      expect(await fp()).not.toBe(before);
    });
  }

  it("is not affected by another user's data", async () => {
    seedState();
    const before = await fp();
    db.seed("note", [{ ...note("other"), userId: "u2" }]);
    db.seed("problemSolve", [{ userId: "u2", problemId: "p9", solvedAt: D("2026-02-05T00:00:00Z") }]);
    db.seed("mistake", [{ ...mistake("om"), userId: "u2" }]);
    expect(await fp()).toBe(before);
    expect(await fp("u2")).not.toBe(before);
  });

  it("is 22 URL-safe characters and the same for an empty account every time", async () => {
    expect(await fp()).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await fp()).toBe(await fp());
  });

  it("reads everything in one transaction", async () => {
    seedState();
    const before = db.transactions;
    await readSnapshot(U);
    expect(db.transactions).toBe(before + 1);
  });
});

describe("pull", () => {
  it("returns the full state on the first call and `unchanged` when the cursor matches", async () => {
    seedState();
    const first = await pull(U, null, null);
    if (first.unchanged) throw new Error("expected a snapshot");
    expect(first.state?.solves.map((s) => s.problemId)).toEqual(["p1", "p2"]);
    expect(first.state?.topicProgress).toEqual([{ slug: "python-basics", completedAt: "2026-02-01T00:00:00.000Z" }]);
    expect(first.notes.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(first.mistakes.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(first.next).toBeNull();
    expect(await pull(U, first.cursor, null)).toEqual({ cursor: first.cursor, unchanged: true });
    expect(await pull(U, "AAAAAAAAAAAAAAAAAAAAAA", null)).toMatchObject({ unchanged: false });
  });

  it("detects a deletion made on the website: the item is absent and the cursor moved", async () => {
    seedState();
    const first = await pull(U, null, null);
    db.t.note.rows = db.rows("note").filter((n) => n.id !== "n1");
    const second = await pull(U, first.cursor, null);
    if (second.unchanged) throw new Error("expected change");
    expect(second.cursor).not.toBe(first.cursor);
    expect(second.notes.map((n) => n.id)).toEqual(["n2"]);
  });

  it("pages notes and mistakes by id, sends the small state only on the first page, and every row exactly once", async () => {
    const total = NOTES_PER_PAGE * 2 + 30;
    db.seed("note", Array.from({ length: total }, (_, i) => note(`n${String(i).padStart(4, "0")}`)));
    db.seed("mistake", Array.from({ length: MISTAKES_PER_PAGE + 5 }, (_, i) => mistake(`m${String(i).padStart(4, "0")}`)));
    const seen = { notes: [] as string[], mistakes: [] as string[] };
    let page: string | null = null;
    let pages = 0;
    let cursor = "";
    do {
      const r = await pull(U, null, page);
      if (r.unchanged) throw new Error("unexpected");
      pages++;
      expect(pages === 1 ? r.state !== null : r.state === null).toBe(true);
      expect(r.notes.length).toBeLessThanOrEqual(NOTES_PER_PAGE);
      expect(r.mistakes.length).toBeLessThanOrEqual(MISTAKES_PER_PAGE);
      seen.notes.push(...r.notes.map((n) => n.id)); seen.mistakes.push(...r.mistakes.map((m) => m.id));
      if (cursor) expect(r.cursor).toBe(cursor);
      cursor = r.cursor;
      page = r.next;
    } while (page);
    expect(pages).toBe(3);
    expect(new Set(seen.notes).size).toBe(total);
    expect(seen.notes).toHaveLength(total);
    expect(seen.mistakes).toHaveLength(MISTAKES_PER_PAGE + 5);
  });

  it("answers state_changed when the state changes between pages", async () => {
    db.seed("note", Array.from({ length: NOTES_PER_PAGE + 10 }, (_, i) => note(`n${String(i).padStart(4, "0")}`)));
    const first = await pull(U, null, null);
    if (first.unchanged || !first.next) throw new Error("expected a second page");
    db.rows("note")[0].body = "changed between pages";
    await expect(pull(U, null, first.next)).rejects.toMatchObject({ status: 409, code: "state_changed" });
  });

  it("an interrupted pass leaves the old cursor valid for a full restart", async () => {
    db.seed("note", Array.from({ length: NOTES_PER_PAGE + 10 }, (_, i) => note(`n${String(i).padStart(4, "0")}`)));
    const base = await fp();
    db.seed("note", [note("zzzz")]); // the state moves on
    const firstPage = await pull(U, base, null); // the client starts a pass with its stored cursor and then dies after page 1
    if (firstPage.unchanged) throw new Error("expected a snapshot");
    expect(firstPage.next).not.toBeNull(); // the pass is not finished, so the client must keep `base`
    const retry = await pull(U, base, null); // restart with the same stored cursor: the full snapshot again, not "unchanged"
    expect(retry).toMatchObject({ unchanged: false });
  });
});

describe("page tokens", () => {
  const good = () => encodePageToken({ v: 1, u: U, f: "AAAAAAAAAAAAAAAAAAAAAA", n: "n1", m: null });
  it("round-trips for the right user", () => {
    expect(decodePageToken(good(), U)).toEqual({ v: 1, u: U, f: "AAAAAAAAAAAAAAAAAAAAAA", n: "n1", m: null });
  });
  it("is bound to the user, the fingerprint and the position", async () => {
    expect(() => decodePageToken(good(), "u2")).toThrow(ApiError);
    const obj = JSON.parse(Buffer.from(good(), "base64url").toString());
    const forge = (patch: object) => Buffer.from(JSON.stringify({ ...obj, ...patch })).toString("base64url");
    expect(() => decodePageToken(forge({ n: "n9" }), U)).toThrow(ApiError); // moved position: checksum fails
    expect(() => decodePageToken(forge({ f: "BBBBBBBBBBBBBBBBBBBBBB" }), U)).toThrow(ApiError);
    expect(() => decodePageToken(forge({ u: "u2" }), U)).toThrow(ApiError);
  });
  it("rejects garbage, oversize and unknown-field tokens with 400", async () => {
    for (const bad of ["", "%%%", Buffer.from("{}").toString("base64url"), Buffer.from("not json").toString("base64url"), "x".repeat(500)]) {
      expect(() => decodePageToken(bad, U)).toThrowError(expect.objectContaining({ status: 400 }));
    }
    const o = JSON.parse(Buffer.from(good(), "base64url").toString());
    expect(() => decodePageToken(Buffer.from(JSON.stringify({ ...o, extra: 1 })).toString("base64url"), U)).toThrow(ApiError);
  });
  it("a token issued for another user's snapshot is rejected before any data is read", async () => {
    seedState();
    const tokenForU2 = encodePageToken({ v: 1, u: "u2", f: await fp("u2"), n: null, m: null });
    await expect(pull(U, null, tokenForU2)).rejects.toMatchObject({ status: 400 });
  });
});
