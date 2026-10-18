import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userUpdate: vi.fn(),
  revisitFindMany: vi.fn(),
  revisitUpdate: vi.fn(),
  revisitUpdateMany: vi.fn(),
  revisitUpsert: vi.fn(),
  sendRevisitDigest: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: m.userFindMany, update: m.userUpdate },
    revisit: { findMany: m.revisitFindMany, update: m.revisitUpdate, updateMany: m.revisitUpdateMany, upsert: m.revisitUpsert },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));
vi.mock("@/lib/auth/account-mail", () => ({ sendRevisitDigest: m.sendRevisitDigest }));

import { passRevisit, runRevisitDigests, scheduleRevisit } from "./revisit-store";

const now = new Date("2026-10-15T08:00:00Z");
const DAY = 86_400_000;

beforeEach(() => {
  vi.resetAllMocks();
  m.revisitUpdate.mockResolvedValue({});
  m.userUpdate.mockResolvedValue({});
});

describe("scheduleRevisit", () => {
  it("creates or restarts the ladder at step 0, one day out, and clears a previous pass", async () => {
    await scheduleRevisit("u1", "p1", now);
    expect(m.revisitUpsert).toHaveBeenCalledWith({
      where: { userId_problemId: { userId: "u1", problemId: "p1" } },
      create: { userId: "u1", problemId: "p1", dueAt: new Date(now.getTime() + DAY), step: 0 },
      update: { dueAt: new Date(now.getTime() + DAY), step: 0, passedAt: null, passedBy: null, note: null },
    });
  });
});

describe("passRevisit", () => {
  it("passes only revisits that are already due and not yet passed", async () => {
    await passRevisit("u1", "p1", now);
    expect(m.revisitUpdateMany).toHaveBeenCalledWith({
      where: { userId: "u1", problemId: "p1", passedAt: null, dueAt: { lte: now } },
      data: { passedAt: now, dueAt: null, passedBy: "judge" },
    });
  });
});

describe("scheduleOutsideRevisit", () => {
  it("queues an outside problem by its link, one day out", async () => {
    const { scheduleOutsideRevisit } = await import("./revisit-store");
    await scheduleOutsideRevisit("u1", "Two Sum", "https://leetcode.com/problems/two-sum", now);
    const call = m.revisitUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId_outsideKey: { userId: "u1", outsideKey: "url:https://leetcode.com/problems/two-sum" } });
    expect(call.create).toMatchObject({ outsideTitle: "Two Sum", dueAt: new Date(now.getTime() + DAY), step: 0 });
  });
});

describe("selfReportRevisit", () => {
  it("passes only a due OUTSIDE revisit, recorded as self-reported with the explanation", async () => {
    const { selfReportRevisit } = await import("./revisit-store");
    m.revisitUpdateMany.mockResolvedValue({ count: 1 });
    const n = await selfReportRevisit("u1", "r9", "Sort by end time, then keep each that starts after the last end.", now);
    expect(n).toBe(1);
    expect(m.revisitUpdateMany).toHaveBeenCalledWith({
      where: { id: "r9", userId: "u1", problemId: null, passedAt: null, dueAt: { lte: now } },
      data: { passedAt: now, dueAt: null, passedBy: "self", note: "Sort by end time, then keep each that starts after the last end." },
    });
  });
  it("returns 0 when the revisit is a site problem, not due, or already passed", async () => {
    const { selfReportRevisit } = await import("./revisit-store");
    m.revisitUpdateMany.mockResolvedValue({ count: 0 });
    expect(await selfReportRevisit("u1", "r9", "x".repeat(25), now)).toBe(0);
  });
});

describe("runRevisitDigests", () => {
  const user = { id: "u1", email: "a@b.co" };
  const due = (id: string, title: string, step = 0) => ({ id, step, problem: { title } });

  it("sends one digest and moves each due revisit to its next reminder", async () => {
    m.userFindMany.mockResolvedValue([user]);
    m.revisitFindMany.mockResolvedValue([due("r1", "Two Sum", 0)]);
    m.sendRevisitDigest.mockResolvedValue(true);
    const result = await runRevisitDigests(now, 200);
    expect(m.sendRevisitDigest).toHaveBeenCalledWith("a@b.co", ["Two Sum"], 0);
    expect(m.revisitUpdate).toHaveBeenCalledWith({ where: { id: "r1" }, data: { step: 1, dueAt: new Date(now.getTime() + 3 * DAY) } });
    expect(m.userUpdate).toHaveBeenCalledWith({ where: { id: "u1" }, data: { revisitEmailedAt: now } });
    expect(result).toEqual({ users: 1, sent: 1, failed: 0 });
  });

  it("does not move any reminder forward when the provider refuses the email", async () => {
    m.userFindMany.mockResolvedValue([user]);
    m.revisitFindMany.mockResolvedValue([due("r1", "Two Sum")]);
    m.sendRevisitDigest.mockResolvedValue(false);
    const result = await runRevisitDigests(now, 200);
    expect(m.revisitUpdate).not.toHaveBeenCalled();
    expect(m.userUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({ users: 1, sent: 0, failed: 1 });
  });

  it("uses the outside title for a revisit that is not a site problem", async () => {
    m.userFindMany.mockResolvedValue([user]);
    m.revisitFindMany.mockResolvedValue([{ id: "r1", step: 0, problem: null, outsideTitle: "Two Sum" }]);
    m.sendRevisitDigest.mockResolvedValue(true);
    await runRevisitDigests(now, 200);
    expect(m.sendRevisitDigest).toHaveBeenCalledWith("a@b.co", ["Two Sum"], 0);
  });

  it("does not move an outside reminder forward when its email is refused", async () => {
    m.userFindMany.mockResolvedValue([user]);
    m.revisitFindMany.mockResolvedValue([{ id: "r1", step: 0, problem: null, outsideTitle: "Two Sum" }]);
    m.sendRevisitDigest.mockResolvedValue(false);
    await runRevisitDigests(now, 200);
    expect(m.revisitUpdate).not.toHaveBeenCalled();
  });

  it("lists at most ten titles and says how many more there are", async () => {
    m.userFindMany.mockResolvedValue([user]);
    const many = Array.from({ length: 12 }, (_, i) => due(`r${i}`, `P${i}`));
    m.revisitFindMany.mockResolvedValue(many);
    m.sendRevisitDigest.mockResolvedValue(true);
    await runRevisitDigests(now, 200);
    const [, titles, more] = m.sendRevisitDigest.mock.calls[0];
    expect(titles).toHaveLength(10);
    expect(more).toBe(2);
  });

  it("only selects users who opted in and have not been emailed today", async () => {
    m.userFindMany.mockResolvedValue([]);
    await runRevisitDigests(now, 50);
    const where = m.userFindMany.mock.calls[0][0].where;
    expect(where.revisitEmails).toBe(true);
    expect(where.OR).toEqual([{ revisitEmailedAt: null }, { revisitEmailedAt: { lt: new Date("2026-10-15T00:00:00.000Z") } }]);
  });
});
