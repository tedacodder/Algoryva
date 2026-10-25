import type { ArrayGen, GraphGen, GraphStep, Op, Step } from "./types";
import { at } from "./arrays";

/** Operations on a stack. Items are listed bottom to top, so the top is on the right. */
export function stackOps(ops: Op[]): ArrayGen {
  const items: number[] = [];
  const popped: number[] = [];
  const f: Step[] = [];
  const view = (line: number, note: string) =>
    f.push(at([], line, note, [], { structure: { label: "Stack (top on the right)", items: items.map(String) } }));
  view(0, "Start with an empty stack.");
  for (const op of ops) {
    const arg = op.arg ?? 0;
    if (op.name === "push") {
      items.push(arg);
      view(0, `push ${arg}: ${arg} becomes the new top.`);
    } else if (op.name === "pop") {
      if (items.length === 0) {
        view(1, "pop on an empty stack is an underflow. Nothing is removed.");
      } else {
        const x = items.pop() ?? 0;
        popped.push(x);
        view(1, `pop removes and returns ${x}, the old top.`);
      }
    } else {
      const top = items[items.length - 1];
      view(2, top === undefined ? "peek on an empty stack: there is no top to read." : `peek reads ${top} and leaves the stack unchanged.`);
    }
  }
  return {
    kind: "array",
    frames: f,
    result: `stack ${items.length ? `[${items.join(", ")}]` : "empty"}; popped ${popped.length ? popped.join(", ") : "nothing"}`,
  };
}

/** Operations on a queue. Items are listed front to back, so the front is on the left. */
export function queueOps(ops: Op[]): ArrayGen {
  const items: number[] = [];
  const removed: number[] = [];
  const f: Step[] = [];
  const view = (line: number, note: string) =>
    f.push(at([], line, note, [], { structure: { label: "Queue (front on the left)", items: items.map(String) } }));
  view(0, "Start with an empty queue.");
  for (const op of ops) {
    const arg = op.arg ?? 0;
    if (op.name === "enqueue") {
      items.push(arg);
      view(0, `enqueue ${arg}: it joins at the back.`);
    } else if (op.name === "dequeue") {
      if (items.length === 0) {
        view(1, "dequeue on an empty queue is an underflow. Nothing is removed.");
      } else {
        const x = items.shift() ?? 0;
        removed.push(x);
        view(1, `dequeue removes and returns ${x} from the front.`);
      }
    } else {
      const front = items[0];
      view(2, front === undefined ? "front on an empty queue: there is nothing to read." : `front reads ${front} and leaves the queue unchanged.`);
    }
  }
  return {
    kind: "array",
    frames: f,
    result: `queue ${items.length ? `[${items.join(", ")}]` : "empty"}; removed ${removed.length ? removed.join(", ") : "nothing"}`,
  };
}

type TNode = { key: number; left?: TNode; right?: TNode };
type GState = "queued" | "cur" | "done" | "hit";

/** Adds x to a plain binary search tree (distinct keys assumed). Returns the root. */
function insertFinal(root: TNode | undefined, x: number): TNode {
  if (!root) return { key: x };
  let cur = root;
  let placed = false;
  while (!placed) {
    if (x < cur.key) {
      if (cur.left) cur = cur.left;
      else { cur.left = { key: x }; placed = true; }
    } else if (cur.right) {
      cur = cur.right;
    } else {
      cur.right = { key: x };
      placed = true;
    }
  }
  return root;
}

function measure(node: TNode | undefined, depth: number, parent: number | undefined, depthOf: Map<number, number>, parentOf: Map<number, number>): void {
  if (!node) return;
  depthOf.set(node.key, depth);
  if (parent !== undefined) parentOf.set(node.key, parent);
  measure(node.left, depth + 1, node.key, depthOf, parentOf);
  measure(node.right, depth + 1, node.key, depthOf, parentOf);
}

