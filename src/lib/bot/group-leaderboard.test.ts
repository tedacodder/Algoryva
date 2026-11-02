import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { periodStart, rankRows, scoreMember } from "@/lib/bot/group-leaderboard";

const NOW = new Date("2026-10-31T12:00:00Z");
const T = Math.floor(NOW.getTime() / 1000);
const DAY = 86_400;
const solve = (ref: string, daysAgo: number) => ({ ref, at: T - daysAgo * DAY });

describe("period", () => {
  it("week and month start 7 and 30 days back; all-time starts at the beginning", () => {
    expect(periodStart("week", NOW)).toBe(T - 7 * DAY);
    expect(periodStart("month", NOW)).toBe(T - 30 * DAY);
    expect(periodStart("all", NOW)).toBe(0);
  });
});

describe("scoring", () => {
  it("counts only problems solved inside the period, and active days", () => {
    const m = scoreMember("alice", 1500, [solve("1/A", 1), solve("1/B", 1), solve("1/C", 3), solve("1/D", 20)], "week", NOW);
    expect(m.solved).toBe(3); // the 20-day-old solve is outside the week
    expect(m.activeDays).toBe(2); // two distinct days
    expect(m.score).toBe(3 + 2 * 2);
    expect(m.consistency).toBe(Math.round((2 / 7) * 100));
  });

  it("consistency is capped at 100 and all-time uses the days since the first solve", () => {
    const busy = scoreMember("bob", null, [solve("1/A", 0), solve("1/B", 0), solve("1/C", 1)], "week", NOW);
    expect(busy.consistency).toBeLessThanOrEqual(100);
    const all = scoreMember("cara", null, [solve("1/A", 9), solve("1/B", 0)], "all", NOW);
    expect(all.consistency).toBe(Math.round((2 / 10) * 100));
  });

  it("no solves in the period gives a zero row, not an error", () => {
    const m = scoreMember("dan", 1200, [solve("1/A", 60)], "week", NOW);
    expect(m).toMatchObject({ solved: 0, activeDays: 0, score: 0, consistency: 0 });
  });
});

describe("ranking", () => {
  it("orders by score, then consistency, then rating, then handle, and shares ranks on a tie", () => {
    const rows = rankRows([
      { handle: "zed", rating: 1200, solved: 2, activeDays: 1, consistency: 14, score: 4 },
      { handle: "amy", rating: 1600, solved: 5, activeDays: 3, consistency: 43, score: 11 },
      { handle: "bob", rating: 1900, solved: 5, activeDays: 3, consistency: 43, score: 11 },
      { handle: "cy", rating: 1000, solved: 2, activeDays: 1, consistency: 14, score: 4 },
    ]);
    expect(rows.map((r) => r.handle)).toEqual(["bob", "amy", "zed", "cy"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3, 3]);
  });

  it("is deterministic: the same input always gives the same order", () => {
    const input = [
      { handle: "b", rating: null, solved: 1, activeDays: 1, consistency: 14, score: 3 },
      { handle: "a", rating: null, solved: 1, activeDays: 1, consistency: 14, score: 3 },
    ];
    expect(rankRows(input).map((r) => r.handle)).toEqual(["a", "b"]);
    expect(rankRows([...input].reverse()).map((r) => r.handle)).toEqual(["a", "b"]);
  });
});
