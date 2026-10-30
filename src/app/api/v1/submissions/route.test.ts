import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser: m.requireUser }));
vi.mock("@/lib/auth/account-mail", () => ({ sendRevisitDigest: vi.fn() }));
vi.mock("@/lib/contests", () => ({ contestState: vi.fn() }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { seedBasics } from "@/lib/test-support/seed";
import { bearer, body, req } from "@/lib/test-support/http";
import { createMobileSession } from "@/lib/api/mobile-auth";
import { POST } from "@/app/api/v1/submissions/route";
import { NO_HIDDEN_NOTE, NO_TESTS_NOTE, MAX_OUTPUT_CHARS, gradeTests, submit } from "@/lib/mobile/submissions";
import { checkOutput } from "@/app/problems/judge-actions";
import { NOT_RECORDED_PRACTICE } from "@/lib/solve-messages";

const HIDDEN_IN = "HIDDEN-INPUT-canary-5521", HIDDEN_OUT = "HIDDEN-EXPECTED-canary-5521";
const CID = () => crypto.randomUUID();
type T = { id: string; problemId: string; input: string; expected: string; isSample: boolean };
const t = (id: string, isSample: boolean, input: string, expected: string): T => ({ id, problemId: "p1", input, expected, isSample });
// Order as the database returns it: samples first, then by id (the website's orderBy).
const STANDARD = [t("t1", true, "1 2", "3"), t("t2", false, HIDDEN_IN, HIDDEN_OUT), t("t3", false, "h3", "h3-out")];
const GOOD = ["3", HIDDEN_OUT, "h3-out"];

function seed(tests: T[] = STANDARD, extra: Record<string, unknown> = {}) {
  db.reset(); seedBasics(db, ["u1", "u2"]);
  db.seed("problem", [{ id: "p1", slug: "p1", kind: "INTERNAL", status: "PUBLISHED", title: "Sum", testCases: tests, ...extra }]);
}
let token = "";
async function login() { token = (await createMobileSession("u1", "d")).token; }
const post = (b: unknown, tk: string | null = token) => POST(req("/api/v1/submissions", "POST", b, tk ? bearer(tk) : {}));
const send = (output: string | string[], clientId = CID(), problemId = "p1") => post({ problemId, clientId, output });

beforeEach(async () => { seed(); m.requireUser.mockResolvedValue({ id: "u1" }); await login(); });

describe("authentication and input", () => {
  it("authenticates before any test data is read", async () => {
    const spy = vi.spyOn(db.problem, "findFirst");
    expect((await post({ problemId: "p1", clientId: CID(), output: "3" }, null)).status).toBe(401);
    expect((await post({ problemId: "p1", clientId: CID(), output: "3" }, "alv_" + "q".repeat(43))).status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("is strict: unknown fields (like the website's contestId), bad ids and wrong types are 400", async () => {
    for (const bad of [{ problemId: "p1", clientId: CID(), output: "3", contestId: "c1" }, { problemId: "p1", clientId: "x", output: "3" }, { problemId: "", clientId: CID(), output: "3" }, { problemId: "p1", clientId: CID(), output: 3 }, { problemId: "p1", clientId: CID(), output: [1] }, { problemId: "p1", clientId: CID() }, { problemId: "p1", clientId: CID(), outputs: ["3"] }]) {
      const r = await post(bad);
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
    expect(db.rows("syncEvent")).toHaveLength(0);
  });
  it("413 over 256 KB, 415 for another content type", async () => {
    expect((await send("x".repeat(300 * 1024))).status).toBe(413);
    expect((await POST(req("/api/v1/submissions", "POST", "x", { ...bearer(token), "content-type": "text/plain" }))).status).toBe(415);
  });
});

describe("what can be submitted", () => {
  it("404 for an unknown, draft, or EXTERNAL problem, and nothing is recorded", async () => {
    db.seed("problem", [{ id: "d1", slug: "d1", kind: "INTERNAL", status: "DRAFT", testCases: STANDARD }, { id: "e1", slug: "e1", kind: "EXTERNAL", status: "PUBLISHED", testCases: [] }]);
    for (const id of ["nope", "d1", "e1"]) {
      const r = await send(GOOD, CID(), id);
      expect(r.status).toBe(404);
      expect((await body(r)).error.code).toBe("not_found");
    }
    expect(db.rows("syncEvent")).toHaveLength(0);
    expect(db.rows("authAttempt").filter((a) => String(a.key).startsWith("check:"))).toHaveLength(0);
  });
});

describe("verdicts", () => {
  it("accepted: every test matched and a hidden test exists, so the solve is recorded once", async () => {
    const r = await send(GOOD);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const b = await body(r);
    expect(b).toMatchObject({ verdict: "accepted", allPass: true, solved: true });
    expect(db.rows("problemSolve")).toHaveLength(1);
    expect(db.rows("activity").filter((a) => a.type === "problem_solved")).toHaveLength(1);
  });
  it("wrong_answer: a failed hidden test records no solve and says which tests failed, without their data", async () => {
    const b = await body(await send(["3", "wrong", "h3-out"]));
    expect(b).toMatchObject({ verdict: "wrong_answer", allPass: false, solved: false });
    expect(b.results.map((x: { pass: boolean }) => x.pass)).toEqual([true, false, true]);
    expect(db.rows("problemSolve")).toHaveLength(0);
  });
  it("a solve that already exists stays solved after a wrong answer, and is not awarded twice", async () => {
    await send(GOOD);
    const again = await body(await send(GOOD));
    expect(again).toMatchObject({ verdict: "accepted", solved: true });
    expect(db.rows("problemSolve")).toHaveLength(1);
    expect(db.rows("activity")).toHaveLength(1);
    expect(await body(await send(["x", "y", "z"]))).toMatchObject({ verdict: "wrong_answer", solved: true });
  });
  it("not_recorded: a sample-only problem is never marked solved, with the website's note", async () => {
    seed([t("t1", true, "1 2", "3")]);
    await login();
    const b = await body(await send("3"));
    expect(b).toMatchObject({ verdict: "not_recorded", allPass: true, solved: false, note: NO_HIDDEN_NOTE });
    expect(NO_HIDDEN_NOTE).toBe("This problem has no hidden tests, so matching the sample cannot mark it solved.");
    expect(db.rows("problemSolve")).toHaveLength(0);
  });
  it("not_recorded with its own note for a problem with no tests", async () => {
    seed([]); await login();
    expect(await body(await send("x"))).toMatchObject({ verdict: "not_recorded", allPass: false, solved: false, results: [], note: NO_TESTS_NOTE });
  });
  it("a single string is graded as a form with only the first box filled, so a problem with hidden tests cannot be solved by it", async () => {
    const b = await body(await send("3"));
    expect(b).toMatchObject({ verdict: "wrong_answer", allPass: false });
    expect(b.results.map((x: { pass: boolean }) => x.pass)).toEqual([true, false, false]);
    expect(db.rows("problemSolve")).toHaveLength(0);
  });
  it("a full match passes a due revisit (as verified by the judge) and leaves a not-yet-due one", async () => {
    db.seed("revisit", [{ id: "due", userId: "u1", problemId: "p1", outsideKey: null, dueAt: new Date(Date.now() - 1000), step: 0, passedAt: null }]);
    await send(GOOD);
    expect(db.rows("revisit")[0]).toMatchObject({ passedBy: "judge", dueAt: null });
    expect(db.rows("revisit")[0].passedAt).toBeInstanceOf(Date);
    db.t.revisit.rows = []; db.t.problemSolve.rows = [];
    db.seed("revisit", [{ id: "later", userId: "u1", problemId: "p1", outsideKey: null, dueAt: new Date(Date.now() + 86_400_000), step: 0, passedAt: null }]);
    await send(GOOD);
    expect(db.rows("revisit")[0].passedAt).toBeNull();
  });
});

describe("hidden test data never leaves the server", () => {
  it("is absent from the first response, from a replay, and from errors", async () => {
    const id = CID();
    const first = await send(["3", "wrong", "wrong"], id);
    const replay = await send(["3", "wrong", "wrong"], id);
    const conflict = await post({ problemId: "p1", clientId: id, output: ["different"] });
    const notFound = await send(GOOD, CID(), "zzz");
    for (const r of [first, replay, conflict, notFound]) {
      const text = await r.text();
      expect(text).not.toContain(HIDDEN_IN);
      expect(text).not.toContain(HIDDEN_OUT);
      expect(text).not.toContain("h3-out");
    }
    const b = await body(await send(GOOD));
    expect(b.results[1]).toEqual({ isSample: false, pass: true });
    expect(b.results[0]).toEqual({ isSample: true, pass: true, input: "1 2", expected: "3", actual: "3" });
  });
});

describe("rate limits", () => {
  it("uses the website's shared per-user-per-problem key (40 per hour), recorded for every graded attempt", async () => {
    await send(["x", "y", "z"]);
    expect(db.rows("authAttempt").map((a) => a.key).sort()).toEqual(["check:u1:p1", "v1-submit:u1"]);
    for (let i = 0; i < 39; i++) db.seed("authAttempt", [{ id: `c${i}`, key: "check:u1:p1", createdAt: new Date() }]);
    const r = await send(GOOD);
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("3600");
    expect((await body(r)).error.message).toBe("Too many checks on this problem. Wait a while and try again.");
    expect(db.rows("problemSolve")).toHaveLength(0);
  });
  it("attempts on the website count against the same limit as the app", async () => {
    for (let i = 0; i < 40; i++) db.seed("authAttempt", [{ id: `w${i}`, key: "check:u1:p1", createdAt: new Date() }]);
    expect((await send(GOOD)).status).toBe(429);
  });
  it("has an overall per-user cap (240 per hour) so many different problems cannot be probed", async () => {
    for (let i = 0; i < 240; i++) db.seed("authAttempt", [{ id: `s${i}`, key: "v1-submit:u1", createdAt: new Date() }]);
    expect((await send(GOOD)).status).toBe(429);
  });
  it("a retry of a stored client id uses no budget and is answered even when limited", async () => {
    const id = CID();
    await send(GOOD, id);
    const used = db.rows("authAttempt").length;
    for (let i = 0; i < 40; i++) db.seed("authAttempt", [{ id: `c${i}`, key: "check:u1:p1", createdAt: new Date() }]);
    const r = await send(GOOD, id);
    expect(r.status).toBe(200);
    expect((await body(r)).replayed).toBe(true);
    expect(db.rows("authAttempt").length).toBe(used + 40);
  });
});

describe("idempotency", () => {
  it("a retry returns the stored verdict, once, with no second award, activity or limit use", async () => {
    const id = CID();
    const first = await body(await send(GOOD, id));
    const second = await body(await send(GOOD, id));
    expect(second).toMatchObject({ clientId: id, verdict: first.verdict, allPass: true, solved: true, replayed: true });
    expect(second.results.every((r: { actual?: string }) => r.actual === undefined)).toBe(true); // the learner's own text is not stored
    expect(db.rows("problemSolve")).toHaveLength(1);
    expect(db.rows("activity")).toHaveLength(1);
    expect(db.rows("syncEvent")).toHaveLength(1);
    expect(db.rows("authAttempt").filter((a) => a.key === "check:u1:p1")).toHaveLength(1);
  });
  it("a string and a one-element array are the same submission for a retry", async () => {
    seed([t("t1", true, "1 2", "3")]); await login();
    const id = CID();
    await send("3", id);
    expect((await send(["3"], id)).status).toBe(200);
  });
  it("the same client id for a different problem or different output is a 409 and never another submission's verdict", async () => {
    db.seed("problem", [{ id: "p2", slug: "p2", kind: "INTERNAL", status: "PUBLISHED", testCases: STANDARD }]);
    const id = CID();
    await send(GOOD, id);
    for (const r of [await send(GOOD, id, "p2"), await send(["other", "x", "y"], id)]) {
      expect(r.status).toBe(409);
      expect((await body(r)).error.code).toBe("client_id_reuse");
    }
  });
  it("a client id is per user", async () => {
    const id = CID();
    await send(GOOD, id);
    const u2 = (await createMobileSession("u2", "d")).token;
    expect(await body(await post({ problemId: "p1", clientId: id, output: ["x", "y", "z"] }, u2))).toMatchObject({ verdict: "wrong_answer" });
  });
  it("two concurrent copies award the solve once", async () => {
    const id = CID();
    const [a, b] = await Promise.all([send(GOOD, id), send(GOOD, id)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(db.rows("problemSolve")).toHaveLength(1);
    expect(db.rows("activity")).toHaveLength(1);
    expect(db.rows("syncEvent")).toHaveLength(1);
  });
  it("an unexpected failure rolls everything back, and the retry with the same id succeeds", async () => {
    const id = CID();
    db.failNext("activity.create");
    expect((await send(GOOD, id)).status).toBe(500);
    expect(db.rows("syncEvent")).toHaveLength(0);
    expect(db.rows("problemSolve")).toHaveLength(0);
    expect(await body(await send(GOOD, id))).toMatchObject({ verdict: "accepted" });
    expect(db.rows("problemSolve")).toHaveLength(1);
  });
});

// ---- parity with the website's checker ----
type Fixture = { name: string; tests: T[]; outputs: string[]; setup?: () => void };
const big = "y".repeat(MAX_OUTPUT_CHARS + 1);
const fixtures: Fixture[] = [
  { name: "all pass with hidden tests", tests: STANDARD, outputs: GOOD },
  { name: "one hidden test wrong", tests: STANDARD, outputs: ["3", "no", "h3-out"] },
  { name: "all wrong", tests: STANDARD, outputs: ["a", "b", "c"] },
  { name: "trailing spaces, CRLF and blank trailing lines are ignored", tests: STANDARD, outputs: ["3  \r\n\r\n", HIDDEN_OUT + " \n\n", "h3-out\r\n"] },
  { name: "leading whitespace is significant", tests: STANDARD, outputs: [" 3", HIDDEN_OUT, "h3-out"] },
  { name: "missing outputs count as empty", tests: STANDARD, outputs: ["3"] },
  { name: "no outputs at all", tests: STANDARD, outputs: [] },
  { name: "extra outputs are ignored", tests: STANDARD, outputs: [...GOOD, "extra", "more"] },
  { name: "an output over the limit fails even if it equals the expected text", tests: [t("t1", true, "i", big), t("t2", false, "h", "ok")], outputs: [big, "ok"] },
  { name: "exactly at the limit passes", tests: [t("t1", true, "i", "y".repeat(MAX_OUTPUT_CHARS)), t("t2", false, "h", "ok")], outputs: ["y".repeat(MAX_OUTPUT_CHARS), "ok"] },
  { name: "sample only, matched", tests: [t("t1", true, "1", "2")], outputs: ["2"] },
  { name: "sample only, not matched", tests: [t("t1", true, "1", "2")], outputs: ["9"] },
  { name: "no tests", tests: [], outputs: ["anything"] },
  { name: "several samples then hidden", tests: [t("a", true, "i1", "o1"), t("b", true, "i2", "o2"), t("c", false, "h", "o3")], outputs: ["o1", "o2", "o3"] },
  { name: "a due revisit is passed by a full match", tests: STANDARD, outputs: GOOD, setup: () => db.seed("revisit", [{ id: "rv", userId: "u1", problemId: "p1", outsideKey: null, dueAt: new Date(Date.now() - 5000), step: 1, passedAt: null }]) },
  { name: "an already-solved problem", tests: STANDARD, outputs: GOOD, setup: () => db.seed("problemSolve", [{ userId: "u1", problemId: "p1" }]) },
];
const state = () => JSON.stringify({ solves: db.rows("problemSolve").map((r) => [r.userId, r.problemId]), activity: db.rows("activity").map((r) => r.type), revisit: db.rows("revisit").map((r) => [r.id, r.passedBy ?? null, r.dueAt === null]), limiter: db.rows("authAttempt").map((r) => r.key).filter((k) => String(k).startsWith("check:")) });

describe("parity with the website's checkOutput (same grading, same effects)", () => {
  for (const f of fixtures) {
    it(f.name, async () => {
      // website
      seed(f.tests); f.setup?.();
      const form = new FormData(); form.set("problemId", "p1"); for (const o of f.outputs) form.append("output", o);
      const web = await checkOutput(undefined, form);
      const webState = state();
      // mobile, on a fresh database with the same starting rows
      seed(f.tests); f.setup?.(); await login();
      const mobile = await submit("u1", { problemId: "p1", clientId: CID(), output: f.outputs });
      const strip = (s: string) => JSON.parse(s) as { limiter: string[] };
      const mobileState = JSON.parse(state()) as { limiter: string[] };
      mobileState.limiter = mobileState.limiter.filter((k) => !String(k).startsWith("v1-")); // the app's own extra counter is not part of the comparison
      // identical grading
      expect(mobile.results).toEqual(web?.results);
      expect(mobile.allPass).toBe(web?.allPass);
      // identical effects (solves, activity, revisit, the shared limiter key)
      expect(mobileState).toEqual(strip(webState));
      // the website's note (when it shows one) is the app's note
      if (web?.note) expect(mobile.note).toBe(web.note);
      // and the app's verdict is consistent with the website's outcome
      // The already-counted note explains a pass that changes nothing; it does not change the verdict.
      const verdictNote = web?.note && web.note !== NOT_RECORDED_PRACTICE ? web.note : undefined;
      expect(mobile.verdict === "accepted").toBe(Boolean(web?.allPass && !verdictNote));
    });
  }

  it("gradeTests (pure) applies the same normalisation as lib/judge", () => {
    expect(gradeTests([t("a", true, "i", "x y\nz")], ["x y  \r\nz\n\n"]).allPass).toBe(true);
    expect(gradeTests([t("a", true, "i", "x")], [" x"]).allPass).toBe(false);
  });
});