/**
 * Inserts the values one at a time, then searches for the target.
 * The layout comes from the final tree, so each node keeps its place from frame to frame.
 * Insertion walks the final tree but stops at the first child that has not been inserted yet,
 * which is exactly where the value attaches in the partial tree.
 */
export function bstSearch(values: number[], target: number): GraphGen {
  const n = values.length;
  let root: TNode | undefined;
  for (const v of values) root = insertFinal(root, v);
  if (!root) return { kind: "graph", frames: [], result: "empty tree" };

  const depthOf = new Map<number, number>();
  const parentOf = new Map<number, number>();
  measure(root, 0, undefined, depthOf, parentOf);
  const sorted = [...values].sort((p, q) => p - q);
  const xOf = (k: number) => 150 + (sorted.indexOf(k) - (n - 1) / 2) * (n > 1 ? 280 / (n - 1) : 0);
  const yOf = (k: number) => 30 + (depthOf.get(k) ?? 0) * 60;

  const present: number[] = [];
  const f: GraphStep[] = [];
  const st = (entries: [number, GState][]): Record<string, GState> =>
    Object.fromEntries(entries.map(([k, s]): [string, GState] => [String(k), s]));
  const tag = (keys: number[], curKey: number, curState: GState): [number, GState][] =>
    keys.map((k): [number, GState] => [k, k === curKey ? curState : "queued"]);
  const snap = (line: number, note: string, state: Record<string, GState>, order: number[] = []): GraphStep => {
    const keys = [...present];
    const inTree = new Set(keys);
    return {
      line,
      note,
      nodes: keys.map((k) => ({ id: String(k), x: xOf(k), y: yOf(k) })),
      edges: keys.flatMap((k) => {
        const p = parentOf.get(k);
        return p !== undefined && inTree.has(p) ? [{ a: String(p), b: String(k) }] : [];
      }),
      state,
      text: {},
      order: order.map(String),
      structure: { label: "Inserted so far", items: keys.map(String) },
    };
  };

  for (let t = 0; t < n; t++) {
    const x = values[t];
    if (t === 0) {
      present.push(x);
      f.push(snap(1, `The tree is empty, so ${x} becomes the root.`, st([[x, "done"]])));
      continue;
    }
    const path: number[] = [];
    let cur: TNode | undefined = root;
    let attached = false;
    while (cur && !attached) {
      const here: number = cur.key;
      path.push(here);
      const goLeft: boolean = x < here;
      const next: TNode | undefined = goLeft ? cur.left : cur.right;
      f.push(snap(4, `${x} ${goLeft ? "<" : ">"} ${here}, so ${x} belongs in the ${goLeft ? "left" : "right"} subtree.`, st(tag(path, here, "cur"))));
      if (!next || !present.includes(next.key)) {
        present.push(x);
        f.push(snap(5, `${here} has no ${goLeft ? "left" : "right"} child yet, so ${x} attaches there.`, st([...tag(path, here, "queued"), [x, "done"]])));
        attached = true;
      } else {
        cur = next;
      }
    }
  }

  const visited: number[] = [];
  let node: TNode | undefined = root;
  let found = false;
  f.push(snap(8, `Search for ${target}: start at the root.`, {}));
  while (node && !found) {
    const here: number = node.key;
    visited.push(here);
    if (here === target) {
      found = true;
      f.push(snap(10, `${target} equals ${here}. Found it.`, st(tag(visited, here, "hit")), visited));
      break;
    }
    const goLeft: boolean = target < here;
    f.push(snap(11, `${target} ${goLeft ? "<" : ">"} ${here}, so search the ${goLeft ? "left" : "right"} subtree.`, st(tag(visited, here, "cur")), visited));
    node = goLeft ? node.left : node.right;
  }
  if (!found) {
    f.push(snap(12, `Reached an empty spot, so ${target} is not in the tree.`, st(tag(visited, -1, "cur")), visited));
  }
  return { kind: "graph", frames: f, result: found ? `${target} is in the tree` : `${target} is not in the tree` };
}
