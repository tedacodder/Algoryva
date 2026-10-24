import { at, type M } from "./arrays";
import { marksOf } from "../viz/steps";
import type { ArrayGen, Step } from "./types";

/**
 * Interval scheduling: sort by end time, then take every interval that starts at or after the
 * end of the last one taken. Taking the earliest finisher first leaves the most room for later intervals.
 */
export function intervalGreedy(intervals: [number, number][]): ArrayGen {
  const sorted = [...intervals].sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  const starts = sorted.map((x) => x[0]);
  const ends = sorted.map((x) => x[1]);
  const taken: number[] = [];
  const f: Step[] = [];
  const view = (line: number, note: string, marks: M[]) =>
    f.push(at(ends, line, note, marks, { aux: [{ label: "start", values: starts, marks: marksOf() }] }));

  view(0, "Sort the intervals by end time, earliest first. The row below each end shows its start.", []);
  let last = -Infinity;
  for (let k = 0; k < sorted.length; k++) {
    const [s, e] = sorted[k];
    const lastText = last === -Infinity ? "none" : String(last);
    const first = last === -Infinity;
    view(2, first
      ? `Interval [${s}, ${e}]. Nothing is taken yet, so it is free to take.`
      : `Interval [${s}, ${e}]: its start ${s} against the last taken end ${lastText}.`, [[k, "cur"], ...taken.map((t): M => [t, "hit"])]);
    if (first || s >= last) {
      taken.push(k);
      last = e;
      view(3, `Take [${s}, ${e}]. The last end is now ${e}.`, taken.map((t): M => [t, "hit"]));
    } else {
      view(4, `${s} < ${lastText}: it overlaps a chosen interval, so skip it.`, [[k, "out"], ...taken.map((t): M => [t, "hit"])]);
    }
  }
  const chosen = taken.map((t) => `[${starts[t]}, ${ends[t]}]`).join(" ");
  view(5, `Done. ${taken.length} non-overlapping interval${taken.length === 1 ? "" : "s"}: ${chosen || "none"}.`, taken.map((t): M => [t, "hit"]));
  return { kind: "array", frames: f, result: `${taken.length} intervals` };
}
