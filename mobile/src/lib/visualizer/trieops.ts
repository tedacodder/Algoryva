import type { St } from "./graphs";
import type { GraphGen, GraphStep } from "./types";

export type TrieOp = { name: "insert" | "delete" | "search"; word: string };
export const TRIE_NODE_LIMIT = 16;

/** Pseudocode for trieDynamic. Frame line numbers refer to these entries. */
export const TRIE_OPS_PSEUDOCODE = [
  "insert(word): node = root",
  "  for each char c: create the child c if missing; move to it",
  "  mark node as the end of a word",
  "delete(word): if the word is not stored, stop",
  "  unmark its end node",
  "  while node has no children and is not a word end: remove it; move to parent",
  "search(word): follow children from the root",
  "  found if the last node is a word end",
];

const id = (p: string) => `p:${p}`;

/**
 * Insert, delete and search on one trie that changes shape. A node is identified by its prefix.
 * Delete removes a word's end mark, then prunes upward: a node stays only while it has children or ends a word.
 */
export function trieDynamic(ops: TrieOp[]): GraphGen {
  const present = new Set<string>([""]);
  const marked = new Set<string>();
  const f: GraphStep[] = [];
  let lastSearch = "";

  const hasChildren = (p: string) => [...present].some((q) => q.length === p.length + 1 && q.startsWith(p));

  const snap = (line: number, note: string, cur: string | null): GraphStep => {
    const keys = [...present];
    const byDepth = new Map<number, string[]>();
    for (const p of keys) byDepth.set(p.length, [...(byDepth.get(p.length) ?? []), p]);
    const pos = new Map<string, { x: number; y: number }>();
    for (const [d, list] of byDepth) {
      list.sort();
      list.forEach((p, j) => pos.set(p, { x: (280 * (j + 1)) / (list.length + 1) + 10, y: 30 + d * 55 }));
    }
    const state: Record<string, St> = {};
    for (const p of keys) state[id(p)] = p === cur ? "cur" : marked.has(p) ? "hit" : "done";
    return {
      line,
      note,
      nodes: keys.map((p) => {
        const q = pos.get(p) ?? { x: 150, y: 30 };
        return { id: id(p), x: q.x, y: q.y, label: p === "" ? "root" : p[p.length - 1] };
      }),
      edges: keys.filter((p) => p !== "").map((p) => ({ a: id(p.slice(0, -1)), b: id(p) })),
      state,
      text: {},
      structure: { label: "Stored words", items: [...marked].sort() },
      order: [],
    };
  };

  const insert = (w: string) => {
    let cur = "";
    f.push(snap(0, `Insert "${w}": start at the root.`, cur));
    for (let k = 0; k < w.length; k++) {
      const next = w.slice(0, k + 1);
      if (present.has(next)) {
        f.push(snap(1, `Child "${w[k]}" exists, so follow it.`, next));
      } else {
        present.add(next);
        f.push(snap(1, `No child "${w[k]}" here, so create it.`, next));
      }
      cur = next;
    }
    if (marked.has(w)) {
      f.push(snap(2, `"${w}" is already stored, so nothing changes.`, w));
    } else {
      marked.add(w);
      f.push(snap(2, `Mark the node for "${w}" as the end of a stored word.`, w));
    }
  };

  const del = (w: string) => {
    if (!marked.has(w)) {
      f.push(snap(3, `"${w}" is not stored, so there is nothing to delete.`, null));
      return;
    }
    marked.delete(w);
    f.push(snap(4, `Unmark "${w}". Its node stays if a longer word still needs it.`, w));
    let p = w;
    while (p !== "" && !hasChildren(p) && !marked.has(p)) {
      present.delete(p);
      const parent = p.slice(0, -1);
      f.push(snap(5, `"${p}" has no children and is not a stored word, so remove its node.`, parent));
      p = parent;
    }
  };

  const search = (w: string) => {
    let cur = "";
    f.push(snap(6, `Search for "${w}": start at the root.`, cur));
    for (let k = 0; k < w.length; k++) {
      const next = w.slice(0, k + 1);
      if (!present.has(next)) {
        f.push(snap(6, `No child "${w[k]}" after ${cur === "" ? "the root" : `"${cur}"`}, so "${w}" is not in the trie.`, cur));
        lastSearch = `"${w}" is not in the trie`;
        return;
      }
      f.push(snap(6, `Follow the child "${w[k]}".`, next));
      cur = next;
    }
    if (marked.has(w)) {
      f.push(snap(7, `The node for "${w}" is a word end, so it is stored.`, cur));
      lastSearch = `"${w}" is stored`;
    } else {
      f.push(snap(7, `The node for "${w}" exists but is not a word end. It is only a prefix.`, cur));
      lastSearch = `"${w}" is only a prefix`;
    }
  };

  for (const op of ops) {
    if (op.name === "insert") insert(op.word);
    else if (op.name === "delete") del(op.word);
    else search(op.word);
  }
  const stored = [...marked].sort();
  return { kind: "graph", frames: f, result: lastSearch || (stored.length ? `stored: ${stored.join(", ")}` : "no words stored") };
}
