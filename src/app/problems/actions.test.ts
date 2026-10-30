import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  problemFindFirst: vi.fn(),
  problemSolveDeleteMany: vi.fn(),
  awardSolve: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { problem: { findFirst: mocks.problemFindFirst }, problemSolve: { deleteMany: mocks.problemSolveDeleteMany } },
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/solve", () => ({ awardSolve: mocks.awardSolve }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { toggleSolved } from "./actions";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("toggleSolved (AUD-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1" });
    mocks.awardSolve.mockResolvedValue(true);
    mocks.problemSolveDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("never creates a solve for an INTERNAL problem, even with client flags claiming it passed", async () => {
    mocks.problemFindFirst.mockResolvedValue({ id: "internal-1", kind: "INTERNAL" });
    await toggleSolved(form({ problemId: "internal-1", solved: "true", passed: "true", allPass: "true" }));
    expect(mocks.awardSolve).not.toHaveBeenCalled();
  });

  it("awards an EXTERNAL problem through the idempotent path", async () => {
    mocks.problemFindFirst.mockResolvedValue({ id: "ext-1", kind: "EXTERNAL" });
    await toggleSolved(form({ problemId: "ext-1" }));
    expect(mocks.awardSolve).toHaveBeenCalledWith("user-1", "ext-1", "SELF_REPORTED");
  });

  it("lets a learner unmark an INTERNAL solve that was earned by checkOutput, and grants nothing", async () => {
    mocks.problemFindFirst.mockResolvedValue({ id: "internal-1", kind: "INTERNAL" });
    mocks.problemSolveDeleteMany.mockResolvedValue({ count: 1 });
    await toggleSolved(form({ problemId: "internal-1" }));
    expect(mocks.problemSolveDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", problemId: "internal-1" } });
    expect(mocks.awardSolve).not.toHaveBeenCalled();
  });

  it("does nothing for an unknown or unpublished problem", async () => {
    mocks.problemFindFirst.mockResolvedValue(null);
    await toggleSolved(form({ problemId: "missing" }));
    expect(mocks.problemSolveDeleteMany).not.toHaveBeenCalled();
    expect(mocks.awardSolve).not.toHaveBeenCalled();
  });

  it("an unauthenticated caller touches nothing", async () => {
    mocks.requireUser.mockRejectedValue(new Error("unauthenticated"));
    await expect(toggleSolved(form({ problemId: "ext-1" }))).rejects.toThrow("unauthenticated");
    expect(mocks.problemFindFirst).not.toHaveBeenCalled();
    expect(mocks.problemSolveDeleteMany).not.toHaveBeenCalled();
    expect(mocks.awardSolve).not.toHaveBeenCalled();
  });

  it("looks up only PUBLISHED problems and takes the kind from the database, not the form", async () => {
    mocks.problemFindFirst.mockResolvedValue({ id: "internal-1", kind: "INTERNAL" });
    await toggleSolved(form({ problemId: "internal-1", kind: "EXTERNAL", verdict: "Accepted" }));
    expect(mocks.problemFindFirst.mock.calls[0][0].where).toEqual({ id: "internal-1", status: "PUBLISHED" });
    expect(mocks.awardSolve).not.toHaveBeenCalled();
  });

  it("an INTERNAL problem is never awarded however many times the action is replayed or run concurrently", async () => {
    mocks.problemFindFirst.mockResolvedValue({ id: "internal-1", kind: "INTERNAL" });
    await Promise.all(Array.from({ length: 5 }, () => toggleSolved(form({ problemId: "internal-1", solved: "true" }))));
    expect(mocks.awardSolve).not.toHaveBeenCalled();
  });

  it("concurrent EXTERNAL marks all go through the idempotent helper and write nothing directly", async () => {
    mocks.problemFindFirst.mockResolvedValue({ id: "ext-1", kind: "EXTERNAL" });
    await Promise.all(Array.from({ length: 4 }, () => toggleSolved(form({ problemId: "ext-1" }))));
    expect(mocks.awardSolve).toHaveBeenCalledTimes(4);
    expect(mocks.awardSolve).toHaveBeenCalledWith("user-1", "ext-1", "SELF_REPORTED");
    // Mock-level only: one row and one activity is asserted in src/lib/solve.test.ts; real concurrency needs PostgreSQL.
  });

  it("unmarking an EXTERNAL solve grants nothing", async () => {
    mocks.problemFindFirst.mockResolvedValue({ id: "ext-1", kind: "EXTERNAL" });
    mocks.problemSolveDeleteMany.mockResolvedValue({ count: 1 });
    await toggleSolved(form({ problemId: "ext-1" }));
    expect(mocks.awardSolve).not.toHaveBeenCalled();
  });
});
