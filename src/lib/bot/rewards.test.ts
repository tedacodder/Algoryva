import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { PODIUM_MIN_SOLVED, STEADY_MIN_DAYS, podiumFrom, previousWeek, steadyUsers, weekStart } from "@/lib/bot/rewards";

const DAY = 86_400_000;

describe("week boundaries (UTC, Monday to Sunday)", () => {
  it("a Sunday belongs to the week that started the Monday before", () => {
    expect(weekStart(new Date("2026-10-25T23:59:00Z")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });

  it("Monday 00:00 starts a new week", () => {
    expect(weekStart(new Date("2026-10-26T00:00:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(weekStart(new Date("2026-10-25T23:59:59.999Z")).toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });

  it("the previous week is the complete week before, keyed by its Monday", () => {
    const w = previousWeek(new Date("2026-10-28T10:00:00Z"));
    expect(w.key).toBe("2026-10-19");
    expect(w.start.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(w.end.getTime() - w.start.getTime()).toBe(7 * DAY);
  });
});

describe("podium", () => {
  const r = (userId: string, solved: number, score = solved) => ({ userId, username: userId, score, solved });

  it("takes the top three in board order, with ranks 1 to 3", () => {
    expect(podiumFrom([r("a", 5), r("b", 4), r("c", 3), r("d", 2)])).toEqual([
      { userId: "a", rank: 1, solved: 5 },
      { userId: "b", rank: 2, solved: 4 },
      { userId: "c", rank: 3, solved: 3 },
    ]);
  });

  it("needs the minimum number of counted solves, so a near-empty board awards nothing", () => {
    expect(PODIUM_MIN_SOLVED).toBe(3);
    expect(podiumFrom([r("a", 2), r("b", 1)])).toEqual([]);
  });

  it("skips entries below the minimum and fills the podium from the rest", () => {
    expect(podiumFrom([r("a", 1), r("b", 3)])).toEqual([{ userId: "b", rank: 1, solved: 3 }]);
  });
});

describe("steady week", () => {
  const solve = (userId: string, day: number) => ({ userId, solvedAt: new Date(Date.UTC(2026, 9, 19) + day * DAY + 3_600_000) });

  it("counts distinct UTC days, not solves", () => {
    const rows = [solve("a", 0), solve("a", 0), solve("a", 0), solve("a", 1)];
    expect(steadyUsers(rows)).toEqual([]);
  });

  it(`needs at least ${STEADY_MIN_DAYS} different days`, () => {
    const four = [0, 1, 2, 3].map((d) => solve("a", d));
    const five = [0, 1, 2, 3, 4].map((d) => solve("a", d));
    expect(steadyUsers(four)).toEqual([]);
    expect(steadyUsers(five)).toEqual([{ userId: "a", days: 5 }]);
  });

  it("evaluates each user separately", () => {
    const rows = [0, 1, 2, 3, 4].map((d) => solve("a", d)).concat([0, 1].map((d) => solve("b", d)));
    expect(steadyUsers(rows).map((u) => u.userId)).toEqual(["a"]);
  });
});
