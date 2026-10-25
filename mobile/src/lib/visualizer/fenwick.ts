import { at, indices, type M } from "./arrays";
import type { ArrayGen, Step } from "./types";

export type FenOp = { name: "add"; i: number; d: number } | { name: "query"; i: number };

/** Fenwick tree with 1-based indices. tree[i] holds the sum of the block of values that ends at i; index 0 is unused. */
export function fenwickOps(values: number[], ops: FenOp[]): ArrayGen {
  const n = values.length;
  const tree: number[] = indices(n + 1).map(() => 0);
  const f: Step[] = [];
  const show = (line: number, note: string, marks: M[] = []) => f.push(at(tree, line, note, marks));

  const add = (i0: number, d: number) => {
    let i = i0;
    while (i <= n) {
      tree[i] += d;
      show(1, `tree[${i}] += ${d}, so tree[${i}] = ${tree[i]}. The next index is ${i + (i & -i)}.`, [[i, "cur"]]);
      i += i & -i;
    }
  };

  show(0, "Index 0 is unused. Build the tree by adding each value at its own index.");
  for (let i = 1; i <= n; i++) add(i, values[i - 1]);

  const answers: number[] = [];
  for (const op of ops) {
    if (op.name === "add") {
      show(1, `Add ${op.d} at index ${op.i}.`, [[op.i, "hit"]]);
      add(op.i, op.d);
      continue;
    }
    let i = op.i;
    let sum = 0;
    const path: number[] = [];
    while (i > 0) {
      sum += tree[i];
      path.push(i);
      i -= i & -i;
    }
    answers.push(sum);
    const note = path.length === 0
      ? `query(0) is an empty prefix, so the sum is 0.`
      : `query(${op.i}) adds ${path.map((p) => `tree[${p}]`).join(" + ")} = ${sum}.`;
    show(2, note, path.map((p): M => [p, "hit"]));
  }
  show(3, answers.length ? `Query results: ${answers.join(", ")}.` : "The tree is built.");
  return { kind: "array", frames: f, result: answers.length ? `queries ${answers.join(", ")}` : "built" };
}
