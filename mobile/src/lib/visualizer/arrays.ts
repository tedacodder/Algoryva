import { marksOf, type Frame } from "../viz/steps";
import type { ArrayGen, Step } from "./types";

export type M = [number, string];

/** Indices 0..n-1. */
export const indices = (n: number): number[] => Array.from({ length: n }, (_, k) => k);

/**
 * Builds one array frame. Every generator goes through here, so each frame carries
 * the array values, the highlight marks, the explanation, and the pseudocode line.
 */
export function at(values: number[], line: number, note: string, marks: M[] = [], extra: Partial<Frame> = {}): Step {
  return { values: [...values], marks: marksOf(...marks), note, line, ...extra };
}

export function linearSearch(a: number[], target: number): ArrayGen {
  const f: Step[] = [at(a, 0, `Look for ${target}, checking from index 0 upward.`)];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === target) {
      f.push(at(a, 1, `a[${i}] = ${a[i]} equals ${target}.`, [[i, "hit"]]));
      f.push(at(a, 2, `Return ${i}. This is the first match.`, [[i, "hit"]]));
      return { kind: "array", frames: f, result: `index ${i}` };
    }
    f.push(at(a, 1, `a[${i}] = ${a[i]} is not ${target}. Check the next index.`, [[i, "i"]]));
  }
  f.push(at(a, 3, `Every index has been checked. ${target} is not in the array, so return -1.`));
  return { kind: "array", frames: f, result: "-1 (not found)" };
}

/** Requires a sorted array. The caller validates that. */
export function binarySearch(a: number[], target: number): ArrayGen {
  const n = a.length;
  let lo = 0;
  let hi = n - 1;
  const ends = (l: number, h: number): M[] => {
    const m: M[] = [];
    if (l >= 0 && l < n) m.push([l, "lo"]);
    if (h >= 0 && h < n) m.push([h, "hi"]);
    return m;
  };
  const outside = (l: number, h: number) => indices(n).filter((k) => k < l || k > h);
  const f: Step[] = [at(a, 0, `Set lo = 0 and hi = ${n - 1}. The search range is the whole array.`, ends(lo, hi), { dim: outside(lo, hi) })];
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = a[mid];
    f.push(at(a, 2, `mid = (${lo} + ${hi}) // 2 = ${mid}. Compare a[${mid}] = ${v} with ${target}.`, [...ends(lo, hi), [mid, "mid"]], { dim: outside(lo, hi) }));
    if (v === target) {
      f.push(at(a, 3, `${v} equals ${target}. Found it at index ${mid}.`, [[mid, "hit"]], { dim: outside(lo, hi) }));
      return { kind: "array", frames: f, result: `index ${mid}` };
    }
    if (v < target) {
      lo = mid + 1;
      f.push(at(a, 4, `${v} is less than ${target}, so every index up to ${mid} is too small. Set lo = ${lo}.`, ends(lo, hi), { dim: outside(lo, hi) }));
    } else {
      hi = mid - 1;
      f.push(at(a, 5, `${v} is greater than ${target}, so every index from ${mid} up is too large. Set hi = ${hi}.`, ends(lo, hi), { dim: outside(lo, hi) }));
    }
  }
  f.push(at(a, 6, `lo > hi, so the range is empty. ${target} is not in the array.`, [], { dim: indices(n) }));
  return { kind: "array", frames: f, result: "-1 (not found)" };
}

/** Requires a sorted array. The caller validates that. Returns the first pair found. */
export function twoPointers(a: number[], target: number): ArrayGen {
  const n = a.length;
  if (n === 0) return { kind: "array", frames: [at(a, 6, "The array is empty, so there is no pair.")], result: "no pair" };
  let i = 0;
  let j = n - 1;
  const ptrs = (): M[] => {
    const m: M[] = [];
    if (i >= 0 && i < n) m.push([i, "i"]);
    if (j >= 0 && j < n) m.push([j, "j"]);
    return m;
  };
  const outside = () => indices(n).filter((k) => k < i || k > j);
  const f: Step[] = [at(a, 0, `Set i = 0 and j = ${n - 1}, the two ends of the sorted array.`, ptrs(), { dim: outside() })];
  while (i < j) {
    const s = a[i] + a[j];
    f.push(at(a, 2, `a[${i}] + a[${j}] = ${a[i]} + ${a[j]} = ${s}. The target is ${target}.`, ptrs(), { dim: outside() }));
    if (s === target) {
      f.push(at(a, 3, `${s} equals ${target}. The pair is at indices ${i} and ${j}.`, [[i, "hit"], [j, "hit"]], { dim: outside() }));
      return { kind: "array", frames: f, result: `indices ${i} and ${j}` };
    }
    if (s < target) {
      i++;
      f.push(at(a, 4, `${s} is too small, so move i right to ${i}.`, ptrs(), { dim: outside() }));
    } else {
      j--;
      f.push(at(a, 5, `${s} is too large, so move j left to ${j}.`, ptrs(), { dim: outside() }));
    }
  }
  f.push(at(a, 6, `The pointers met without a pair that sums to ${target}.`, [], { dim: outside() }));
  return { kind: "array", frames: f, result: "no pair" };
}

