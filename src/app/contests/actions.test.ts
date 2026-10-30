import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  contestFindFirst: vi.fn(),
  contestProblemFindUnique: vi.fn(),
  contestState: vi.fn(),
  getOrStartEntry: vi.fn(),
  awardContestSolve: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { contest: { findFirst: mocks.contestFindFirst }, contestProblem: { findUnique: mocks.contestProblemFindUnique } },
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/contests", () => ({ contestState: mocks.contestState, getOrStartEntry: mocks.getOrStartEntry }));
vi.mock("@/lib/solve", () => ({ awardContestSolve: mocks.awardContestSolve }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { markSolvedInContest, startContest } from "./actions";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}
const valid = { contestId: "c1", problemId: "p1" };

describe("markSolvedInContest (AUD-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.contestFindFirst.mockResolvedValue({ durationMin: 60, slug: "c-one" });
    mocks.contestState.mockResolvedValue({ started: true, running: true, entry: { id: "e1" } });
    mocks.contestProblemFindUnique.mockResolvedValue({ problem: { kind: "EXTERNAL", status: "PUBLISHED" } });
    mocks.awardContestSolve.mockResolvedValue(true);
  });

  it("awards a self-reported EXTERNAL contest problem while the entry timer is running", async () => {
    await markSolvedInContest(form(valid));
    expect(mocks.awardContestSolve).toHaveBeenCalledWith("e1", "user-1", "p1", "SELF_REPORTED");
    expect(mocks.contestFindFirst.mock.calls[0][0].where).toEqual({ id: "c1", status: "PUBLISHED" });
  });

  it("never awards an INTERNAL problem, even if the client claims it is external or passed", async () => {
    mocks.contestProblemFindUnique.mockResolvedValue({ problem: { kind: "INTERNAL", status: "PUBLISHED" } });
    await markSolvedInContest(form({ ...valid, kind: "EXTERNAL", passed: "true", allPass: "true", solved: "true" }));
    expect(mocks.awardContestSolve).not.toHaveBeenCalled();
  });

  it("awards nothing for a problem outside the contest", async () => {
    mocks.contestProblemFindUnique.mockResolvedValue(null);
    await markSolvedInContest(form({ contestId: "c1", problemId: "p-outside" }));
    expect(mocks.awardContestSolve).not.toHaveBeenCalled();
  });

  it("awards nothing for an unpublished problem", async () => {
    mocks.contestProblemFindUnique.mockResolvedValue({ problem: { kind: "EXTERNAL", status: "DRAFT" } });
    await markSolvedInContest(form(valid));
    expect(mocks.awardContestSolve).not.toHaveBeenCalled();
  });

  it("awards nothing after the entry timer ended", async () => {
    mocks.contestState.mockResolvedValue({ started: true, running: false, entry: { id: "e1" } });
    await markSolvedInContest(form(valid));
    expect(mocks.awardContestSolve).not.toHaveBeenCalled();
  });

  it("awards nothing if the user never started the contest", async () => {
    mocks.contestState.mockResolvedValue({ started: false });
    await markSolvedInContest(form(valid));
    expect(mocks.awardContestSolve).not.toHaveBeenCalled();
  });

  it("awards nothing for an unknown, draft or unpublished contest", async () => {
    mocks.contestFindFirst.mockResolvedValue(null);
    await markSolvedInContest(form(valid));
    expect(mocks.contestState).not.toHaveBeenCalled();
    expect(mocks.awardContestSolve).not.toHaveBeenCalled();
  });

  it("an unauthenticated caller touches nothing", async () => {
    mocks.requireUser.mockRejectedValue(new Error("unauthenticated"));
    await expect(markSolvedInContest(form(valid))).rejects.toThrow("unauthenticated");
    expect(mocks.contestFindFirst).not.toHaveBeenCalled();
    expect(mocks.awardContestSolve).not.toHaveBeenCalled();
  });

  it("the entry used for the award comes from the session user, not from the form", async () => {
    await markSolvedInContest(form({ ...valid, userId: "attacker", entryId: "e-attacker" }));
    expect(mocks.contestState).toHaveBeenCalledWith("c1", 60, "user-1");
    expect(mocks.awardContestSolve).toHaveBeenCalledWith("e1", "user-1", "p1", "SELF_REPORTED");
  });

  it("repeated and concurrent requests all go through the idempotent helper", async () => {
    await Promise.all([markSolvedInContest(form(valid)), markSolvedInContest(form(valid)), markSolvedInContest(form(valid))]);
    expect(mocks.awardContestSolve).toHaveBeenCalledTimes(3);
    // Mock-level only: single-row, single-activity behaviour is asserted in src/lib/solve.test.ts.
  });
});

describe("startContest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
  });

  it("only starts a PUBLISHED contest and never awards anything", async () => {
    mocks.contestFindFirst.mockResolvedValue(null);
    await startContest(form({ contestId: "draft" }));
    expect(mocks.getOrStartEntry).not.toHaveBeenCalled();
    expect(mocks.awardContestSolve).not.toHaveBeenCalled();
  });
});
