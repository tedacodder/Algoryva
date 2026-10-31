import { describe, expect, it } from "vitest";
import { soonestFirst, type CfContest } from "@/lib/codeforces/pick";

const contest = (id: number, startTimeSeconds: number): CfContest => ({ id, name: `C${id}`, startTimeSeconds, durationSeconds: 7200, phase: "BEFORE" });

describe("soonestFirst", () => {
  it("orders contests from the earliest start to the latest, without changing the input", () => {
    const input = [contest(1, 300), contest(2, 100), contest(3, 200)];
    expect(soonestFirst(input).map((c) => c.id)).toEqual([2, 3, 1]);
    expect(input.map((c) => c.id)).toEqual([1, 2, 3]);
  });
});
