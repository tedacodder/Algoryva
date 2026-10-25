import type { Edge, Op } from "./types";

export const MAX_VALUES = 30;
export const MAX_OPS = 20;
export const MAX_ABS = 999;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Splits on commas and/or whitespace. Empty text gives an empty list when `min` is 0. */
export function parseInts(
  text: string,
  label: string,
  opts: { min?: number; max?: number; distinct?: boolean } = {},
): Parsed<number[]> {
  const min = opts.min ?? 1;
  const max = opts.max ?? MAX_VALUES;
  const parts = text.split(/[\s,]+/).filter((p) => p.length > 0);
  if (parts.length < min) return { ok: false, error: `${label} needs at least ${min} number${min === 1 ? "" : "s"}.` };
  if (parts.length > max) return { ok: false, error: `${label} has ${parts.length} numbers. The limit is ${max}, so the steps stay readable.` };
  const values: number[] = [];
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    if (!/^[-+]?\d+$/.test(p)) {
      return { ok: false, error: `"${p}" (number ${k + 1} in ${label.toLowerCase()}) is not a whole number. Separate values with commas or spaces.` };
    }
    const v = Number(p);
    if (Math.abs(v) > MAX_ABS) return { ok: false, error: `${p} is outside the allowed range of -${MAX_ABS} to ${MAX_ABS}.` };
    values.push(v);
  }
  if (opts.distinct && new Set(values).size !== values.length) return { ok: false, error: `${label} must not repeat a value.` };
  return { ok: true, value: values };
}

export function parseInt1(text: string, label: string): Parsed<number> {
  const t = text.trim();
  if (!/^[-+]?\d+$/.test(t)) return { ok: false, error: `${label} must be a single whole number.` };
  const v = Number(t);
  if (Math.abs(v) > MAX_ABS) return { ok: false, error: `${label} is outside the allowed range of -${MAX_ABS} to ${MAX_ABS}.` };
  return { ok: true, value: v };
}

/** Parses "push 3, push 5, pop". `verbs` maps each allowed operation to whether it takes a value. */
export function parseOps(text: string, verbs: Record<string, boolean>): Parsed<Op[]> {
  const items = text.split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (items.length === 0) return { ok: false, error: "Add at least one operation." };
  if (items.length > MAX_OPS) return { ok: false, error: `There are ${items.length} operations. The limit is ${MAX_OPS}.` };
  const ops: Op[] = [];
  for (const item of items) {
    const parts = item.split(/\s+/);
    const name = (parts[0] ?? "").toLowerCase();
    const rest = parts.slice(1);
    if (!Object.prototype.hasOwnProperty.call(verbs, name)) {
      return { ok: false, error: `"${parts[0] ?? item}" is not an operation here. Use ${Object.keys(verbs).join(", ")}.` };
    }
    if (verbs[name]) {
      if (rest.length !== 1) return { ok: false, error: `"${item}" needs one number, such as "${name} 5".` };
      const n = parseInt1(rest[0] ?? "", `The value in "${item}"`);
      if (!n.ok) return { ok: false, error: n.error };
      ops.push({ name, arg: n.value });
    } else {
      if (rest.length > 0) return { ok: false, error: `"${name}" takes no value.` };
      ops.push({ name });
    }
  }
  return { ok: true, value: ops };
}

/** Parses "1 3; 0 4" into inclusive, 0-based ranges that must lie inside an array of length n. */
export function parseQueries(text: string, n: number): Parsed<[number, number][]> {
  const parts = text.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return { ok: false, error: 'Add at least one query, such as "1 3".' };
  const out: [number, number][] = [];
  for (const p of parts) {
    const nums = p.split(/\s+/);
    if (nums.length !== 2 || !nums.every((v) => /^\d+$/.test(v))) {
      return { ok: false, error: `"${p}" is not a query. Write two indices, such as "1 3".` };
    }
    const l = Number(nums[0]);
    const r = Number(nums[1]);
    if (r >= n || l > r) return { ok: false, error: `Query "${p}" must satisfy 0 <= l <= r < ${n}.` };
    out.push([l, r]);
  }
  return { ok: true, value: out };
}

/** Returns an error message if the values are not sorted from smallest to largest, otherwise null. */
export function sortedError(values: number[], label: string): string | null {
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[i - 1]) {
      return `${label} must be sorted from smallest to largest, but a[${i}] = ${values[i]} is smaller than a[${i - 1}] = ${values[i - 1]}. Sort it first, or use a sort preset.`;
    }
  }
  return null;
}

export const MAX_NODES = 8;
export const MAX_EDGES = 20;
export type GraphInput = { n: number; edges: Edge[]; directed: boolean };

