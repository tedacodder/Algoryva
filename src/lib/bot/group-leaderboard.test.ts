import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { periodDays, periodStart, rankRows, scoreMember } from "@/lib/bot/group-leaderboard";

const NOW = new Date("2026-10-31T12:00:00Z"); // a Saturday
const T = Math.floor(NOW.getTime() / 1000);
const DAY = 86_400;
const solve = (ref: string, daysAgo: number) => ({ ref, at: T - daysAgo * DAY });

describe("calendar periods (UTC)", () => {
  it("the week starts on Monday, the month on the 1st, and all-time at the beginning", () => {
    expect(new Date(periodStart("week", NOW) * 1000).toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(new Date(periodStart("month", NOW) * 1000).toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(periodStart("all", NOW)).toBe(0);
  });

  it("counts the days so far in the period", () => {
    expect(periodDays("week", NOW)).toBe(6);
    expect(periodDays("month", NOW)).toBe(31);
    expect(periodDays("all", NOW)).toBeNull();
  });
});

describe("scoring from stored solves", () => {
  it("counts only solves inside the calendar week, and active days", () => {
    const m = scoreMember("alice", 1500, [solve("1/A", 1), solve("1/B", 1), solve("1/C", 3), solve("1/D", 20)], "week", NOW);
    expect(m.solved).toBe(3); // the 20-day-old solve is before this week
    expect(m.activeDays).toBe(2);
    expect(m.consistency).toBe(Math.round((2 / 6) * 100));
    expect(m.score).toBe(3 + 2 * 2);
  });

  it("the month includes solves from earlier in the month, not from last month", () => {
    const m = scoreMember("bob", null, [solve("2/A", 20), solve("2/B", 40)], "month", NOW);
    expect(m.solved).toBe(1);
  });

  it("consistency is capped at 100, and all-time is measured from the first solve", () => {
    const busy = scoreMember("cara", null, [solve("1/A", 0), solve("1/B", 0), solve("1/C", 1)], "week", NOW);
    expect(busy.consistency).toBeLessThanOrEqual(100);
    const all = scoreMember("dan", null, [solve("1/A", 9), solve("1/B", 0)], "all", NOW);
    expect(all.consistency).toBe(Math.round((2 / 10) * 100));
  });

  it("no solves in the period gives a zero row, not an error", () => {
    expect(scoreMember("eve", 1200, [solve("1/A", 60)], "week", NOW)).toMatchObject({ solved: 0, activeDays: 0, score: 0, consistency: 0 });
  });
});

describe("ranking", () => {
  it("orders by score, then consistency, rating and handle, and shares ranks on a tie", () => {
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
