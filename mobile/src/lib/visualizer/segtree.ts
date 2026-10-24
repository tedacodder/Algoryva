import type { GraphGen, GraphStep } from "./types";
import type { St } from "./graphs";

export type SegOp = { name: "query"; l: number; r: number } | { name: "update"; i: number; v: number };

/**
 * Range-minimum segment tree with heap indexing: node k has children 2k and 2k+1.
 * Each node covers a range [l, r] and stores the minimum of that range.
 * Node positions depend only on k, so a node stays in the same place in every frame.
 */
export function segmentTreeOps(values: number[], ops: SegOp[]): GraphGen {
  const n = values.length;
  const lo = new Map<number, number>();
  const hi = new Map<number, number>();
  const val = new Map<number, number>();
  const built = new Set<number>();
  const f: GraphStep[] = [];

  const pos = (k: number) => {
    const d = Math.floor(Math.log2(k));
    const j = k - (1 << d);
    return { x: ((j + 0.5) * 300) / (1 << d), y: 30 + d * 62 };
  };
  const snap = (line: number, note: string, states: Record<number, St> = {}): GraphStep => {
    const keys = [...built];
    const edges: { a: string; b: string }[] = [];
    for (const k of keys) {
      for (const c of [2 * k, 2 * k + 1]) if (built.has(c)) edges.push({ a: String(k), b: String(c) });
    }
    const st: Record<string, St> = {};
    for (const [k, s] of Object.entries(states)) st[k] = s;
    const text: Record<string, string> = {};
    for (const k of keys) text[String(k)] = `[${lo.get(k)},${hi.get(k)}]`;
    return {
      line,
      note,
      nodes: keys.map((k) => ({ id: String(k), x: pos(k).x, y: pos(k).y, label: String(val.get(k)) })),
      edges,
      state: st,
      text,
      structure: { label: "Array", items: values.map(String) },
      order: [],
    };
  };

  const build = (k: number, l: number, r: number): void => {
    lo.set(k, l);
    hi.set(k, r);
    if (l === r) {
      val.set(k, values[l]);
      built.add(k);
      f.push(snap(0, `Leaf [${l}, ${l}] stores a[${l}] = ${values[l]}.`, { [k]: "cur" }));
      return;
    }
    const m = (l + r) >> 1;
    build(2 * k, l, m);
    build(2 * k + 1, m + 1, r);
    const a = val.get(2 * k) ?? 0;
    const b = val.get(2 * k + 1) ?? 0;
    val.set(k, Math.min(a, b));
    built.add(k);
    f.push(snap(0, `[${l}, ${r}] stores the smaller of its halves: min(${a}, ${b}) = ${Math.min(a, b)}.`, { [k]: "cur" }));
  };

  const query = (k: number, ql: number, qr: number): number => {
    const l = lo.get(k) ?? 0;
    const r = hi.get(k) ?? 0;
    if (r < ql || l > qr) {
      f.push(snap(1, `[${l}, ${r}] lies outside [${ql}, ${qr}], so it adds nothing.`));
      return Infinity;
    }
    if (ql <= l && r <= qr) {
      const v = val.get(k) ?? 0;
      f.push(snap(1, `[${l}, ${r}] lies inside [${ql}, ${qr}], so use its stored minimum ${v} and stop.`, { [k]: "hit" }));
      return v;
    }
    f.push(snap(1, `[${l}, ${r}] only partly overlaps [${ql}, ${qr}], so ask both halves.`, { [k]: "cur" }));
    const left = query(2 * k, ql, qr);
    const right = query(2 * k + 1, ql, qr);
    return Math.min(left, right);
  };

  const update = (k: number, i: number, v: number): void => {
    const l = lo.get(k) ?? 0;
    const r = hi.get(k) ?? 0;
    if (l === r) {
      val.set(k, v);
      f.push(snap(2, `Leaf [${l}, ${l}] is set to ${v}.`, { [k]: "hit" }));
      return;
    }
    const m = (l + r) >> 1;
    const goLeft = i <= m;
    f.push(snap(2, `Index ${i} is in the ${goLeft ? "left" : "right"} half of [${l}, ${r}], so go there.`, { [k]: "cur" }));
    update(goLeft ? 2 * k : 2 * k + 1, i, v);
    const a = val.get(2 * k) ?? 0;
    const b = val.get(2 * k + 1) ?? 0;
    val.set(k, Math.min(a, b));
    f.push(snap(2, `Recompute [${l}, ${r}] as min(${a}, ${b}) = ${Math.min(a, b)} on the way back up.`, { [k]: "done" }));
  };

  build(1, 0, n - 1);
  const answers: string[] = [];
  for (const op of ops) {
    if (op.name === "query") {
      const got = query(1, op.l, op.r);
      answers.push(`min[${op.l}..${op.r}] = ${got}`);
      f.push(snap(1, `Answer: the minimum of a[${op.l}..${op.r}] is ${got}.`, { 1: "cur" }));
    } else {
      update(1, op.i, op.v);
      f.push(snap(2, `Update done: a[${op.i}] = ${op.v}. The root now stores ${val.get(1)}.`, { 1: "cur" }));
    }
  }
  return { kind: "graph", frames: f, result: answers.length ? answers.join(", ") : "built" };
}
