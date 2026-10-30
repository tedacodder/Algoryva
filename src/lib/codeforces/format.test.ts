import { describe, expect, it } from "vitest";
import { describeFilter, eatStamp, formatContestList, formatContestPosted, formatContestTwoHours, formatDaily, formatRandom, seededRng, utcStamp } from "@/lib/codeforces/format";

const PROBLEM = { contestId: 1800, index: "C", name: "Balanced Shuffle", rating: 1100, tags: ["greedy", "sortings"] };
const CONTEST = { id: 2001, name: "Round Five", startTimeSeconds: Date.parse("2026-10-27T14:35:00Z") / 1000, durationSeconds: 7200, phase: "BEFORE" };

describe("daily and random messages", () => {
  it("link the official problem, show the rating, and never copy a statement", () => {
    const text = formatDaily(PROBLEM, "2026-10-26", { rng: seededRng("x") });
    expect(text).toContain("https://codeforces.com/problemset/problem/1800/C");
    expect(text).toContain("Rating 1100");
    expect(text).toContain("2026-10-26 UTC");
  });

  it("the same seed gives the same wording, so a daily message does not change on refresh", () => {
    expect(formatDaily(PROBLEM, "2026-10-26", { rng: seededRng("chat|day") })).toBe(formatDaily(PROBLEM, "2026-10-26", { rng: seededRng("chat|day") }));
  });

  it("different seeds vary the wording", () => {
    const texts = new Set(Array.from({ length: 30 }, (_, i) => formatRandom(PROBLEM, { minRating: 800, maxRating: 2000, tags: [] }, { rng: seededRng(`s${i}`) })));
    expect(texts.size).toBeGreaterThan(1);
  });

  it("says when problems solved by the student are skipped", () => {
    expect(formatRandom(PROBLEM, { minRating: 800, maxRating: 2000, tags: [] }, { personalized: true })).toContain("already solved");
    expect(formatRandom(PROBLEM, { minRating: 800, maxRating: 2000, tags: [] }, { personalized: false })).not.toContain("already solved");
  });

  it("describes a rating band and tags", () => {
    expect(describeFilter({ minRating: 1200, maxRating: 1600, tags: ["dp", "graphs"] })).toBe("🎚️ Rating 1200–1600   🏷️ #dp #graphs");
    expect(describeFilter({ minRating: 1400, maxRating: 1400, tags: [] })).toBe("🎚️ Rating 1400");
  });
});

describe("contest messages", () => {
  it("the posted message gives the UTC and Ethiopian start times and the official page, and says registration is on Codeforces", () => {
    const text = formatContestPosted(CONTEST);
    expect(text).toContain("2026-10-27 14:35 UTC");
    expect(text).toContain("17:35 EAT");
    expect(text).toContain("https://codeforces.com/contests/2001");
    expect(text).toContain("cannot register you");
  });

  it("the two-hour message is different and still links the official page", () => {
    const text = formatContestTwoHours(CONTEST);
    expect(text).toContain("https://codeforces.com/contests/2001");
    expect(text).toContain("Registration happens on Codeforces");
  });

  it("the list says so when nothing is upcoming", () => {
    expect(formatContestList([])).toMatch(/No upcoming/);
  });

  it("time helpers are exact", () => {
    expect(utcStamp(0)).toBe("1970-01-01 00:00 UTC");
    expect(eatStamp(0)).toBe("03:00 EAT");
  });
});
