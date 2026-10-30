import { beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_EXPECTED = "3";
const SECRET_EXPECTED = "42-secret-answer";
const SECRET_INPUT = "secret-input-9f3a";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  contestFindFirst: vi.fn(),
  contestProblemFindUnique: vi.fn(),
  contestState: vi.fn(),
  awardSolve: vi.fn(),
  awardContestSolve: vi.fn(),
  requireUser: vi.fn(),
  isBlocked: vi.fn(),
  record: vi.fn(),
}));

vi.mock("@/lib/revisit-store", () => ({ passRevisit: vi.fn(async () => {}), scheduleRevisit: vi.fn(async () => {}) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    problem: { findFirst: mocks.findFirst },
    contest: { findFirst: mocks.contestFindFirst },
    contestProblem: { findUnique: mocks.contestProblemFindUnique },
  },
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/contests", () => ({ contestState: mocks.contestState }));
vi.mock("@/lib/rate-limit", () => ({ HOUR: 3_600_000, isBlocked: mocks.isBlocked, record: mocks.record }));
vi.mock("@/lib/solve", () => ({ awardSolve: mocks.awardSolve, awardContestSolve: mocks.awardContestSolve }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { checkOutput } from "./judge-actions";
import { NOT_RECORDED_CONTEST, NOT_RECORDED_PRACTICE } from "@/lib/solve-messages";

function submission(outputs: string[], extra: Record<string, string> = {}) {
  const f = new FormData();
  f.set("problemId", "p1");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  for (const o of outputs) f.append("output", o);
  return f;
}

const problem = {
  id: "p1",
  testCases: [
    { isSample: true, input: "1 2", expected: SAMPLE_EXPECTED },
    { isSample: false, input: SECRET_INPUT, expected: SECRET_EXPECTED },
  ],
};

const noAward = () => {
  expect(mocks.awardSolve).not.toHaveBeenCalled();
  expect(mocks.awardContestSolve).not.toHaveBeenCalled();
};
const leaksHidden = (v: unknown) => {
  const s = JSON.stringify(v);
  return s.includes(SECRET_EXPECTED) || s.includes(SECRET_INPUT);
};

describe("checkOutput (AUD-001 and AUD-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(problem);
    mocks.awardSolve.mockResolvedValue(true);
    mocks.awardContestSolve.mockResolvedValue(true);
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.isBlocked.mockResolvedValue(false);
    mocks.record.mockResolvedValue(undefined);
  });

  describe("hidden test data (AUD-001)", () => {
    it("returns input, expected and actual only for the public sample", async () => {
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED, "wrong"]));
      expect(res?.results[0]).toEqual({ isSample: true, input: "1 2", expected: SAMPLE_EXPECTED, actual: SAMPLE_EXPECTED, pass: true });
      expect(res?.results[1]).toEqual({ isSample: false, pass: false });
    });

    it("hidden test responses carry no expected value, actual value, or input", async () => {
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED]));
      expect(res?.results[1]).toEqual({ isSample: false, pass: true });
      expect(leaksHidden(res)).toBe(false);
    });

    it("ignores client-sent visibility flags", async () => {
      const res = await checkOutput(undefined, submission(["x", "y"], { isSample: "true", showHidden: "true" }));
      expect(res?.results[1]).toEqual({ isSample: false, pass: false });
      expect(leaksHidden(res)).toBe(false);
    });

    it("no response shape leaks hidden input or expected: fail, partial, pass, contest note, sample-only note, rate limit", async () => {
      const shapes: unknown[] = [];
      shapes.push(await checkOutput(undefined, submission(["x", "y"])));
      shapes.push(await checkOutput(undefined, submission([SAMPLE_EXPECTED, "y"])));
      shapes.push(await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED])));
      mocks.contestFindFirst.mockResolvedValue(null);
      shapes.push(await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED], { contestId: "c1" })));
      mocks.findFirst.mockResolvedValue({ id: "p1", testCases: [{ isSample: true, input: "1 2", expected: SAMPLE_EXPECTED }] });
      shapes.push(await checkOutput(undefined, submission([SAMPLE_EXPECTED])));
      mocks.isBlocked.mockResolvedValue(true);
      shapes.push(await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED])));
      for (const s of shapes) expect(leaksHidden(s)).toBe(false);
    });

    it("a wrong guess at a hidden test echoes nothing about that test", async () => {
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED, "guess-123"]));
      expect(JSON.stringify(res)).not.toContain("guess-123");
    });
  });

  describe("authentication and identifiers", () => {
    it("an unauthenticated caller gets no grading at all (no verdict oracle) and no award", async () => {
      mocks.requireUser.mockRejectedValue(new Error("unauthenticated"));
      await expect(checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED]))).rejects.toThrow("unauthenticated");
      expect(mocks.findFirst).not.toHaveBeenCalled();
      expect(mocks.record).not.toHaveBeenCalled();
      noAward();
    });

    it("returns no results for an unknown or unpublished problem", async () => {
      mocks.findFirst.mockResolvedValue(null);
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED]));
      expect(res).toEqual({ results: [], allPass: false });
      noAward();
    });

    it("an empty or missing problem id is just not found", async () => {
      mocks.findFirst.mockResolvedValue(null);
      const f = new FormData();
      f.append("output", SAMPLE_EXPECTED);
      expect(await checkOutput(undefined, f)).toEqual({ results: [], allPass: false });
      expect(mocks.findFirst.mock.calls[0][0].where).toMatchObject({ id: "", status: "PUBLISHED", kind: "INTERNAL" });
      noAward();
    });

    it("only published INTERNAL problems are graded, whatever the client sends for kind or status", async () => {
      await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED], { kind: "EXTERNAL", status: "DRAFT" }));
      expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ id: "p1", status: "PUBLISHED", kind: "INTERNAL" });
    });
  });

  describe("forged and malformed submissions", () => {
    it("forged success fields (allPass, solved, passed, verdict, success, expected) are ignored", async () => {
      const res = await checkOutput(undefined, submission(["x", "y"], { allPass: "true", solved: "true", passed: "true", verdict: "Accepted", success: "true", expected: SECRET_EXPECTED, pass: "true" }));
      expect(res?.allPass).toBe(false);
      noAward();
    });

    it("incorrect output awards nothing", async () => {
      const res = await checkOutput(undefined, submission(["nope", "nope"]));
      expect(res?.allPass).toBe(false);
      noAward();
    });

    it("a partial pass (sample right, hidden wrong) awards nothing", async () => {
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED + "x"]));
      expect(res?.allPass).toBe(false);
      expect(res?.results.map((r) => r.pass)).toEqual([true, false]);
      noAward();
    });

    it("an empty submission (no output fields) awards nothing", async () => {
      const res = await checkOutput(undefined, submission([]));
      expect(res?.allPass).toBe(false);
      expect(res?.results.every((r) => !r.pass)).toBe(true);
      noAward();
    });

    it("a submission with too few outputs awards nothing", async () => {
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED]));
      expect(res?.results[1]).toEqual({ isSample: false, pass: false });
      expect(res?.allPass).toBe(false);
      noAward();
    });

    it("blank outputs never match a non-empty expected value", async () => {
      const res = await checkOutput(undefined, submission(["", "   \n\n"]));
      expect(res?.allPass).toBe(false);
      noAward();
    });

    it("extra outputs beyond the test count are ignored and cannot change the verdict", async () => {
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED, "junk", "junk"]));
      expect(res?.results).toHaveLength(2);
      expect(res?.allPass).toBe(true);
    });

    it("an oversized output fails even if it equals an equally oversized expected value", async () => {
      const big = "x".repeat(25_000);
      mocks.findFirst.mockResolvedValue({ id: "p1", testCases: [{ isSample: true, input: "1", expected: "1" }, { isSample: false, input: "i", expected: big }] });
      const res = await checkOutput(undefined, submission(["1", big]));
      expect(res?.results[1]).toEqual({ isSample: false, pass: false });
      expect(res?.allPass).toBe(false);
      noAward();
    });

    it("a problem with no test cases can never be marked solved", async () => {
      mocks.findFirst.mockResolvedValue({ id: "p1", testCases: [] });
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED]));
      expect(res).toEqual({ results: [], allPass: false });
      noAward();
    });

    it("a sample-only problem cannot be marked solved by copying the public sample output", async () => {
      mocks.findFirst.mockResolvedValue({ id: "p1", testCases: [{ isSample: true, input: "1 2", expected: SAMPLE_EXPECTED }] });
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED]));
      expect(res?.allPass).toBe(true);
      expect(res?.note).toMatch(/no hidden tests/);
      noAward();
    });
  });

  describe("verified passes and retries", () => {
    it("a verified pass awards the internal solve once through the idempotent path", async () => {
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED]));
      expect(res?.allPass).toBe(true);
      expect(res?.note).toBeUndefined();
      expect(mocks.awardSolve).toHaveBeenCalledTimes(1);
      expect(mocks.awardSolve).toHaveBeenCalledWith("user-1", "p1", "OUTPUT_MATCHED");
      expect(mocks.awardContestSolve).not.toHaveBeenCalled();
    });

    it("the awarded user and problem come from the session and the database row, not from request fields", async () => {
      await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED], { userId: "attacker", problemId: "p1" }));
      expect(mocks.awardSolve).toHaveBeenCalledWith("user-1", "p1", "OUTPUT_MATCHED");
    });

    it("a retried or duplicated submission only ever reaches the idempotent award helper", async () => {
      mocks.awardSolve.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const a = await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED]));
      const b = await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED]));
      if (!a || !b) throw new Error("checkOutput returned nothing");
      // The grading is identical. Only the note differs: the first pass records the solve, and the retry is told it was already counted.
      expect(b.results).toEqual(a.results);
      expect(b.allPass).toBe(a.allPass);
      expect(a.note).toBeUndefined();
      expect(b.note).toBe(NOT_RECORDED_PRACTICE);
      expect(mocks.awardSolve.mock.calls).toEqual([["user-1", "p1", "OUTPUT_MATCHED"], ["user-1", "p1", "OUTPUT_MATCHED"]]);
      // Mock-level only: that the second call creates no row and no activity is asserted in src/lib/solve.test.ts.
    });

    it("concurrent passing submissions all go through the helper and none writes directly", async () => {
      await Promise.all(Array.from({ length: 8 }, () => checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED]))));
      expect(mocks.awardSolve).toHaveBeenCalledTimes(8);
      // db mock exposes only reads (problem, contest, contestProblem); a direct write would throw.
    });

    it("if the award transaction fails, the action fails rather than reporting a recorded solve", async () => {
      mocks.awardSolve.mockRejectedValue(new Error("tx failed"));
      await expect(checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED]))).rejects.toThrow("tx failed");
    });
  });

  describe("rate limiting the verdict oracle", () => {
    it("records every check against a key built from the user and the real problem id", async () => {
      await checkOutput(undefined, submission(["x", "y"]));
      expect(mocks.record).toHaveBeenCalledWith("check:user-1:p1");
    });

    it("a blocked user gets a note, no verdicts, no award, and the attempt is not graded", async () => {
      mocks.isBlocked.mockResolvedValue(true);
      const res = await checkOutput(undefined, submission([SAMPLE_EXPECTED, SECRET_EXPECTED]));
      expect(res?.results).toEqual([]);
      expect(res?.allPass).toBe(false);
      expect(res?.note).toMatch(/Too many checks/);
      expect(mocks.record).not.toHaveBeenCalled();
      noAward();
    });

    it("unknown problem ids create no rate-limit rows", async () => {
      mocks.findFirst.mockResolvedValue(null);
      await checkOutput(undefined, submission(["x"], { problemId: "attacker-chosen-key" }));
      expect(mocks.record).not.toHaveBeenCalled();
    });
  });

  describe("contest submissions", () => {
    const passing = () => submission([SAMPLE_EXPECTED, SECRET_EXPECTED], { contestId: "c1" });
    beforeEach(() => {
      mocks.contestFindFirst.mockResolvedValue({ durationMin: 60 });
      mocks.contestState.mockResolvedValue({ started: true, running: true, entry: { id: "e1" } });
      mocks.contestProblemFindUnique.mockResolvedValue({ problemId: "p1" });
    });

    it("awards only when the contest is published, the entry is running, and the problem is in that contest", async () => {
      const res = await checkOutput(undefined, passing());
      expect(res?.note).toBeUndefined();
      expect(mocks.contestFindFirst.mock.calls[0][0].where).toEqual({ id: "c1", status: "PUBLISHED" });
      expect(mocks.contestProblemFindUnique.mock.calls[0][0].where).toEqual({ contestId_problemId: { contestId: "c1", problemId: "p1" } });
      expect(mocks.awardContestSolve).toHaveBeenCalledWith("e1", "user-1", "p1", "OUTPUT_MATCHED");
      expect(mocks.awardSolve).not.toHaveBeenCalled();
    });

    // Regression for the missing-note race: a passing contest submission whose write records nothing (the timer ended between the
    // checks and the write, or the solve was already counted) used to return no note, so the UI could show a pass with no solve.
    it("regression: a pass whose contest write records nothing always carries the not-recorded note", async () => {
      mocks.awardContestSolve.mockResolvedValueOnce(false);
      const res = await checkOutput(undefined, passing());
      expect(res?.allPass).toBe(true);
      expect(res?.note).toBe(NOT_RECORDED_CONTEST);
      expect(mocks.awardContestSolve).toHaveBeenCalledTimes(1);
    });

    it("regression: a pass whose contest write records a solve carries no note", async () => {
      mocks.awardContestSolve.mockResolvedValueOnce(true);
      const res = await checkOutput(undefined, passing());
      expect(res?.allPass).toBe(true);
      expect(res?.note).toBeUndefined();
    });

    it("a problem outside that contest awards nothing, and does not fall back to a practice solve", async () => {
      mocks.contestProblemFindUnique.mockResolvedValue(null);
      const res = await checkOutput(undefined, passing());
      expect(res?.note).toMatch(/not part of that contest/);
      noAward();
    });

    it("a pass after the entry timer ended awards nothing, and does not fall back to a practice solve", async () => {
      mocks.contestState.mockResolvedValue({ started: true, running: false, entry: { id: "e1" } });
      const res = await checkOutput(undefined, passing());
      expect(res?.note).toMatch(/timer has ended/);
      noAward();
    });

    it("a user who never started the contest gets no award", async () => {
      mocks.contestState.mockResolvedValue({ started: false });
      const res = await checkOutput(undefined, passing());
      expect(res?.note).toMatch(/Start the contest/);
      noAward();
    });

    it("an unknown, draft or unpublished contest awards nothing", async () => {
      mocks.contestFindFirst.mockResolvedValue(null);
      const res = await checkOutput(undefined, passing());
      expect(res?.note).toMatch(/Contest not found/);
      expect(mocks.contestState).not.toHaveBeenCalled();
      noAward();
    });

    it("a failing contest submission awards nothing and does not even look up the contest", async () => {
      await checkOutput(undefined, submission([SAMPLE_EXPECTED, "wrong"], { contestId: "c1" }));
      expect(mocks.contestFindFirst).not.toHaveBeenCalled();
      noAward();
    });
  });
});
