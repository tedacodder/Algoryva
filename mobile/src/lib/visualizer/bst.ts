import type { St } from "./graphs";
import type { GraphGen, GraphStep, Op } from "./types";

type TNode = { key: number; left?: TNode; right?: TNode };

export const MAX_BST_KEYS = 9;

/** Pseudocode for bstOps. Frame line numbers refer to these entries. */
export const BST_PSEUDOCODE = [
  "delete(x): search for x",
  "  not present: stop. found: remove it",
  "  no children: remove the node",
  "  one child: the child takes its place",
  "  two children: find the in-order successor s",
  "  copy s into the node, then remove the old s",
  "insert(x): if the tree is empty, x is the root",
  "  walk down: go left if x < node, else right",
  "  if that child is empty, attach x there",
  "search(x): start at the root",
  "  if node.key == x: found",
  "  go left if x < node.key, else right",
  "  reached an empty spot: not found",
];

/**
 * Runs insert, delete and search on one binary search tree that changes shape.
 * Every frame lays out the current tree: nodes sit in in-order order across the row, and depth gives the height.
 * Delete handles the three cases: no children, one child, and two children (copy the in-order successor, then remove it).
 */
export function bstOps(ops: Op[]): GraphGen {
  let root: TNode | undefined;
  const f: GraphStep[] = [];

  const snap = (line: number, note: string, states: Record<number, St> = {}): GraphStep => {
    const rows: { key: number; depth: number; parent?: number }[] = [];
    const visit = (n: TNode | undefined, d: number, p: number | undefined): void => {
      if (!n) return;
      visit(n.left, d + 1, n.key);
      rows.push({ key: n.key, depth: d, parent: p });
      visit(n.right, d + 1, n.key);
    };
    visit(root, 0, undefined);
    const m = rows.length;
    const spacing = m > 1 ? Math.min(60, 280 / (m - 1)) : 0;
    const st: Record<string, St> = {};
    for (const [k, s] of Object.entries(states)) st[k] = s;
    return {
      line,
      note,
      nodes: rows.map((r, i) => ({ id: String(r.key), x: 150 + (i - (m - 1) / 2) * spacing, y: 30 + r.depth * 46 })),
      edges: rows.filter((r) => r.parent !== undefined).map((r) => ({ a: String(r.parent), b: String(r.key) })),
      state: st,
      text: {},
      structure: { label: "Keys in order", items: rows.map((r) => String(r.key)) },
      order: [],
    };
  };
  const tag = (path: number[], cur: number | null, curState: St): Record<number, St> => {
    const s: Record<number, St> = {};
    for (const k of path) s[k] = k === cur ? curState : "queued";
    return s;
  };
  const replaceChild = (parent: TNode | undefined, node: TNode, child: TNode | undefined) => {
    if (!parent) root = child;
    else if (parent.left === node) parent.left = child;
    else parent.right = child;
  };

  const insert = (x: number) => {
    if (!root) {
      root = { key: x };
      f.push(snap(6, `The tree is empty, so ${x} becomes the root.`, { [x]: "done" }));
      return;
    }
    const path: number[] = [];
    let cur: TNode = root;
    for (;;) {
      if (cur.key === x) {
        f.push(snap(7, `${x} is already in the tree, so nothing changes.`, tag(path, cur.key, "hit")));
        return;
      }
      path.push(cur.key);
      const goLeft = x < cur.key;
      f.push(snap(7, `${x} ${goLeft ? "<" : ">"} ${cur.key}, so go ${goLeft ? "left" : "right"}.`, tag(path, cur.key, "cur")));
      const next = goLeft ? cur.left : cur.right;
      if (!next) {
        const child: TNode = { key: x };
        if (goLeft) cur.left = child;
        else cur.right = child;
        f.push(snap(8, `${cur.key} has no ${goLeft ? "left" : "right"} child, so ${x} attaches there.`, { ...tag(path, null, "queued"), [x]: "done" }));
        return;
      }
      cur = next;
    }
  };

  const search = (x: number) => {
    const path: number[] = [];
    let cur = root;
    f.push(snap(9, `Search for ${x}: start at the root.`));
    while (cur) {
      path.push(cur.key);
      if (cur.key === x) {
        f.push(snap(10, `${x} equals ${cur.key}. Found it.`, tag(path, cur.key, "hit")));
        return;
      }
      const goLeft = x < cur.key;
      f.push(snap(11, `${x} ${goLeft ? "<" : ">"} ${cur.key}, so search the ${goLeft ? "left" : "right"} subtree.`, tag(path, cur.key, "cur")));
      cur = goLeft ? cur.left : cur.right;
    }
    f.push(snap(12, `Reached an empty spot, so ${x} is not in the tree.`, tag(path, null, "queued")));
  };

  const del = (x: number) => {
    const path: number[] = [];
    let parent: TNode | undefined;
    let node = root;
    f.push(snap(0, `Delete ${x}: first search for it.`));
    while (node && node.key !== x) {
      path.push(node.key);
      f.push(snap(0, `${x} ${x < node.key ? "<" : ">"} ${node.key}, so keep searching ${x < node.key ? "left" : "right"}.`, tag(path, node.key, "cur")));
      parent = node;
      node = x < node.key ? node.left : node.right;
    }
    if (!node) {
      f.push(snap(1, `${x} is not in the tree, so there is nothing to delete.`, tag(path, null, "queued")));
      return;
    }
    path.push(x);
    f.push(snap(1, `Found ${x}. Now remove it.`, tag(path, x, "hit")));
    if (!node.left && !node.right) {
      replaceChild(parent, node, undefined);
      f.push(snap(2, `${x} has no children, so remove its node.`, tag(path.slice(0, -1), null, "queued")));
    } else if (!node.left || !node.right) {
      replaceChild(parent, node, node.left ?? node.right);
      f.push(snap(3, `${x} has one child, so the child takes its place.`, tag(path.slice(0, -1), null, "queued")));
    } else {
      let sParent: TNode = node;
      let s: TNode = node.right as TNode;
      while (s.left) {
        sParent = s;
        s = s.left;
      }
      f.push(snap(4, `${x} has two children. Its in-order successor is ${s.key}, the smallest value to its right.`, tag(path, x, "hit")));
      node.key = s.key;
      f.push(snap(5, `Copy ${s.key} into the node that held ${x}. Now remove the old ${s.key} from the right subtree.`, tag([...path.slice(0, -1), s.key], s.key, "cur")));
      replaceChild(sParent, s, s.right);
      f.push(snap(5, `The old ${s.key} had at most one child, so it is removed and its child, if any, takes its place.`, tag(path.slice(0, -1), null, "queued")));
    }
  };

  for (const op of ops) {
    const arg = op.arg ?? 0;
    if (op.name === "insert") insert(arg);
    else if (op.name === "delete") del(arg);
    else search(arg);
  }
  const keys: number[] = [];
  const collect = (n: TNode | undefined) => {
    if (!n) return;
    collect(n.left);
    keys.push(n.key);
    collect(n.right);
  };
  collect(root);
  return { kind: "graph", frames: f, result: keys.length ? `in order: ${keys.join(" ")}` : "empty tree" };
}
