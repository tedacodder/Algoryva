import { describe, expect, it } from "vitest";
import { matchesFilter, contestsStartingWithin, pickDailyProblem, problemRef, type CfContest, type CfProblem } from "@/lib/codeforces/pick";

const p = (contestId: number, index: string, rating?: number): CfProblem => ({ contestId, index, name: `P${contestId}${index}`, rating, tags: [] });
const pool = [p(1, "A", 900), p(2, "B", 1000), p(3, "C", 1200), p(4, "D", 1500), p(5, "E", undefined), p(6, "F", 700)];

describe("pickDailyProblem", () => {
  it("returns the same problem for the same seed", () => {
    expect(pickDailyProblem(pool, "chat|2026-10-26")).toEqual(pickDailyProblem(pool, "chat|2026-10-26"));
  });

  it("spreads different seeds over different problems", () => {
    const picks = new Set(Array.from({ length: 60 }, (_, i) => problemRef(pickDailyProblem(pool, `chat-${i}|day`)!)));
    expect(picks.size).toBeGreaterThan(1);
  });

  it("stays inside the rating band, and never picks an unrated problem", () => {
    for (let i = 0; i < 100; i++) {
      const pick = pickDailyProblem(pool, `s${i}`)!;
      expect(pick.rating).toBeGreaterThanOrEqual(800);
      expect(pick.rating).toBeLessThanOrEqual(1400);
    }
  });

  it("skips problems recently sent when another choice exists", () => {
    // In-band problems are 1/A (900), 2/B (1000) and 3/C (1200). Excluding two of them leaves only 3/C.
    const exclude = new Set(["1/A", "2/B"]);
    for (let i = 0; i < 20; i++) {
      expect(problemRef(pickDailyProblem(pool, `s${i}`, exclude)!)).toBe("3/C");
    }
  });

  it("falls back to repeats only when everything in range was recently sent", () => {
    const exclude = new Set(["1/A", "2/B", "3/C"]);
    expect(pickDailyProblem(pool, "x", exclude)).not.toBeNull();
  });

  it("returns null when no problem is in the band", () => {
    expect(pickDailyProblem([p(9, "Z", 3000)], "x")).toBeNull();
    expect(pickDailyProblem([], "x")).toBeNull();
  });
});

describe("contestsStartingWithin", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const at = (minutes: number, phase = "BEFORE"): CfContest => ({
    id: 1000 + minutes,
    name: `C${minutes}`,
    startTimeSeconds: Math.floor(now.getTime() / 1000) + minutes * 60,
    durationSeconds: 7200,
    phase,
  });

  it("includes a contest that starts within the next ten minutes", () => {
    expect(contestsStartingWithin([at(5)], now).map((c) => c.id)).toEqual([1005]);
  });

  it("includes a contest at exactly ten minutes, and excludes one a second later", () => {
    expect(contestsStartingWithin([at(10)], now)).toHaveLength(1);
    const later = { ...at(10), startTimeSeconds: at(10).startTimeSeconds + 1 };
    expect(contestsStartingWithin([later], now)).toHaveLength(0);
  });

  it("excludes contests that already started, finished, or are far away", () => {
    expect(contestsStartingWithin([at(0), at(-5), at(5, "FINISHED"), at(30)], now)).toHaveLength(0);
  });

  it("returns the earliest first", () => {
    expect(contestsStartingWithin([at(8), at(2), at(5)], now).map((c) => c.id)).toEqual([1002, 1005, 1008]);
  });
});

describe("tags", () => {
  it("a dash and a space name the same tag", () => {
    const p = { contestId: 1, index: "A", name: "x", rating: 1500, tags: ["dfs and similar"] };
    expect(matchesFilter(p, { minRating: 800, maxRating: 2000, tags: ["dfs-and-similar"] })).toBe(true);
    expect(matchesFilter(p, { minRating: 800, maxRating: 2000, tags: ["dfs and similar"] })).toBe(true);
    expect(matchesFilter(p, { minRating: 800, maxRating: 2000, tags: ["dp"] })).toBe(false);
  });
});
