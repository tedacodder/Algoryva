export type Cell = number | string;
export type Marks = Record<number, string[]>;
/** A second row drawn under the main array (prefix array, result array, sizes, ...). */
export type Aux = { label: string; values: Cell[]; marks: Marks };
export type Frame = {
  values: Cell[]; marks: Marks; note: string;
  aux?: Aux[];
  /** Indices drawn faded: the part of the data that has been ruled out. */
  dim?: number[];
  /** A stack / queue drawn beside the array. Items are listed bottom-to-top for stacks and front-to-back for queues. */
  structure?: { label: string; items: string[] };
};
export const marksOf = (...m: [number, string][]): Marks => {
  const marks: Marks = {};
  for (const [i, l] of m) (marks[i] ??= []).push(l);
  return marks;
};
export const mk = (values: Cell[], note: string, ...m: [number, string][]): Frame => ({ values: [...values], marks: marksOf(...m), note });

export type GraphFrame = {
  nodes: { id: string; x: number; y: number; label?: string }[];
  /** w: weight drawn on the edge. mark: pick = chosen, skip = rejected, cur = being considered. */
  edges: { a: string; b: string; directed?: boolean; w?: number; mark?: "pick" | "skip" | "cur" }[];
  /** queued: waiting in the structure; cur: being processed; done: finished; hit: answered from cache. Absent: not reached yet. */
  state: Record<string, "queued" | "cur" | "done" | "hit">;
  text: Record<string, string>; // label drawn under a node (for example a returned value)
  structure: { label: string; items: string[] };
  order: string[];
  note: string;
};
export type GridFrame = {
  rowLabels: Cell[]; colLabels: Cell[];
  cells: (Cell | null)[][];
  active?: [number, number];
  deps?: [number, number][];
  note: string;
};
export type Viz =
  | { kind: "array"; title: string; frames: Frame[] }
  | { kind: "graph"; title: string; frames: GraphFrame[] }
  | { kind: "grid"; title: string; frames: GridFrame[] };

export function binarySearchSteps(values: number[], target: number): Frame[] {
  const f: Frame[] = [];
  let lo = 0, hi = values.length - 1;
  const out = (l: number, h: number) => values.map((_, i) => i).filter((i) => i < l || i > h);
  f.push({ ...mk(values, `Search for ${target} in a sorted array.`, [lo, "lo"], [hi, "hi"]), dim: out(lo, hi) });
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = values[mid];
    if (v === target) { f.push({ ...mk(values, `values[${mid}] = ${v} equals ${target}. Found at index ${mid}.`, [lo, "lo"], [hi, "hi"], [mid, "mid"]), dim: out(lo, hi) }); return f; }
    f.push({ ...mk(values, `values[${mid}] = ${v} is ${v < target ? "less" : "greater"} than ${target}, so every value ${v < target ? "at or left of" : "at or right of"} index ${mid} is ruled out.`, [lo, "lo"], [hi, "hi"], [mid, "mid"]), dim: out(lo, hi) });
    if (v < target) lo = mid + 1; else hi = mid - 1;
  }
  f.push({ ...mk(values, `The range is empty. ${target} is not in the array.`), dim: values.map((_, i) => i) });
  return f;
}

export function bubbleSortSteps(input: number[]): Frame[] {
  const a = [...input], f: Frame[] = [mk(a, "Start: compare neighbours and swap if out of order.")];
  for (let end = a.length - 1; end > 0; end--) {
    for (let i = 0; i < end; i++) {
      f.push(mk(a, `Compare ${a[i]} and ${a[i + 1]}.`, [i, "cmp"], [i + 1, "cmp"]));
      if (a[i] > a[i + 1]) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; f.push(mk(a, `Swap: ${a[i + 1]} moves right.`, [i, "swap"], [i + 1, "swap"])); }
    }
  }
  f.push(mk(a, "Sorted."));
  return f;
}

export function pairSumSteps(values: number[], target: number): Frame[] {
  const f: Frame[] = [];
  let i = 0, j = values.length - 1;
  while (i < j) {
    const s = values[i] + values[j];
    if (s === target) { f.push(mk(values, `${values[i]} + ${values[j]} = ${s}. Pair found.`, [i, "i"], [j, "j"])); return f; }
    f.push(mk(values, `${values[i]} + ${values[j]} = ${s}, ${s < target ? "too small: move i right" : "too large: move j left"}.`, [i, "i"], [j, "j"]));
    if (s < target) i++; else j--;
  }
  f.push(mk(values, `Pointers met. No pair sums to ${target}.`));
  return f;
}

export function slidingWindowSteps(values: number[], k: number): Frame[] {
  const f: Frame[] = [];
  let sum = 0, best = -Infinity;
  const win = (l: number): [number, string][] => Array.from({ length: k }, (_, d) => [l + d, "win"] as [number, string]);
  for (let i = 0; i < k; i++) sum += values[i];
  best = sum;
  f.push(mk(values, `First window sum = ${sum}. Best = ${best}.`, ...win(0)));
  for (let l = 1; l + k <= values.length; l++) {
    sum += values[l + k - 1] - values[l - 1];
    best = Math.max(best, sum);
    f.push(mk(values, `Add ${values[l + k - 1]}, remove ${values[l - 1]}: sum = ${sum}. Best = ${best}.`, ...win(l)));
  }
  return f;
}
