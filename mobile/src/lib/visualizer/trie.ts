import type { St } from "./graphs";
import type { GraphGen, GraphStep } from "./types";

export const MAX_TRIE_NODES = 16;

/**
 * Inserts the words one by one, then searches for one word.
 * Node positions come from the final trie: depth gives the row, and nodes sort alphabetically within a row.
 * A node is keyed by its prefix, so "c" and "ca" are different nodes.
 */
export function trieOps(words: string[], search: string): GraphGen {
  const prefixes = new Set<string>([""]);
  for (const w of words) for (let k = 1; k <= w.length; k++) prefixes.add(w.slice(0, k));
  const byDepth = new Map<number, string[]>();
  for (const p of prefixes) byDepth.set(p.length, [...(byDepth.get(p.length) ?? []), p]);
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, list] of byDepth) {
    list.sort();
    list.forEach((p, j) => pos.set(p, { x: (280 * (j + 1)) / (list.length + 1) + 10, y: 30 + d * 55 }));
  }

  const id = (p: string) => `p:${p}`;
  const present = new Set<string>([""]);
  const marked = new Set<string>();
  const inserted: string[] = [];
  const f: GraphStep[] = [];

  const snap = (line: number, note: string, cur: string | null, order: string[] = []): GraphStep => {
    const keys = [...present];
    const state: Record<string, St> = {};
    for (const p of keys) state[id(p)] = p === cur ? "cur" : marked.has(p) ? "hit" : "done";
    const edges = keys.filter((p) => p !== "").map((p) => ({ a: id(p.slice(0, -1)), b: id(p) }));
    return {
      line,
      note,
      nodes: keys.map((p) => {
        const q = pos.get(p) ?? { x: 150, y: 30 };
        return { id: id(p), x: q.x, y: q.y, label: p === "" ? "root" : p[p.length - 1] };
      }),
      edges,
      state,
      text: {},
      structure: { label: "Words so far", items: [...inserted] },
      order,
    };
  };

  for (const w of words) {
    let cur = "";
    f.push(snap(0, `Insert "${w}": start at the root.`, cur));
    for (let k = 0; k < w.length; k++) {
      const next = w.slice(0, k + 1);
      if (present.has(next)) {
        f.push(snap(3, `There is already a child "${w[k]}" here, so follow it.`, next));
      } else {
        present.add(next);
        f.push(snap(2, `No child "${w[k]}" here yet, so create it.`, next));
      }
      cur = next;
    }
    marked.add(w);
    inserted.push(w);
    f.push(snap(4, `Mark the node for "${w}" as the end of a stored word.`, w));
  }

  let cur = "";
  f.push(snap(5, `Search for "${search}": start at the root.`, cur));
  for (let k = 0; k < search.length; k++) {
    const next = search.slice(0, k + 1);
    if (!present.has(next)) {
      f.push(snap(6, `No child "${search[k]}" after ${cur === "" ? "the root" : `"${cur}"`}, so "${search}" is not in the trie.`, cur));
      return { kind: "graph", frames: f, result: `"${search}" is not in the trie` };
    }
    f.push(snap(7, `Follow the child "${search[k]}".`, next));
    cur = next;
  }
  const found = marked.has(search);
  f.push(snap(8, found
    ? `The node for "${search}" is marked as a word, so it is in the trie.`
    : `The node for "${search}" exists but is not a stored word. It is only a prefix.`, cur));
  return { kind: "graph", frames: f, result: found ? `"${search}" is in the trie` : `"${search}" is only a prefix` };
}