/** Parses a node count, a directed flag, and edges written as "u v" or "u v weight" separated by semicolons. */
export function parseGraph(nodes: string, edges: string, directed: string, opts: { nonNegative?: boolean } = {}): Parsed<GraphInput> {
  const nt = parseInt1(nodes, "The node count");
  if (!nt.ok) return { ok: false, error: nt.error };
  const n = nt.value;
  if (n < 1 || n > MAX_NODES) return { ok: false, error: `The node count must be between 1 and ${MAX_NODES}.` };
  const d = directed.trim().toLowerCase();
  if (d !== "yes" && d !== "no") return { ok: false, error: 'Directed must be "yes" or "no".' };
  const items = edges.split(/[,;\n]+/).map((x) => x.trim()).filter((x) => x.length > 0);
  if (items.length > MAX_EDGES) return { ok: false, error: `There are ${items.length} edges. The limit is ${MAX_EDGES}.` };
  const out: Edge[] = [];
  for (const item of items) {
    const parts = item.split(/\s+/);
    if (parts.length < 2 || parts.length > 3 || !parts.every((x) => /^-?\d+$/.test(x))) {
      return { ok: false, error: `"${item}" is not an edge. Write "u v" or "u v weight", such as "0 2 5".` };
    }
    const u = Number(parts[0]);
    const v = Number(parts[1]);
    const w = parts.length === 3 ? Number(parts[2]) : 1;
    if (u < 0 || u >= n || v < 0 || v >= n) return { ok: false, error: `Edge "${item}" uses a node outside 0 to ${n - 1}.` };
    if (opts.nonNegative && w < 0) return { ok: false, error: `Edge "${item}" has a negative weight. Dijkstra needs weights of 0 or more.` };
    if (Math.abs(w) > MAX_ABS) return { ok: false, error: `The weight in "${item}" is outside the allowed range of -${MAX_ABS} to ${MAX_ABS}.` };
    out.push({ u, v, w });
  }
  return { ok: true, value: { n, edges: out, directed: d === "yes" } };
}

/** Parses "union 0 1, union 2 3, find 1" for n elements numbered 0 to n-1. */
export function parseDsu(text: string, n: number): Parsed<import("./dsu").DsuOp[]> {
  const items = text.split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (items.length === 0) return { ok: false, error: "Add at least one operation, such as union 0 1 or find 0." };
  if (items.length > MAX_OPS) return { ok: false, error: `There are ${items.length} operations. The limit is ${MAX_OPS}.` };
  const ops: import("./dsu").DsuOp[] = [];
  for (const item of items) {
    const parts = item.split(/\s+/);
    const name = (parts[0] ?? "").toLowerCase();
    const nums = parts.slice(1);
    const inRange = (x: string) => /^\d+$/.test(x) && Number(x) < n;
    if (name === "union" && nums.length === 2 && nums.every(inRange)) {
      ops.push({ name: "union", a: Number(nums[0]), b: Number(nums[1]) });
    } else if (name === "find" && nums.length === 1 && inRange(nums[0] ?? "")) {
      ops.push({ name: "find", a: Number(nums[0]) });
    } else {
      return { ok: false, error: `"${item}" is not a valid operation. Write "union a b" or "find a", with numbers from 0 to ${n - 1}.` };
    }
  }
  return { ok: true, value: ops };
}

/** Parses "add 3 5, query 4" for a Fenwick tree of n values. Indices are 1-based. */
export function parseFenOps(text: string, n: number): Parsed<import("./fenwick").FenOp[]> {
  const items = text.split(/[,;\n]+/).map((x) => x.trim()).filter((x) => x.length > 0);
  if (items.length === 0) return { ok: false, error: "Add at least one operation, such as query 4 or add 3 5." };
  if (items.length > MAX_OPS) return { ok: false, error: `There are ${items.length} operations. The limit is ${MAX_OPS}.` };
  const ops: import("./fenwick").FenOp[] = [];
  for (const item of items) {
    const parts = item.split(/\s+/);
    const name = (parts[0] ?? "").toLowerCase();
    if (name === "add" && parts.length === 3 && /^\d+$/.test(parts[1] ?? "") && /^-?\d+$/.test(parts[2] ?? "")) {
      const i = Number(parts[1]);
      const d = Number(parts[2]);
      if (i < 1 || i > n) return { ok: false, error: `In "${item}", the index must be from 1 to ${n}.` };
      if (Math.abs(d) > MAX_ABS) return { ok: false, error: `In "${item}", the change is outside -${MAX_ABS} to ${MAX_ABS}.` };
      ops.push({ name: "add", i, d });
    } else if (name === "query" && parts.length === 2 && /^\d+$/.test(parts[1] ?? "")) {
      const i = Number(parts[1]);
      if (i > n) return { ok: false, error: `In "${item}", the index must be from 0 to ${n}.` };
      ops.push({ name: "query", i });
    } else {
      return { ok: false, error: `"${item}" is not valid. Write "add i d" (1-based index, change) or "query i".` };
    }
  }
  return { ok: true, value: ops };
}

