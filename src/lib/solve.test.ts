import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * MOCK-LEVEL GUARANTEES ONLY. This in-memory fake models the composite primary keys (createMany + skipDuplicates inserts only unseen keys,
 * as Postgres ON CONFLICT DO NOTHING does) and a snapshot-and-restore rollback. JavaScript is single-threaded, so "concurrent" calls here
 * prove the helper's logic (it writes activity only when a row was inserted), NOT PostgreSQL's behaviour under real parallel connections
 * or real transaction rollback. Those need an integration test against a real database (see docs/ALGORYVA_PROJECT_AUDIT.md, AUD-004).
 */
type Entry = { userId: string; contestId: string; startedAt: Date; contest: { status: string; durationMin: number } };
const store = vi.hoisted(() => ({
  problemSolve: new Set<string>(),
  contestSolve: new Set<string>(),
  activity: [] as { userId: string; type: string }[],
  entries: new Map<string, Entry>(),
  contestProblems: new Set<string>(),
  failActivity: false,
}));
const tx = vi.hoisted(() => ({
  problemSolve: {
    createMany: vi.fn(async ({ data }: { data: { userId: string; problemId: string }[] }) => {
      let count = 0;
      for (const d of data) { const k = `${d.userId}:${d.problemId}`; if (!store.problemSolve.has(k)) { store.problemSolve.add(k); count++; } }
      return { count };
    }),
  },
  contestSolve: {
    createMany: vi.fn(async ({ data }: { data: { entryId: string; problemId: string }[] }) => {
      let count = 0;
      for (const d of data) { const k = `${d.entryId}:${d.problemId}`; if (!store.contestSolve.has(k)) { store.contestSolve.add(k); count++; } }
      return { count };
    }),
  },
  contestEntry: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => store.entries.get(where.id) ?? null) },
  contestProblem: {
    findUnique: vi.fn(async ({ where }: { where: { contestId_problemId: { contestId: string; problemId: string } } }) => {
      const { contestId, problemId } = where.contestId_problemId;
      return store.contestProblems.has(`${contestId}:${problemId}`) ? { problemId } : null;
    }),
  },
  activity: {
    create: vi.fn(async ({ data }: { data: { userId: string; type: string } }) => {
      if (store.failActivity) throw new Error("activity insert failed");
      store.activity.push(data);
      return data;
    }),
  },
}));

vi.mock("server-only", () => ({}));
// db exposes ONLY $transaction: any write made outside the transaction callback would throw, so these tests also prove there is none.
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const snap = { ps: new Set(store.problemSolve), cs: new Set(store.contestSolve), act: [...store.activity] };
      try {
        return await fn(tx);
      } catch (e) {
        store.problemSolve = snap.ps; store.contestSolve = snap.cs; store.activity = snap.act; // simulated rollback
        throw e;
      }
    },
  },
}));

import { awardContestSolve, awardSolve } from "./solve";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

describe("awardSolve (AUD-004)", () => {
  beforeEach(() => {
    store.problemSolve = new Set(); store.contestSolve = new Set(); store.activity = [];
    store.entries.clear(); store.contestProblems.clear(); store.failActivity = false;
    vi.clearAllMocks();
  });

  it("awards a new solve and writes exactly one activity", async () => {
    expect(await awardSolve("u1", "p1", "OUTPUT_MATCHED")).toBe(true);
    expect(store.problemSolve.size).toBe(1);
    expect(store.activity).toEqual([{ userId: "u1", type: "problem_solved" }]);
  });

  it("repeated requests award once: no extra row and no extra activity", async () => {
    await awardSolve("u1", "p1", "OUTPUT_MATCHED");
    expect(await awardSolve("u1", "p1", "OUTPUT_MATCHED")).toBe(false);
    expect(await awardSolve("u1", "p1", "OUTPUT_MATCHED")).toBe(false);
    expect(store.problemSolve.size).toBe(1);
    expect(store.activity).toHaveLength(1);
  });

  it("concurrent requests award once (mock-level)", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => awardSolve("u1", "p1", "OUTPUT_MATCHED")));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(store.activity).toHaveLength(1);
  });

  it("different users and different problems each get their own single award", async () => {
    await Promise.all([awardSolve("u1", "p1", "OUTPUT_MATCHED"), awardSolve("u2", "p1", "OUTPUT_MATCHED"), awardSolve("u1", "p2", "OUTPUT_MATCHED")]);
    expect(store.problemSolve.size).toBe(3);
    expect(store.activity).toHaveLength(3);
  });

  it("a failure after the solve row is inserted leaves no solve row and no activity (simulated rollback)", async () => {
    store.failActivity = true;
    await expect(awardSolve("u1", "p1", "OUTPUT_MATCHED")).rejects.toThrow("activity insert failed");
    expect(store.problemSolve.size).toBe(0);
    expect(store.activity).toHaveLength(0);
    // A later retry then succeeds exactly once.
    store.failActivity = false;
    expect(await awardSolve("u1", "p1", "OUTPUT_MATCHED")).toBe(true);
    expect(store.activity).toHaveLength(1);
  });
});

