import { describe, expect, it } from "vitest";
import { parseStandings } from "@/lib/codeforces/standings";

const sample = {
  contest: { name: "Round 900 (Div. 2)", phase: "FINISHED" },
  rows: [
    { rank: 1, points: 4000, penalty: 90, party: { members: [{ handle: "tourist" }] }, problemResults: [{ points: 1000 }, { points: 1500 }, { points: 0 }, { points: 1500 }] },
    { rank: 7, points: 2000, penalty: 300, party: { members: [{ handle: "amy" }] }, problemResults: [{ points: 0 }, { points: 2000 }] },
  ],
};

describe("parseStandings", () => {
  it("reads the contest and one row per participant, counting only solved problems", () => {
    const s = parseStandings(sample);
    expect(s.contest).toEqual({ name: "Round 900 (Div. 2)", phase: "FINISHED" });
    expect(s.rows).toEqual([
      { handle: "tourist", rank: 1, points: 4000, penalty: 90, solved: 3 },
      { handle: "amy", rank: 7, points: 2000, penalty: 300, solved: 1 },
    ]);
  });

  it("an empty response gives no rows instead of an error", () => {
    expect(parseStandings({}).rows).toEqual([]);
  });
});
