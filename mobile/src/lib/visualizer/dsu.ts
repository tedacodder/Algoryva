import { marksOf } from "../viz/steps";
import { at, indices, type M } from "./arrays";
import type { ArrayGen, Step } from "./types";

export type DsuOp = { name: "union"; a: number; b: number } | { name: "find"; a: number };

/** Union by size: parent[] holds links, size[] holds set sizes, and find climbs parent links to the root. */
export function dsuOps(n: number, ops: DsuOp[]): ArrayGen {
  const parent = indices(n);
  const size: number[] = indices(n).map(() => 1);
  const f: Step[] = [];
  const frame = (line: number, note: string, marks: M[] = []): Step =>
    at(parent, line, note, marks, { aux: [{ label: "size", values: [...size], marks: marksOf() }] });

  const find = (x: number, show: boolean): number => {
    const path: number[] = [x];
    let r = x;
    while (parent[r] !== r) {
      r = parent[r];
      path.push(r);
    }
    if (show) {
      const marks: M[] = path.map((p, i): M => [p, i === path.length - 1 ? "hit" : "cur"]);
      f.push(frame(1, path.length === 1 ? `find(${x}): ${x} is its own root.` : `find(${x}): follow parent links ${path.join(" → ")} to root ${r}.`, marks));
    }
    // Path compression: every node on the path now points straight at the root.
    const shortened = path.slice(0, -1).some((p) => parent[p] !== r);
    if (shortened) {
      for (const p of path) parent[p] = r;
      if (show) f.push(frame(2, `Path compression: point ${path.slice(0, -1).join(", ")} directly at root ${r}.`, path.slice(0, -1).map((p): M => [p, "swap"])));
    }
    return r;
  };

  f.push(frame(0, "Every node starts as its own set, with parent[i] = i and size 1."));
  for (const op of ops) {
    if (op.name === "find") {
      const r = find(op.a, true);
      f.push(frame(6, `find(${op.a}) returns root ${r}. Its set has ${size[r]} node${size[r] === 1 ? "" : "s"}.`, [[r, "hit"]]));
      continue;
    }
    const ra = find(op.a, true);
    const rb = find(op.b, true);
    f.push(frame(3, `union(${op.a}, ${op.b}): the roots are ${ra} and ${rb}.`, [[ra, "cur"], [rb, "cur"]]));
    if (ra === rb) {
      f.push(frame(4, `Both are in the same set already, so there is nothing to merge.`, [[ra, "done"]]));
      continue;
    }
    const [big, small] = size[ra] >= size[rb] ? [ra, rb] : [rb, ra];
    parent[small] = big;
    size[big] += size[small];
    f.push(frame(5, `Attach root ${small} under root ${big}. The merged set has ${size[big]} nodes.`, [[small, "swap"], [big, "done"]]));
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    groups.set(r, [...(groups.get(r) ?? []), i]);
  }
  const sets = [...groups.values()].map((m) => `{${m.join(",")}}`).join(" ");
  f.push(frame(6, `Final sets: ${sets}.`));
  return { kind: "array", frames: f, result: sets };
}