describe("awardContestSolve (AUD-004)", () => {
  beforeEach(() => {
    store.problemSolve = new Set(); store.contestSolve = new Set(); store.activity = [];
    store.entries.clear(); store.contestProblems.clear(); store.failActivity = false;
    vi.clearAllMocks();
    store.entries.set("e1", { userId: "u1", contestId: "c1", startedAt: minutesAgo(10), contest: { status: "PUBLISHED", durationMin: 60 } });
    store.contestProblems.add("c1:p1");
  });

  it("awards a valid contest solve once and writes one activity", async () => {
    expect(await awardContestSolve("e1", "u1", "p1", "OUTPUT_MATCHED")).toBe(true);
    expect(store.contestSolve.size).toBe(1);
    expect(store.activity).toEqual([{ userId: "u1", type: "problem_solved" }]);
  });

  it("is idempotent per entry and problem, including concurrent calls (mock-level)", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => awardContestSolve("e1", "u1", "p1", "OUTPUT_MATCHED")));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(store.contestSolve.size).toBe(1);
    expect(store.activity).toHaveLength(1);
  });

  it("refuses a problem that is not in the entry's contest", async () => {
    expect(await awardContestSolve("e1", "u1", "p-outside", "OUTPUT_MATCHED")).toBe(false);
    expect(store.contestSolve.size).toBe(0);
    expect(store.activity).toHaveLength(0);
  });

  it("refuses once the entry's timer has ended", async () => {
    store.entries.set("e1", { userId: "u1", contestId: "c1", startedAt: minutesAgo(61), contest: { status: "PUBLISHED", durationMin: 60 } });
    expect(await awardContestSolve("e1", "u1", "p1", "OUTPUT_MATCHED")).toBe(false);
    expect(store.contestSolve.size).toBe(0);
    expect(store.activity).toHaveLength(0);
  });

  it("refuses an entry that belongs to a different user", async () => {
    expect(await awardContestSolve("e1", "u2", "p1", "OUTPUT_MATCHED")).toBe(false);
    expect(store.contestSolve.size).toBe(0);
    expect(store.activity).toHaveLength(0);
  });

  it("refuses an unknown entry and an unpublished contest", async () => {
    expect(await awardContestSolve("missing", "u1", "p1", "OUTPUT_MATCHED")).toBe(false);
    store.entries.set("e1", { userId: "u1", contestId: "c1", startedAt: minutesAgo(10), contest: { status: "DRAFT", durationMin: 60 } });
    expect(await awardContestSolve("e1", "u1", "p1", "OUTPUT_MATCHED")).toBe(false);
    expect(store.contestSolve.size).toBe(0);
    expect(store.activity).toHaveLength(0);
  });

  it("a failure after the solve row is inserted leaves no solve row and no activity (simulated rollback)", async () => {
    store.failActivity = true;
    await expect(awardContestSolve("e1", "u1", "p1", "OUTPUT_MATCHED")).rejects.toThrow("activity insert failed");
    expect(store.contestSolve.size).toBe(0);
    expect(store.activity).toHaveLength(0);
  });
});