/** Parses "1 4; 3 5; 0 6" into intervals with 0 <= start < end <= 99. */
export function parseIntervals(text: string): Parsed<[number, number][]> {
  const items = text.split(/[;\n]+/).map((x) => x.trim()).filter((x) => x.length > 0);
  if (items.length === 0) return { ok: false, error: 'Add at least one interval, such as "1 4".' };
  if (items.length > 10) return { ok: false, error: `There are ${items.length} intervals. The limit is 10.` };
  const out: [number, number][] = [];
  for (const item of items) {
    const parts = item.split(/\s+/);
    if (parts.length !== 2 || !parts.every((x) => /^\d+$/.test(x))) return { ok: false, error: `"${item}" is not an interval. Write a start and an end, such as "1 4".` };
    const [s, e] = [Number(parts[0]), Number(parts[1])];
    if (s >= e) return { ok: false, error: `In "${item}", the start must be less than the end.` };
    if (e > 99) return { ok: false, error: `In "${item}", values must be 99 or less.` };
    out.push([s, e]);
  }
  return { ok: true, value: out };
}

/** Parses comma-separated lowercase words of 1 to 4 letters, up to 4 words. */
export function parseWords(text: string): Parsed<string[]> {
  const parts = text.split(/[\s,;]+/).filter((x) => x.length > 0);
  if (parts.length === 0) return { ok: false, error: "Add at least one word." };
  if (parts.length > 4) return { ok: false, error: `There are ${parts.length} words. The limit is 4.` };
  for (const w of parts) {
    if (!/^[a-z]{1,4}$/.test(w)) return { ok: false, error: `"${w}" must be 1 to 4 lowercase letters with no digits.` };
  }
  return { ok: true, value: parts };
}

/** Parses "query l r" and "update i v" for a segment tree over n values. Values in the tree are 0 to 99 so labels fit. */
export function parseSegOps(text: string, n: number): Parsed<import("./segtree").SegOp[]> {
  const items = text.split(/[,;\n]+/).map((x) => x.trim()).filter((x) => x.length > 0);
  if (items.length === 0) return { ok: false, error: "Add at least one operation, such as query 1 3 or update 2 7." };
  if (items.length > MAX_OPS) return { ok: false, error: `There are ${items.length} operations. The limit is ${MAX_OPS}.` };
  const ops: import("./segtree").SegOp[] = [];
  for (const item of items) {
    const parts = item.split(/\s+/);
    const name = (parts[0] ?? "").toLowerCase();
    const nums = parts.slice(1);
    const isNum = (x: string | undefined) => x !== undefined && /^\d+$/.test(x);
    if (name === "query" && nums.length === 2 && isNum(nums[0]) && isNum(nums[1])) {
      const l = Number(nums[0]);
      const r = Number(nums[1]);
      if (l > r || r >= n) return { ok: false, error: `"${item}" needs 0 <= l <= r < ${n}.` };
      ops.push({ name: "query", l, r });
    } else if (name === "update" && nums.length === 2 && isNum(nums[0]) && isNum(nums[1])) {
      const i = Number(nums[0]);
      const v = Number(nums[1]);
      if (i >= n) return { ok: false, error: `"${item}" uses an index outside 0 to ${n - 1}.` };
      if (v > 99) return { ok: false, error: `"${item}" uses a value above 99. Keep values from 0 to 99.` };
      ops.push({ name: "update", i, v });
    } else {
      return { ok: false, error: `"${item}" is not valid. Write "query l r" or "update i v", with non-negative numbers.` };
    }
  }
  return { ok: true, value: ops };
}

/** Parses "insert cat, delete car, search ca" for the dynamic trie. Words are 1 to 4 lowercase letters. */
export function parseTrieOps(text: string): Parsed<import("./trieops").TrieOp[]> {
  const items = text.split(/[,;\n]+/).map((x) => x.trim()).filter((x) => x.length > 0);
  if (items.length === 0) return { ok: false, error: 'Add at least one operation, such as "insert cat".' };
  if (items.length > MAX_OPS) return { ok: false, error: `There are ${items.length} operations. The limit is ${MAX_OPS}.` };
  const ops: import("./trieops").TrieOp[] = [];
  for (const item of items) {
    const parts = item.split(/\s+/);
    const name = (parts[0] ?? "").toLowerCase();
    if (parts.length !== 2 || (name !== "insert" && name !== "delete" && name !== "search")) {
      return { ok: false, error: `"${item}" is not valid. Write "insert word", "delete word", or "search word".` };
    }
    const word = parts[1] ?? "";
    if (!/^[a-z]{1,4}$/.test(word)) return { ok: false, error: `"${word}" must be 1 to 4 lowercase letters with no digits.` };
    ops.push({ name, word });
  }
  return { ok: true, value: ops };
}