/** Largest sum of any k consecutive values. Requires 1 <= k <= a.length. */
export function slidingWindowMax(a: number[], k: number): ArrayGen {
  const n = a.length;
  const win = (s: number): M[] => Array.from({ length: k }, (_, d): M => [s + d, "win"]);
  let sum = 0;
  for (let t = 0; t < k; t++) sum += a[t];
  let best = sum;
  let bestAt = 0;
  const f: Step[] = [at(a, 0, `First window a[0..${k - 1}]: sum = ${sum}. Best = ${best}.`, win(0))];
  for (let s = 1; s + k <= n; s++) {
    const enter = a[s + k - 1];
    const leave = a[s - 1];
    sum += enter - leave;
    f.push(at(a, 2, `Slide to a[${s}..${s + k - 1}]: remove ${leave}, add ${enter}. Sum = ${sum}.`, [[s - 1, "out"], [s + k - 1, "add"], ...win(s)]));
    const beats = sum > best;
    if (beats) { best = sum; bestAt = s; }
    f.push(at(a, 3, beats ? `${sum} beats the old best, so best = ${best}.` : `${sum} does not beat the best ${best}.`, win(s)));
  }
  f.push(at(a, 4, `Done. The largest window sum is ${best}, starting at index ${bestAt}.`, win(bestAt)));
  return { kind: "array", frames: f, result: `sum ${best}` };
}

/** Builds the prefix array P, then answers each inclusive query [l, r] as P[r+1] - P[l]. Queries must be valid. */
export function prefixSums(a: number[], queries: [number, number][]): ArrayGen {
  const P: number[] = [0];
  const row = (marks: M[]) => [{ label: "prefix P", values: [...P], marks: marksOf(...marks) }];
  const f: Step[] = [at(a, 0, "P[0] = 0. The empty prefix sums to 0.", [], { aux: row([[0, "new"]]) })];
  for (let i = 1; i <= a.length; i++) {
    P.push(P[i - 1] + a[i - 1]);
    f.push(at(a, 1, `P[${i}] = P[${i - 1}] + a[${i - 1}] = ${P[i - 1]} + ${a[i - 1]} = ${P[i]}.`, [[i - 1, "cmp"]], { aux: row([[i, "new"]]) }));
  }
  const answers: number[] = [];
  for (const [l, r] of queries) {
    const ans = P[r + 1] - P[l];
    answers.push(ans);
    const span = Array.from({ length: r - l + 1 }, (_, d): M => [l + d, "win"]);
    f.push(at(a, 2, `Sum of a[${l}..${r}] = P[${r + 1}] - P[${l}] = ${P[r + 1]} - ${P[l]} = ${ans}.`, span, { aux: row([[l, "lo"], [r + 1, "hi"]]) }));
  }
  f.push(at(a, 3, answers.length ? `Answers: ${answers.join(", ")}.` : "No queries to answer.", [], { aux: row([]) }));
  return { kind: "array", frames: f, result: answers.join(", ") };
}

/** Visits every element once, keeping the running maximum. */
export function arrayTraversal(a: number[]): ArrayGen {
  if (a.length === 0) return { kind: "array", frames: [at(a, 0, "The array is empty, so there is nothing to visit.")], result: "none" };
  let best = a[0];
  const f: Step[] = [at(a, 0, `best = a[0] = ${best}. Now visit every index.`, [[0, "i"]])];
  for (let i = 0; i < a.length; i++) {
    if (a[i] > best) {
      best = a[i];
      f.push(at(a, 2, `a[${i}] = ${a[i]} is bigger than the best so far, so best = ${best}.`, [[i, "hit"]]));
    } else {
      f.push(at(a, 2, `a[${i}] = ${a[i]} is not bigger than ${best}.`, [[i, "i"]]));
    }
  }
  f.push(at(a, 3, `Done. The largest value is ${best}.`, [[a.indexOf(best), "hit"]]));
  return { kind: "array", frames: f, result: `max ${best}` };
}
