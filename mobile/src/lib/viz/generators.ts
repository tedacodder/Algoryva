import { mk, marksOf, type Cell, type Frame, type GraphFrame, type GridFrame, type Marks } from "./steps";

/** Prefix sums: build P (P[0] = 0), then answer range queries as P[r+1] - P[l]. Queries are 0-indexed and inclusive. */
export function prefixSumSteps(a: number[], queries: [number, number][]): Frame[] {
  const f: Frame[] = [];
  const P: (number | string)[] = Array(a.length + 1).fill("·");
  const aux = (marks: Record<number, string[]> = {}) => [{ label: "P (prefix sums, P[0] = 0)", values: [...P], marks }];
  P[0] = 0;
  f.push({ ...mk(a, "We start with P[0] = 0: the sum of zero elements.", ), aux: aux({ 0: ["new"] }) });
  for (let i = 0; i < a.length; i++) {
    P[i + 1] = (P[i] as number) + a[i];
    f.push({ ...mk(a, `P[${i + 1}] = P[${i}] + a[${i}] = ${P[i]} + ${a[i]} = ${P[i + 1]}.`, [i, "add"]), aux: aux({ [i + 1]: ["new"], [i]: ["from"] }) });
  }
  for (const [l, r] of queries) {
    const hi = P[r + 1] as number, lo = P[l] as number;
    const win: [number, string][] = Array.from({ length: r - l + 1 }, (_, d) => [l + d, "win"]);
    f.push({ ...mk(a, `Sum of a[${l}..${r}] = P[${r + 1}] - P[${l}] = ${hi} - ${lo} = ${hi - lo}. One subtraction, however long the range.`, ...win), aux: aux({ [r + 1]: ["hi"], [l]: ["lo"] }) });
  }
  return f;
}

/** Longest subarray of positive numbers whose sum is at most s: the variable-size sliding window. */
export function variableWindowSteps(a: number[], s: number): Frame[] {
  const f: Frame[] = [];
  let left = 0, total = 0, best = 0;
  const win = (l: number, r: number): [number, string][] => { const out: [number, string][] = []; for (let i = l; i <= r; i++) out.push([i, "win"]); return out; };
  f.push(mk(a, `Goal: the longest run of elements with sum at most ${s}. Window is empty.`));
  for (let right = 0; right < a.length; right++) {
    total += a[right];
    f.push(mk(a, `Expand: take a[${right}] = ${a[right]}. Window sum = ${total}.`, ...win(left, right), [left, "L"], [right, "R"]));
    while (total > s) {
      total -= a[left];
      f.push(mk(a, `Sum exceeded ${s}: shrink by dropping a[${left}] = ${a[left]}. Window sum = ${total}.`, ...(left + 1 <= right ? win(left + 1, right) : []), [Math.min(left + 1, a.length - 1), "L"], [right, "R"]));
      left++;
    }
    const len = right - left + 1;
    if (len > best) best = len;
    f.push(mk(a, `Window [${left}..${right}] is valid with length ${len}. Best so far = ${best}.`, ...(len > 0 ? win(left, right) : []), [Math.min(left, a.length - 1), "L"], [right, "R"]));
  }
  return f;
}

/** Next greater element to the right using a monotonic stack of indices. */
export function monotonicStackSteps(a: number[]): Frame[] {
  const f: Frame[] = [];
  const res: (number | string)[] = Array(a.length).fill("?");
  const stack: number[] = [];
  const snap = (note: string, marks: [number, string][] = []): Frame => ({ ...mk(a, note, ...marks), aux: [{ label: "next greater to the right", values: [...res], marks: {} }], structure: { label: "Stack of indices (top on the right)", items: stack.map((i) => `${i}:${a[i]}`) } });
  f.push(snap("Stack holds indices still waiting for a bigger value to their right."));
  for (let i = 0; i < a.length; i++) {
    f.push(snap(`Look at a[${i}] = ${a[i]}.`, [[i, "i"]]));
    while (stack.length && a[stack[stack.length - 1]] < a[i]) {
      const j = stack.pop()!;
      res[j] = a[i];
      f.push(snap(`${a[i]} is greater than a[${j}] = ${a[j]}, so ${a[i]} is the answer for index ${j}. Pop it.`, [[i, "i"], [j, "j"]]));
    }
    stack.push(i);
    f.push(snap(`Push index ${i}. Values on the stack are now non-increasing from bottom to top.`, [[i, "i"]]));
  }
  for (const j of stack) res[j] = -1;
  f.push(snap("Indices left on the stack never met a bigger value, so their answer is -1."));
  return f;
}

/** Union-Find with union by size and path compression, over elements 0..n-1. */
export function unionFindSteps(n: number, ops: [number, number][]): Frame[] {
  const parent = Array.from({ length: n }, (_, i) => i), size = Array(n).fill(1);
  const f: Frame[] = [];
  const snap = (note: string, marks: [number, string][] = []): Frame => ({ ...mk(parent, note, ...marks), aux: [{ label: "size of the tree rooted here", values: [...size], marks: {} }] });
  f.push(snap("parent[i] = i means every element starts as its own group."));
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; }
    return r;
  };
  for (const [a, b] of ops) {
    const ra = find(a), rb = find(b);
    if (ra === rb) { f.push(snap(`union(${a}, ${b}): both already have root ${ra}. Nothing to do; this edge would close a cycle.`, [[ra, "root"]])); continue; }
    const [big, small] = size[ra] >= size[rb] ? [ra, rb] : [rb, ra];
    parent[small] = big; size[big] += size[small];
    f.push(snap(`union(${a}, ${b}): roots ${ra} and ${rb}. Attach the smaller tree (root ${small}) under the larger (root ${big}).`, [[big, "root"], [small, "moved"]]));
  }
  return f;
}

/** Two nested loops over every pair (i < j): shows why the count grows like n squared. */
export function pairCountSteps(a: number[]): Frame[] {
  const f: Frame[] = [mk(a, "Two nested loops: for each i, j runs over every later index. We count how many pairs get visited.")];
  let k = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
    k++;
    f.push(mk(a, `Pair #${k}: a[${i}] = ${a[i]} with a[${j}] = ${a[j]}.`, [i, "i"], [j, "j"]));
  }
  const n = a.length;
  f.push(mk(a, `Done: ${k} pairs for n = ${n}. The formula n × (n − 1) / 2 gives ${(n * (n - 1)) / 2}. Double n and the pairs roughly quadruple.`));
  return f;
}

/** Reverse an array in place by swapping from both ends: indices, values, and swaps. */
export function reverseSteps(input: number[]): Frame[] {
  const a = [...input], f: Frame[] = [mk(a, "Goal: reverse the array in place. Use one index at each end.")];
  for (let i = 0, j = a.length - 1; i < j; i++, j--) {
    f.push(mk(a, `i = ${i}, j = ${j}: the values ${a[i]} and ${a[j]} are about to swap.`, [i, "i"], [j, "j"]));
    [a[i], a[j]] = [a[j], a[i]];
    f.push(mk(a, `Swapped. a[${i}] = ${a[i]} and a[${j}] = ${a[j]}. Move both indices inward.`, [i, "swap"], [j, "swap"]));
  }
  f.push(mk(a, a.length % 2 ? "The indices met at the middle element, which stays where it is. Reversed." : "The indices crossed. Reversed."));
  return f;
}

/** A binary search tree of seven values, traversed in the chosen order. Numbers under nodes show visit position. */
const TREE = {
  nodes: [
    { id: "8", x: 150, y: 20 }, { id: "4", x: 80, y: 70 }, { id: "12", x: 220, y: 70 },
    { id: "2", x: 45, y: 125 }, { id: "6", x: 115, y: 125 }, { id: "10", x: 185, y: 125 }, { id: "14", x: 255, y: 125 },
  ],
  kids: { "8": ["4", "12"], "4": ["2", "6"], "12": ["10", "14"] } as Record<string, string[]>,
};
export function treeTraversalSteps(kind: "pre" | "in" | "post" | "level"): GraphFrame[] {
  const edges = Object.entries(TREE.kids).flatMap(([a, ks]) => ks.map((b) => ({ a, b })));
  const f: GraphFrame[] = [];
  const state: GraphFrame["state"] = {}, text: Record<string, string> = {}, order: string[] = [], stack: string[] = [];
  const snap = (note: string, label = "Call stack (top on the right)", items: string[] = stack): GraphFrame => ({ nodes: TREE.nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e })), state: { ...state }, text: { ...text }, structure: { label, items: [...items] }, order: [...order], note });
  const record = (u: string) => { order.push(u); text[u] = `#${order.length}`; f.push(snap(`Visit ${u}: it is number ${order.length} in the ${kind === "pre" ? "preorder" : kind === "in" ? "inorder" : "postorder"} sequence.`)); };
  if (kind === "level") {
    const queue = ["8"]; state["8"] = "queued";
    f.push(snap("Level order is BFS on a tree: start with the root in the queue.", "Queue (front on the left)", queue));
    while (queue.length) {
      const u = queue.shift()!; state[u] = "cur"; order.push(u); text[u] = `#${order.length}`;
      f.push(snap(`Dequeue ${u} and visit it (number ${order.length}).`, "Queue (front on the left)", queue));
      for (const k of TREE.kids[u] ?? []) { state[k] = "queued"; queue.push(k); }
      if (TREE.kids[u]) f.push(snap(`Enqueue the children of ${u}: ${TREE.kids[u].join(" and ")}.`, "Queue (front on the left)", queue));
      state[u] = "done";
    }
    f.push(snap(`Done. Level order ${order.join(" ")} reads the tree row by row.`, "Queue (front on the left)", queue));
    return f;
  }
  const go = (u: string) => {
    state[u] = "cur"; stack.push(u);
    f.push(snap(`Enter ${u}.${kind === "pre" ? " Preorder visits a node as soon as it is entered." : ""}`));
    if (kind === "pre") record(u);
    const [l, r] = TREE.kids[u] ?? [];
    if (l) { f.push(snap(`${u}: go to the left child ${l}.`)); go(l); state[u] = "cur"; }
    if (kind === "in") record(u);
    if (r) { f.push(snap(`${u}: go to the right child ${r}.`)); go(r); state[u] = "cur"; }
    if (kind === "post") record(u);
    state[u] = "done"; stack.pop();
    f.push(snap(`Finished ${u}; return to its parent.`));
  };
  go("8");
  f.push(snap(`Done. The ${kind === "pre" ? "preorder" : kind === "in" ? "inorder" : "postorder"} sequence is ${order.join(" ")}.${kind === "in" ? " It is sorted: that is the binary-search-tree property at work." : ""}`));
  return f;
}

/** Reversing a singly linked list one pointer at a time. Nodes sit in a row; arrows are the `next` pointers. */
export function listReverseSteps(vals: number[]): GraphFrame[] {
  const ids = vals.map(String), n = ids.length;
  const nodes = ids.map((id, i) => ({ id, x: 30 + i * (240 / Math.max(1, n - 1)), y: 40 }));
  const next: Record<string, string | null> = {};
  ids.forEach((id, i) => { next[id] = i + 1 < n ? ids[i + 1] : null; });
  const f: GraphFrame[] = [];
  let prev: string | null = null, cur: string | null = ids[0];
  const state: GraphFrame["state"] = {};
  const snap = (note: string, nxt?: string | null): GraphFrame => {
    const text: Record<string, string> = {};
    if (prev) text[prev] = "prev";
    if (cur) text[cur] = text[cur] ? `${text[cur]}/cur` : "cur";
    if (nxt) text[nxt] = text[nxt] ? `${text[nxt]}/next` : "next";
    const edges = ids.flatMap((a) => (next[a] ? [{ a, b: next[a]!, directed: true }] : []));
    return { nodes: nodes.map((x) => ({ ...x })), edges, state: { ...state }, text, structure: { label: "Pointers", items: [`prev = ${prev ?? "None"}`, `cur = ${cur ?? "None"}`] }, order: [], note };
  };
  ids.forEach((id) => { state[id] = "queued"; });
  f.push(snap("Each arrow is a node's `next` pointer. We will turn every arrow around, using prev and cur to walk down the list."));
  while (cur) {
    const nxt: string | null = next[cur];
    state[cur] = "cur";
    f.push(snap(`Save the next node first: next = ${nxt ?? "None"}. If we flipped the arrow now, we would lose the rest of the list.`, nxt));
    next[cur] = prev;
    f.push(snap(`Flip ${cur}'s pointer to point at prev (${prev ?? "None"}).`, nxt));
    state[cur] = "done"; prev = cur; cur = nxt;
    f.push(snap(`Advance: prev = ${prev}, cur = ${cur ?? "None"}.`));
  }
  f.push(snap(`Done. prev (${prev}) is the new head: the list now reads ${[...ids].reverse().join(" → ")}.`));
  return f;
}

/** Activity selection: sort by finishing time, take every interval that starts after the last chosen one ends. */
export function intervalGreedySteps(iv: [number, number][]): Frame[] {
  const s = [...iv].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const labels = s.map(([a, b]) => `${a}-${b}`);
  const status: Cell[] = Array(s.length).fill("·");
  const picked: number[] = [], skipped: number[] = [];
  const snap = (note: string, cur?: number): Frame => ({
    ...mk(labels, note, ...picked.map((i): [number, string] => [i, "win"]), ...(cur !== undefined ? [[cur, "cmp"] as [number, string]] : [])),
    aux: [{ label: "decision (✓ picked, ✗ skipped)", values: [...status], marks: {} }], dim: skipped,
  });
  const f: Frame[] = [snap("Intervals sorted by finishing time (start-end). Rule: pick an interval if it starts at or after the end of the last pick.")];
  let last = -Infinity;
  s.forEach(([a, b], i) => {
    if (a >= last) {
      status[i] = "✓"; picked.push(i);
      f.push(snap(`${a}-${b}: starts at ${a}, ${last === -Infinity ? "nothing is picked yet" : `last pick ended at ${last}, and ${a} ≥ ${last}`}. Pick it. The last end is now ${b}.`, i));
      last = b;
    } else {
      status[i] = "✗"; skipped.push(i);
      f.push(snap(`${a}-${b}: starts at ${a}, before the last pick ended at ${last}. It overlaps, so skip it.`, i));
    }
  });
  f.push(snap(`Done: ${picked.length} non-overlapping intervals chosen. No other choice rule can fit more.`));
  return f;
}

const HPOS = [[150, 20], [80, 70], [220, 70], [45, 125], [115, 125], [185, 125], [255, 125]];

/** Min-heap: insert `insertVal` (sift up), then extract the minimum (sift down). Drawn as a tree, with the array form beneath. */
export function heapSteps(initial: number[], insertVal: number): GraphFrame[] {
  const h = [...initial], f: GraphFrame[] = [];
  const snap = (note: string, hi: Record<number, "cur" | "queued" | "done"> = {}): GraphFrame => ({
    nodes: h.map((v, i) => ({ id: String(i), x: HPOS[i][0], y: HPOS[i][1], label: String(v) })),
    edges: h.flatMap((_, i) => (i > 0 ? [{ a: String(Math.floor((i - 1) / 2)), b: String(i) }] : [])),
    state: Object.fromEntries(Object.entries(hi).map(([k, v]) => [k, v])),
    text: {}, structure: { label: "Array form (index 0 first)", items: h.map(String) }, order: [], note,
  });
  f.push(snap("A min-heap: every parent is less than or equal to its children, so the smallest value is always at the root. It lives in an array: the children of index i are at 2i + 1 and 2i + 2."));
  h.push(insertVal);
  let i = h.length - 1;
  f.push(snap(`Insert ${insertVal}: place it at the end (index ${i}), the only spot that keeps the tree complete.`, { [i]: "cur" }));
  while (i > 0) {
    const p = Math.floor((i - 1) / 2);
    f.push(snap(`Sift up: compare ${h[i]} with its parent ${h[p]}.`, { [i]: "cur", [p]: "queued" }));
    if (h[i] >= h[p]) { f.push(snap(`${h[p]} is not larger than ${h[i]}, so the heap property holds. Stop.`, { [i]: "done" })); break; }
    [h[i], h[p]] = [h[p], h[i]];
    f.push(snap(`${h[i]} is larger than ${h[p]}, so swap: ${h[p]} moves up to index ${p}.`, { [p]: "cur", [i]: "queued" }));
    i = p;
  }
  if (i === 0) f.push(snap(`${h[0]} reached the root: it is the new minimum.`, { 0: "done" }));
  const min = h[0];
  f.push(snap(`Extract-min: the answer is the root, ${min}. To remove it, move the last element into the root's place.`, { 0: "cur" }));
  const last = h.pop()!;
  if (h.length > 0) {
    h[0] = last;
    f.push(snap(`${last} moves to the root. The shape is complete again but the order may be broken.`, { 0: "cur" }));
    i = 0;
    for (;;) {
      const l = 2 * i + 1, r = 2 * i + 2;
      let sm = i;
      if (l < h.length && h[l] < h[sm]) sm = l;
      if (r < h.length && h[r] < h[sm]) sm = r;
      const kids = [l, r].filter((k) => k < h.length);
      const hi: Record<number, "cur" | "queued"> = { [i]: "cur" };
      kids.forEach((k) => { hi[k] = "queued"; });
      f.push(snap(kids.length ? `Sift down: compare ${h[i]} with its ${kids.length === 2 ? "children" : "child"} ${kids.map((k) => h[k]).join(" and ")}.` : `${h[i]} has no children, so it stays.`, hi));
      if (sm === i) { f.push(snap(`${h[i]} is not larger than its children. The heap property holds again. Stop.`, { [i]: "done" })); break; }
      [h[i], h[sm]] = [h[sm], h[i]];
      f.push(snap(`Swap with the smaller child: ${h[i]} moves up, ${h[sm]} moves down.`, { [sm]: "cur", [i]: "queued" }));
      i = sm;
    }
  }
  f.push(snap(`Done: extracted ${min}, and the remaining values form a valid min-heap again.`));
  return f;
}

/** A for loop with an if/else inside: each number is labelled odd or even. */
export function loopIfSteps(n: number): Frame[] {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  const label: Cell[] = Array(n).fill("·");
  const snap = (note: string, i?: number): Frame => ({ ...mk(a, note, ...(i !== undefined ? [[i, "i"] as [number, string]] : [])), aux: [{ label: "label", values: [...label], marks: {} }] });
  const f: Frame[] = [snap("`for x in numbers:` takes the values one at a time. Inside, `if x % 2 == 0` chooses between two branches.")];
  a.forEach((x, i) => {
    const even = x % 2 === 0;
    label[i] = even ? "even" : "odd";
    f.push(snap(`x = ${x}. ${x} % 2 is ${x % 2}, so the condition \`${x} % 2 == 0\` is ${even ? "True: run the if branch" : "False: run the else branch"} and label it ${label[i]}.`, i));
  });
  f.push(snap(`The loop is finished: ${a.filter((x) => x % 2 === 0).length} even and ${a.filter((x) => x % 2 === 1).length} odd numbers.`));
  return f;
}

/** The main slice forms on a six-item list, with the chosen items highlighted and the result shown beneath. */
export function sliceSteps(a: number[]): Frame[] {
  const n = a.length;
  const specs: { code: string; idx: number[]; why: string }[] = [
    { code: "a[1:4]", idx: [1, 2, 3], why: "starts at index 1 and stops before index 4" },
    { code: "a[:3]", idx: [0, 1, 2], why: "the start defaults to 0: the first three items" },
    { code: "a[-2:]", idx: [n - 2, n - 1], why: "a negative start counts from the end: the last two items" },
    { code: "a[::2]", idx: Array.from({ length: Math.ceil(n / 2) }, (_, i) => i * 2), why: "a step of 2 takes every second item" },
    { code: "a[::-1]", idx: Array.from({ length: n }, (_, i) => n - 1 - i), why: "a step of -1 walks backwards: a reversed copy" },
  ];
  const f: Frame[] = [mk(a, "A slice a[start:stop:step] makes a new list. Watch which items each form selects.")];
  for (const sp of specs) {
    f.push({ ...mk(a, `${sp.code}: ${sp.why}.`, ...sp.idx.map((i): [number, string] => [i, "win"])), aux: [{ label: `${sp.code} gives`, values: sp.idx.map((i) => a[i]), marks: {} }] });
  }
  return f;
}

/** A toy hash table with five buckets: hash(key) = sum of letter codes mod 5. Shows a collision and two lookups. */
export function hashTableSteps(): Frame[] {
  const keys = ["cat", "dog", "owl", "hen", "ant"], B = 5;
  const h = (k: string) => [...k].reduce((s, c) => s + c.charCodeAt(0), 0) % B;
  const buckets: string[][] = Array.from({ length: B }, () => []);
  const snap = (note: string, mark?: number): Frame => ({
    ...mk(buckets.map((b) => b.length), note, ...(mark !== undefined ? [[mark, "cmp"] as [number, string]] : [])),
    aux: [{ label: "first key in bucket", values: buckets.map((b) => b[0] ?? "·"), marks: {} }, { label: "second key (collision)", values: buckets.map((b) => b[1] ?? "·"), marks: {} }],
  });
  const f: Frame[] = [snap("Five buckets, numbered 0 to 4, each starting empty. The number inside a bucket is how many keys it holds. A hash function turns a key into a bucket number.")];
  for (const k of keys) {
    const idx = h(k), sum = [...k].reduce((s, c) => s + c.charCodeAt(0), 0);
    f.push(snap(`Insert "${k}": the letter codes add up to ${sum}, and ${sum} mod ${B} = ${idx}. Go to bucket ${idx}.`, idx));
    buckets[idx].push(k);
    f.push(snap(buckets[idx].length > 1 ? `Bucket ${idx} already holds "${buckets[idx][0]}": a **collision**. Both keys share the bucket and are kept in a short list.` : `Bucket ${idx} was empty, so "${k}" goes straight in.`, idx));
  }
  for (const k of ["ant", "cow"]) {
    const idx = h(k);
    f.push(snap(`Look up "${k}": hash it to bucket ${idx} without searching anywhere else.`, idx));
    const pos = buckets[idx].indexOf(k);
    f.push(snap(pos >= 0 ? `Scan the short list in bucket ${idx}: ${buckets[idx].slice(0, pos + 1).map((x) => `"${x}"`).join(", then ")}. Found "${k}" after ${pos + 1} comparison${pos ? "s" : ""}.` : `Scan bucket ${idx}: ${buckets[idx].map((x) => `"${x}" is not "${k}"`).join("; ")}. The list ends, so "${k}" is not in the table.`, idx));
  }
  return f;
}

/** zip pairs items of two lists at the same position. */
export function zipSteps(a: Cell[], b: Cell[]): Frame[] {
  const n = Math.min(a.length, b.length);
  const f: Frame[] = [{ ...mk(a, "`zip(names, scores)` walks both lists in step and yields one pair per position, stopping at the shorter list."), aux: [{ label: "scores", values: b, marks: {} }] }];
  for (let i = 0; i < n; i++) f.push({ ...mk(a, `Pair ${i + 1}: (${JSON.stringify(a[i])}, ${JSON.stringify(b[i])}).`, [i, "cmp"]), aux: [{ label: "scores", values: b, marks: { [i]: ["cmp"] } }] });
  f.push({ ...mk(a, `Done: ${n} pairs. \`dict(zip(names, scores))\` would turn these pairs into a dictionary.`), aux: [{ label: "scores", values: b, marks: {} }] });
  return f;
}

/** Which indices different range() calls visit on a five-item list: the off-by-one picture. */
export function rangeBoundsSteps(): Frame[] {
  const a = [10, 20, 30, 40, 50];
  const specs: { code: string; idx: number[]; note: string }[] = [
    { code: "range(5)", idx: [0, 1, 2, 3, 4], note: "starts at 0 and stops before 5: every index. This is `range(len(a))`." },
    { code: "range(1, 5)", idx: [1, 2, 3, 4], note: "starts at 1, so the first item is skipped." },
    { code: "range(4)", idx: [0, 1, 2, 3], note: "stops before 4: the last item is missed. This is the classic off-by-one." },
    { code: "range(0, 5, 2)", idx: [0, 2, 4], note: "a step of 2: every second index." },
    { code: "range(4, -1, -1)", idx: [4, 3, 2, 1, 0], note: "walks backwards from the last index, stopping before -1, so it still reaches 0." },
  ];
  const f: Frame[] = [mk(a, "`range(start, stop, step)` includes start and excludes stop. A list of 5 items has valid indices 0 to 4.")];
  for (const sp of specs) f.push(mk(a, `${sp.code}: ${sp.note}`, ...sp.idx.map((i): [number, string] => [i, "win"])));
  f.push(mk(a, "`range(6)` would also produce 5, but `a[5]` does not exist and raises an IndexError. The stop value is never included, so `len(a)` is the right stop."));
  return f;
}

/** Sieve of Eratosthenes on 2..limit: cross out multiples of each prime starting at its square. */
export function sieveSteps(limit = 25): Frame[] {
  const nums = Array.from({ length: limit - 1 }, (_, i) => i + 2);
  const crossed = new Set<number>();
  const f: Frame[] = [mk(nums, `List every number from 2 to ${limit}. Assume all are prime until proven otherwise, then cross out multiples.`)];
  for (let p = 2; p * p <= limit; p++) {
    const idx = p - 2;
    if (crossed.has(idx)) { f.push({ ...mk(nums, `${p} was already crossed out, so it is not prime. Skip it.`, [idx, "i"]), dim: [...crossed] }); continue; }
    const fresh: number[] = [];
    for (let m = p * p; m <= limit; m += p) if (!crossed.has(m - 2)) { crossed.add(m - 2); fresh.push(m - 2); }
    f.push({ ...mk(nums, `${p} is still standing, so it is prime. Cross out its multiples starting at ${p}² = ${p * p}: ${fresh.map((i) => nums[i]).join(", ")}${p > 2 ? " (smaller multiples were already crossed out by smaller primes)" : ""}.`, [idx, "i"], ...fresh.map((i): [number, string] => [i, "cmp"])), dim: [...crossed] });
  }
  const primes = nums.map((_, i) => i).filter((i) => !crossed.has(i));
  f.push({ ...mk(nums, `Every number up to √${limit} has been used. What is left standing is prime: ${primes.map((i) => nums[i]).join(", ")} (${primes.length} primes).`, ...primes.map((i): [number, string] => [i, "win"])), dim: [...crossed] });
  return f;
}

/** Euclid's algorithm: gcd(a, b) = gcd(b, a mod b) until b is 0. */
export function gcdSteps(a: number, b: number): Frame[] {
  const f: Frame[] = [mk([a, b], `Find gcd(${a}, ${b}), the largest number that divides both.`, [0, "i"], [1, "j"])];
  while (b !== 0) {
    const r = a % b;
    f.push(mk([a, b], `${a} mod ${b} = ${r}. A number divides both ${a} and ${b} exactly when it divides both ${b} and ${r}, so gcd(${a}, ${b}) = gcd(${b}, ${r}).`, [0, "i"], [1, "j"]));
    [a, b] = [b, r];
    f.push(mk([a, b], `New pair: (${a}, ${b}).${b === 0 ? "" : " The numbers shrink every step."}`, [0, "i"], [1, "j"]));
  }
  f.push(mk([a, b], `The second number is 0, so the answer is the first: gcd = ${a}.`, [0, "win"]));
  return f;
}

/** Kahn's algorithm: repeatedly take a node with no unfinished prerequisites. */
function kahn(nodes: { id: string; x: number; y: number }[], edges: [string, string][]): GraphFrame[] {
  const indeg: Record<string, number> = {}, outs: Record<string, string[]> = {};
  nodes.forEach((n) => { indeg[n.id] = 0; outs[n.id] = []; });
  edges.forEach(([a, b]) => { indeg[b]++; outs[a].push(b); });
  const queue = nodes.filter((n) => indeg[n.id] === 0).map((n) => n.id), order: string[] = [], state: GraphFrame["state"] = {};
  queue.forEach((q) => { state[q] = "queued"; });
  const snap = (note: string): GraphFrame => ({
    nodes: nodes.map((n) => ({ ...n })), edges: edges.map(([a, b]) => ({ a, b, directed: true })), state: { ...state },
    text: Object.fromEntries(nodes.filter((n) => state[n.id] !== "done").map((n) => [n.id, `in ${indeg[n.id]}`])),
    structure: { label: "Queue of ready nodes (front on the left)", items: [...queue] }, order: [...order], note,
  });
  const f: GraphFrame[] = [snap(`An arrow A → B means A must come before B. “in” is the number of unfinished prerequisites. Nodes with in = 0 are ready now: ${queue.join(", ") || "none"}.`)];
  while (queue.length) {
    const u = queue.shift()!;
    state[u] = "cur"; order.push(u);
    f.push(snap(`Take ${u}: nothing it needs is unfinished, so it goes next in the order (position ${order.length}).`));
    for (const v of outs[u]) {
      indeg[v]--;
      if (indeg[v] === 0) { state[v] = "queued"; queue.push(v); }
      f.push(snap(`${u} is done, so remove its arrow to ${v}: in(${v}) is now ${indeg[v]}${indeg[v] === 0 ? ". It is free, so add it to the queue" : ""}.`));
    }
    state[u] = "done";
  }
  const left = nodes.filter((n) => !order.includes(n.id)).map((n) => n.id);
  f.push(snap(left.length === 0 ? `Order: ${order.join(" ")}. Every arrow points forward, so this is a valid topological order.` : `The queue is empty but only ${order.length} of ${nodes.length} nodes were taken. ${left.join(", ")} each wait on another unfinished node: they form a cycle, so no valid order exists.`));
  return f;
}
export const topoSteps = () => kahn(
  [{ id: "A", x: 30, y: 30 }, { id: "B", x: 30, y: 110 }, { id: "C", x: 110, y: 30 }, { id: "D", x: 110, y: 110 }, { id: "E", x: 190, y: 70 }, { id: "F", x: 270, y: 70 }],
  [["A", "C"], ["B", "C"], ["B", "D"], ["C", "E"], ["D", "E"], ["E", "F"]]);
export const topoCycleSteps = () => kahn(
  [{ id: "A", x: 30, y: 70 }, { id: "B", x: 110, y: 70 }, { id: "C", x: 190, y: 30 }, { id: "D", x: 190, y: 110 }],
  [["A", "B"], ["B", "C"], ["C", "D"], ["D", "B"]]);

/** Top-down merge sort: shows each merge of two sorted halves, one comparison at a time. */
export function mergeSortSteps(input: number[]): Frame[] {
  const a = [...input], f: Frame[] = [mk(a, "Merge sort: split the list in half, sort each half, then merge the two sorted halves into one.")];
  const seg = (lo: number, mid: number, hi: number): [number, string][] => [...Array.from({ length: mid - lo }, (_, k): [number, string] => [lo + k, "L"]), ...Array.from({ length: hi - mid }, (_, k): [number, string] => [mid + k, "R"])];
  const sort = (lo: number, hi: number) => {
    if (hi - lo <= 1) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid); sort(mid, hi);
    const out: number[] = []; let i = lo, j = mid;
    f.push({ ...mk(a, `Merge the sorted halves [${a.slice(lo, mid).join(", ")}] (blue) and [${a.slice(mid, hi).join(", ")}] (red).`, ...seg(lo, mid, hi)), aux: [{ label: "merged so far", values: [], marks: {} }] });
    while (i < mid || j < hi) {
      const takeLeft = j >= hi || (i < mid && a[i] <= a[j]);
      const v = takeLeft ? a[i] : a[j];
      const note = i < mid && j < hi ? `Compare ${a[i]} and ${a[j]}: the smaller is ${v}, so take it from the ${takeLeft ? "left" : "right"} half.` : `One half is empty, so take the rest: ${v}.`;
      f.push({ ...mk(a, note, ...(i < mid ? [[i, "i"] as [number, string]] : []), ...(j < hi ? [[j, "j"] as [number, string]] : []), ...seg(lo, mid, hi)), aux: [{ label: "merged so far", values: [...out], marks: {} }] });
      out.push(v); if (takeLeft) i++; else j++;
    }
    out.forEach((v, k) => { a[lo + k] = v; });
    f.push(mk(a, `Segment [${lo}..${hi - 1}] is now sorted: ${out.join(", ")}.`, ...out.map((_, k): [number, string] => [lo + k, "win"])));
  };
  sort(0, a.length);
  f.push(mk(a, `Done: ${a.join(", ")}. Each level of merging did about n comparisons, and there are about log₂ n levels.`));
  return f;
}

/** Cyclic sort for values 1..n: put each value at index value − 1 by swapping. */
export function cyclicSortSteps(input: number[]): Frame[] {
  const a = [...input], n = a.length, f: Frame[] = [mk(a, `Values are 1 to ${n}, so value v belongs at index v − 1. Swap each value toward its home.`)];
  let i = 0;
  while (i < n) {
    const j = a[i] - 1;
    if (a[i] !== a[j]) {
      f.push(mk(a, `a[${i}] = ${a[i]} belongs at index ${j}, where ${a[j]} sits. Swap them.`, [i, "i"], [j, "j"]));
      [a[i], a[j]] = [a[j], a[i]];
      f.push(mk(a, `Swapped. ${a[j]} is now at its home index ${j}. Look at index ${i} again.`, [j, "win"], [i, "i"]));
    } else {
      f.push(mk(a, a[i] === i + 1 ? `a[${i}] = ${a[i]} is already home. Move on.` : `a[${i}] = ${a[i]} belongs at index ${j}, which already holds ${a[j]}. Move on.`, [i, "i"]));
      i++;
    }
  }
  f.push(mk(a, `Sorted in place with only swaps: ${a.join(", ")}. Every swap put one value at its final position, so there are at most n swaps.`, ...a.map((_, k): [number, string] => [k, "win"])));
  return f;
}

/** Backtracking: place n queens row by row on an n x n board; undo a placement when a row has no safe square. */
export function queensSteps(n = 4): GridFrame[] {
  const board: (Cell | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  const labels = Array.from({ length: n }, (_, i) => i), queens: number[] = [], f: GridFrame[] = [];
  const snap = (note: string, active?: [number, number], deps?: [number, number][]): GridFrame => ({ rowLabels: labels, colLabels: labels, cells: board.map((r) => [...r]), active, deps, note });
  f.push(snap(`Place ${n} queens so none attacks another (same row, column or diagonal). Q marks a queen. We fill one row at a time, trying columns left to right.`));
  const go = (r: number): boolean => {
    if (r === n) { f.push(snap(`All ${n} queens are placed and none attacks another: a solution.`)); return true; }
    for (let c = 0; c < n; c++) {
      let hit: [number, number] | undefined;
      for (let k = 0; k < r; k++) if (queens[k] === c || Math.abs(queens[k] - c) === r - k) { hit = [k, queens[k]]; break; }
      if (hit) { f.push(snap(`Row ${r}, column ${c}: attacked by the queen at row ${hit[0]}, column ${hit[1]}. Skip it.`, [r, c], [hit])); continue; }
      queens.push(c); board[r][c] = "Q";
      f.push(snap(`Row ${r}, column ${c} is safe. Place a queen and move to row ${r + 1}.`, [r, c]));
      if (go(r + 1)) return true;
      queens.pop(); board[r][c] = null;
      f.push(snap(`Every square in row ${r + 1} failed. Backtrack: remove the queen at row ${r}, column ${c} and try the next column.`, [r, c]));
    }
    return false;
  };
  go(0);
  return f;
}

const WG = {
  nodes: [{ id: "A", x: 30, y: 75 }, { id: "B", x: 95, y: 20 }, { id: "C", x: 120, y: 62 }, { id: "D", x: 200, y: 20 }, { id: "E", x: 270, y: 75 }, { id: "F", x: 195, y: 132 }],
  edges: [["A", "B", 7], ["A", "C", 9], ["A", "F", 14], ["B", "C", 10], ["B", "D", 15], ["C", "D", 11], ["C", "F", 2], ["D", "E", 6], ["E", "F", 9]] as [string, string, number][],
};

/** Dijkstra from A on a weighted undirected graph. Numbers under nodes are the best distance found so far. */
export function dijkstraSteps(): GraphFrame[] {
  const inf = Infinity, dist: Record<string, number> = {}, state: GraphFrame["state"] = {}, adj: Record<string, [string, number][]> = {};
  WG.nodes.forEach((n) => { dist[n.id] = inf; adj[n.id] = []; });
  WG.edges.forEach(([a, b, w]) => { adj[a].push([b, w]); adj[b].push([a, w]); });
  dist.A = 0;
  const pq: [number, string][] = [[0, "A"]]; const order: string[] = []; let mark: { a: string; b: string } | null = null;
  const snap = (note: string): GraphFrame => ({
    nodes: WG.nodes.map((n) => ({ ...n })),
    edges: WG.edges.map(([a, b, w]) => ({ a, b, w, mark: mark && ((mark.a === a && mark.b === b) || (mark.a === b && mark.b === a)) ? "cur" as const : undefined })),
    state: { ...state }, text: Object.fromEntries(WG.nodes.map((n) => [n.id, dist[n.id] === inf ? "∞" : String(dist[n.id])])),
    structure: { label: "Priority queue, smallest first (node:distance)", items: [...pq].sort((x, y) => x[0] - y[0] || x[1].localeCompare(y[1])).map(([d, v]) => `${v}:${d}`) },
    order: [...order], note,
  });
  state.A = "queued";
  const f: GraphFrame[] = [snap("Distance from A: 0 for A itself and ∞ (unknown) for everyone else. Numbers on edges are lengths. The queue holds the best candidate for each node found so far.")];
  while (pq.length) {
    pq.sort((x, y) => x[0] - y[0] || x[1].localeCompare(y[1]));
    const [d, u] = pq.shift()!;
    if (d > dist[u]) { f.push(snap(`Pop ${u}:${d}, but ${u} already has a better distance (${dist[u]}). This stale entry is skipped.`)); continue; }
    state[u] = "cur"; order.push(u); mark = null;
    f.push(snap(`Pop ${u} with the smallest distance, ${d}. No unfinished node can reach ${u} more cheaply, since every other candidate is at least ${d} and edges are not negative. Its distance is final.`));
    for (const [v, w] of adj[u]) {
      if (state[v] === "done") continue;
      mark = { a: u, b: v };
      const nd = d + w;
      if (nd < dist[v]) {
        const old = dist[v]; dist[v] = nd; pq.push([nd, v]); state[v] = "queued";
        f.push(snap(`Relax ${u}–${v}: ${d} + ${w} = ${nd}, better than ${old === inf ? "∞" : old}. Update ${v} to ${nd} and queue it.`));
      } else f.push(snap(`Relax ${u}–${v}: ${d} + ${w} = ${nd} is no better than ${dist[v]}. Keep the old value.`));
    }
    mark = null; state[u] = "done";
  }
  f.push(snap(`Queue empty. Final distances from A: ${WG.nodes.map((n) => `${n.id} = ${dist[n.id]}`).join(", ")}. Note D = 20 comes through C (9 + 11), not through B (7 + 15 = 22).`));
  return f;
}

/** Kruskal on the same graph: sort edges by weight, take an edge unless it joins two nodes already connected. */
export function kruskalSteps(): GraphFrame[] {
  const parent: Record<string, string> = {}; WG.nodes.forEach((n) => { parent[n.id] = n.id; });
  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const sorted = [...WG.edges].sort((x, y) => x[2] - y[2] || x[0].localeCompare(y[0]));
  const marks = new Map<string, "pick" | "skip" | "cur">(); const key = (a: string, b: string) => `${a}${b}`;
  let total = 0, picked = 0;
  const groups = () => { const g: Record<string, string[]> = {}; WG.nodes.forEach((n) => { (g[find(n.id)] ??= []).push(n.id); }); return Object.values(g).map((m) => `{${m.join(",")}}`); };
  const snap = (note: string): GraphFrame => ({
    nodes: WG.nodes.map((n) => ({ ...n })), edges: WG.edges.map(([a, b, w]) => ({ a, b, w, mark: marks.get(key(a, b)) })),
    state: {}, text: Object.fromEntries(WG.nodes.map((n) => [n.id, `grp ${find(n.id)}`])),
    structure: { label: `Groups (picked ${picked} edges, total weight ${total})`, items: groups() }, order: [], note,
  });
  const f: GraphFrame[] = [snap("Kruskal: look at edges from lightest to heaviest. Take an edge unless its two ends are already in the same group (that would close a cycle). “grp” shows each node's group leader.")];
  for (const [a, b, w] of sorted) {
    if (picked === WG.nodes.length - 1) break;
    marks.set(key(a, b), "cur");
    f.push(snap(`Consider ${a}–${b} (weight ${w}): ${find(a) === find(b) ? `${a} and ${b} are already in the same group` : `${a} and ${b} are in different groups`}.`));
    if (find(a) !== find(b)) {
      parent[find(a)] = find(b); marks.set(key(a, b), "pick"); picked++; total += w;
      f.push(snap(`Take it. The two groups merge. Picked edges: ${picked}, total weight ${total}.`));
    } else { marks.set(key(a, b), "skip"); f.push(snap(`Skip it: taking it would create a cycle.`)); }
  }
  for (const [a, b] of sorted) if (!marks.has(key(a, b))) marks.set(key(a, b), "skip");
  f.push(snap(`Done: ${picked} edges connect all ${WG.nodes.length} nodes (always n − 1 for a tree), total weight ${total}. Every remaining edge would only close a cycle.`));
  return f;
}

/** 0/1 knapsack table: dp[i][w] = best value using the first i items with capacity w. */
export function knapsackSteps(weights: number[], values: number[], cap: number): GridFrame[] {
  const n = weights.length;
  const cells: (Cell | null)[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: cap + 1 }, (_, w) => (i === 0 || w === 0 ? 0 : null)));
  const rowLabels: Cell[] = ["none", ...weights.map((w, i) => `w${w} v${values[i]}`)], colLabels: Cell[] = Array.from({ length: cap + 1 }, (_, w) => w);
  const f: GridFrame[] = [];
  const snap = (note: string, active?: [number, number], deps?: [number, number][]): GridFrame => ({ rowLabels, colLabels, cells: cells.map((r) => [...r]), active, deps, note });
  f.push(snap(`dp[i][c] = the best total value using only the first i items with capacity c. Row 0 (no items) and column 0 (no capacity) are 0. Each item has a weight w and a value v.`));
  for (let i = 1; i <= n; i++) for (let c = 1; c <= cap; c++) {
    const wt = weights[i - 1], val = values[i - 1], skip = cells[i - 1][c] as number;
    if (wt > c) { cells[i][c] = skip; f.push(snap(`Item ${i} (weight ${wt}) does not fit in capacity ${c}, so copy the value above: ${skip}.`, [i, c], [[i - 1, c]])); continue; }
    const take = val + (cells[i - 1][c - wt] as number);
    cells[i][c] = Math.max(skip, take);
    f.push(snap(`Capacity ${c}, item ${i} (w${wt}, v${val}): skip it = ${skip}; take it = ${val} + dp[${i - 1}][${c - wt}] = ${take}. Best is ${cells[i][c]}.`, [i, c], [[i - 1, c], [i - 1, c - wt]]));
  }
  f.push(snap(`The bottom-right cell, ${cells[n][cap]}, is the best value for capacity ${cap}.`, [n, cap]));
  return f;
}

/** Fenwick tree (1-indexed). T[i] holds the sum of a block of a that ends at i and has length lowbit(i). Shows a prefix query, then a point update. */
export function fenwickSteps(): Frame[] {
  const a = [3, 2, -1, 6, 5, 4, -3, 3], n = a.length, T = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) { T[i] += a[i - 1]; const j = i + (i & -i); if (j <= n) T[j] += T[i]; }
  const low = (i: number) => i & -i;
  const block = (i: number): [number, string][] => Array.from({ length: low(i) }, (_, k): [number, string] => [i - low(i) + 1 + k, "win"]);
  const view = (note: string, marks: [number, string][] = [], covered: [number, string][] = []): Frame => ({
    ...mk(["·", ...T.slice(1)], note, ...marks), aux: [{ label: "original a (positions 1 to 8)", values: ["·", ...a], marks: covered.reduce<Record<number, string[]>>((m, [i, l]) => { (m[i] ??= []).push(l); return m; }, {}) }],
  });
  const f: Frame[] = [view("T[i] is the sum of the block of a that ends at position i and is lowbit(i) long (lowbit(i) = the lowest set bit of i). So T[4] covers positions 1 to 4, T[6] covers 5 to 6, T[7] covers 7 alone.")];
  let i = 7, total = 0;
  f.push(view("Query: the sum of the first 7 values. Start at i = 7 and repeatedly add T[i], then remove the lowest set bit: i = i − lowbit(i).", [[7, "i"]]));
  while (i > 0) {
    total += T[i];
    const next = i - low(i);
    f.push(view(`Add T[${i}] = ${T[i]} (it covers positions ${i - low(i) + 1} to ${i}). Running total ${total}. Next i = ${i} − lowbit(${i}) = ${i} − ${low(i)} = ${next}${next === 0 ? ", so stop" : ""}.`, [[i, "win"]], block(i)));
    i = next;
  }
  f.push(view(`The sum of a[1..7] is ${total}, found by reading only 3 cells (positions 7, 6 and 4) instead of 7.`, []));
  f.push(view("Update: add 5 to a[3]. Every block that contains position 3 must change. Start at i = 3 and repeatedly add the lowest set bit: i = i + lowbit(i).", [[3, "i"]]));
  i = 3;
  while (i <= n) {
    T[i] += 5;
    const next = i + low(i);
    f.push(view(`T[${i}] += 5, now ${T[i]} (its block covers position 3). Next i = ${i} + lowbit(${i}) = ${next}${next > n ? ", which is past 8, so stop" : ""}.`, [[i, "swap"]], block(i)));
    i = next;
  }
  f.push(view(`Only ${3} cells changed (positions 3, 4 and 8). A prefix sum array would have had to rewrite every cell from position 3 on.`));
  return f;
}

/** Min segment tree over [5,2,6,1,7,3,8,4]. Asks for the minimum over positions 2..6 and shows which nodes are taken whole. */
export function segQuerySteps(): GraphFrame[] {
  const a = [5, 2, 6, 1, 7, 3, 8, 4], n = a.length, ql = 2, qr = 6;
  const val: number[] = Array(2 * n).fill(Infinity), lo: number[] = [], hi: number[] = [];
  const build = (x: number, l: number, r: number) => { lo[x] = l; hi[x] = r; if (l === r) { val[x] = a[l]; return; } const m = (l + r) >> 1; build(2 * x, l, m); build(2 * x + 1, m + 1, r); val[x] = Math.min(val[2 * x], val[2 * x + 1]); };
  build(1, 0, n - 1);
  const pos: Record<number, { x: number; y: number }> = {};
  const place = (x: number, depth: number): number => { const px = lo[x] === hi[x] ? 22 + lo[x] * (256 / (n - 1)) : (place(2 * x, depth + 1) + place(2 * x + 1, depth + 1)) / 2; pos[x] = { x: px, y: 20 + depth * 48 }; return px; };
  place(1, 0);
  const ids = Object.keys(pos).map(Number);
  const edges = ids.filter((x) => x > 1).map((x) => ({ a: String(x >> 1), b: String(x) }));
  const state: GraphFrame["state"] = {}, taken: string[] = []; let best = Infinity;
  const snap = (note: string): GraphFrame => ({
    nodes: ids.map((x) => ({ id: String(x), x: pos[x].x, y: pos[x].y, label: String(val[x]) })), edges, state: { ...state },
    text: Object.fromEntries(ids.map((x) => [String(x), `${lo[x]}-${hi[x]}`])),
    structure: { label: `Minimum so far over positions ${ql}..${qr}`, items: [best === Infinity ? "none yet" : String(best)] }, order: [...taken], note,
  });
  const f: GraphFrame[] = [snap(`Each node shows the minimum of its range (the range is written under it). Query: the minimum over positions ${ql} to ${qr}. A node is taken whole if its range lies entirely inside the query, ignored if it lies outside, and opened if it overlaps partly.`)];
  const go = (x: number) => {
    const l = lo[x], r = hi[x];
    if (r < ql || l > qr) { state[x] = "hit"; f.push(snap(`Node ${l}-${r} is entirely outside ${ql}..${qr}: ignore it.`)); return; }
    if (ql <= l && r <= qr) { state[x] = "done"; best = Math.min(best, val[x]); taken.push(`${l}-${r}`); f.push(snap(`Node ${l}-${r} lies entirely inside ${ql}..${qr}: take its stored minimum ${val[x]} without looking at its children. Minimum so far ${best}.`)); return; }
    state[x] = "queued"; f.push(snap(`Node ${l}-${r} overlaps the query only partly: open it and look at both children.`));
    go(2 * x); go(2 * x + 1);
  };
  go(1);
  f.push(snap(`Done: the minimum over positions ${ql}..${qr} is ${best}, found by combining ${taken.length} whole nodes (${taken.join(", ")}) instead of scanning ${qr - ql + 1} values.`));
  return f;
}

/** Sparse table for range minimum on [5,2,6,1,7,3,8,4]: build levels, then answer queries with two overlapping blocks. */
export function sparseSteps(): Frame[] {
  const a = [5, 2, 6, 1, 7, 3, 8, 4], n = a.length, K = 3;
  const tbl: number[][] = [a];
  for (let k = 1; k <= K; k++) { const row: number[] = []; for (let i = 0; i + (1 << k) <= n; i++) row.push(Math.min(tbl[k - 1][i], tbl[k - 1][i + (1 << (k - 1))])); tbl.push(row); }
  const shown: Cell[][] = [1, 2, 3].map((k) => Array(n - (1 << k) + 1).fill("·"));
  const aux = (hl?: [number, number]) => [1, 2, 3].map((k) => ({ label: `k=${k}: min of ${1 << k} values`, values: [...shown[k - 1]], marks: hl && hl[0] === k ? { [hl[1]]: ["new"] } : {} }));
  const f: Frame[] = [{ ...mk(a, "A sparse table stores, for each start i and each power of two 2^k, the minimum of the block of 2^k values starting at i. Row k is built from row k − 1."), aux: aux() }];
  for (let k = 1; k <= K; k++) for (let i = 0; i + (1 << k) <= n; i++) {
    shown[k - 1][i] = tbl[k][i];
    f.push({ ...mk(a, `table[${k}][${i}] = min(table[${k - 1}][${i}], table[${k - 1}][${i + (1 << (k - 1))}]) = min(${tbl[k - 1][i]}, ${tbl[k - 1][i + (1 << (k - 1))]}) = ${tbl[k][i]}. It covers positions ${i} to ${i + (1 << k) - 1}.`, ...Array.from({ length: 1 << k }, (_, d): [number, string] => [i + d, "win"])), aux: aux([k, i]) });
  }
  for (const [l, r] of [[1, 6], [5, 7]] as [number, number][]) {
    const len = r - l + 1, k = Math.floor(Math.log2(len)), b1 = l, b2 = r - (1 << k) + 1;
    const ans = Math.min(tbl[k][b1], tbl[k][b2]);
    f.push({ ...mk(a, `Query min of positions ${l}..${r}: length ${len}, and the largest power of two that fits is ${1 << k} (k = ${k}). Use two blocks of ${1 << k}, one starting at ${b1} and one ending at ${r} (starting at ${b2}). They may overlap, which is harmless for min: min(table[${k}][${b1}], table[${k}][${b2}]) = min(${tbl[k][b1]}, ${tbl[k][b2]}) = ${ans}.`,
      ...Array.from({ length: 1 << k }, (_, d): [number, string] => [b1 + d, "L"]), ...Array.from({ length: 1 << k }, (_, d): [number, string] => [b2 + d, "R"])), aux: aux() });
  }
  return f;
}

const bitsLSB = (v: number, n = 8): number[] => Array.from({ length: n }, (_, i) => (v >> i) & 1);
const onesAt = (bs: number[]): Marks => { const m: Marks = {}; bs.forEach((b, i) => { if (b) m[i] = ["win"]; }); return m; };

/** Bit operations on 8-bit values, drawn lowest bit first so the index under each box is the bit position. */
export function bitOpsSteps(a = 12, b = 10): Frame[] {
  const mask = 255, row = (label: string, v: number) => ({ label, values: bitsLSB(v & mask) as Cell[], marks: onesAt(bitsLSB(v & mask)) });
  const snap = (note: string, ...rows: { label: string; v: number }[]): Frame => ({ ...mk(bitsLSB(a), note), aux: rows.map((r) => row(r.label, r.v)) });
  const f: Frame[] = [snap(`a = ${a} is 1100 in binary. The boxes show its bits lowest first, so the index under a box is the bit position: bits 2 and 3 are 1. (The value is 4 + 8 = 12.)`)];
  f.push(snap(`b = ${b} is 1010 in binary: bits 1 and 3 are 1.`, { label: `b = ${b}`, v: b }));
  f.push(snap(`a & b (AND) keeps a bit only when it is 1 in both. Only bit 3 is 1 in both, so the result is 8.`, { label: `b = ${b}`, v: b }, { label: `a & b = ${a & b}`, v: a & b }));
  f.push(snap(`a | b (OR) keeps a bit when it is 1 in either: bits 1, 2 and 3, so 2 + 4 + 8 = 14.`, { label: `b = ${b}`, v: b }, { label: `a | b = ${a | b}`, v: a | b }));
  f.push(snap(`a ^ b (XOR) keeps a bit when it is 1 in exactly one of them: bits 1 and 2, so 2 + 4 = 6. XOR is 1 where the two differ.`, { label: `b = ${b}`, v: b }, { label: `a ^ b = ${a ^ b}`, v: a ^ b }));
  f.push(snap(`Shifts slide every bit. a << 1 moves each bit one place up (doubling: 24). a >> 2 moves each bit two places down (dividing by 4, rounding down: 3).`, { label: `a << 1 = ${a << 1}`, v: a << 1 }, { label: `a >> 2 = ${a >> 2}`, v: a >> 2 }));
  f.push(snap(`Single-bit edits use a mask of one bit, 1 << k. Set bit 0: a | 1 = 13. Clear bit 2: a & ~(1 << 2) = 8. Toggle bit 3: a ^ (1 << 3) = 4.`, { label: `set bit 0 = ${a | 1}`, v: a | 1 }, { label: `clear bit 2 = ${a & ~(1 << 2)}`, v: a & ~(1 << 2) }, { label: `toggle bit 3 = ${a ^ (1 << 3)}`, v: a ^ (1 << 3) }));
  f.push(snap(`−a is stored as "flip every bit, then add 1" (two's complement; 244 in 8 bits). It matches a at the lowest set bit and is flipped above it, so a & −a keeps only that lowest set bit: ${a & -a}. This is lowbit, the move behind Fenwick trees.`, { label: `−a in 8 bits = ${(-a) & mask}`, v: -a }, { label: `a & −a = ${a & -a}`, v: a & -a }));
  f.push(snap(`a − 1 flips the lowest set bit to 0 and every bit below it to 1, so a & (a − 1) erases the lowest set bit: ${a & (a - 1)}. Repeating it until zero counts the set bits (Kernighan's trick).`, { label: `a − 1 = ${a - 1}`, v: a - 1 }, { label: `a & (a − 1) = ${a & (a - 1)}`, v: a & (a - 1) }));
  return f;
}

/** KMP prefix function: pi[i] is the length of the longest proper prefix of s[0..i] that is also a suffix of it. */
export function kmpPrefixSteps(s = "abacaba"): Frame[] {
  const n = s.length, chars = s.split(""), pi: Cell[] = Array(n).fill("·");
  const snap = (note: string, marks: [number, string][] = [], auxMarks: Marks = {}): Frame => ({ ...mk(chars, note, ...marks), aux: [{ label: "pi: longest border so far", values: [...pi], marks: auxMarks }] });
  pi[0] = 0;
  const f: Frame[] = [snap(`pi[i] is the length of the longest proper prefix of s[0..i] that is also a suffix of s[0..i] (a "border"). pi[0] = 0. We keep j = the current border length and compare s[i] with s[j].`)];
  let j = 0;
  for (let i = 1; i < n; i++) {
    while (j > 0 && s[i] !== s[j]) {
      f.push(snap(`i = ${i}: s[${i}] = '${s[i]}' does not match s[${j}] = '${s[j]}'. Fall back: the border of the border, j = pi[${j - 1}] = ${pi[j - 1]}.`, [[i, "i"], [j, "j"]]));
      j = pi[j - 1] as number;
    }
    if (s[i] === s[j]) {
      f.push(snap(`i = ${i}: s[${i}] = '${s[i]}' matches s[${j}] = '${s[j]}', so the border grows to ${j + 1}.`, [[i, "i"], [j, "j"]]));
      j++;
    } else f.push(snap(`i = ${i}: s[${i}] = '${s[i]}' does not match s[0] = '${s[0]}', so there is no border.`, [[i, "i"], [0, "j"]]));
    pi[i] = j;
    f.push(snap(`pi[${i}] = ${j}.`, [[i, "win"]], { [i]: ["new"] }));
  }
  f.push(snap(`Done: pi = [${pi.join(", ")}]. The pattern "${s}" has border length ${pi[n - 1]} at the end: its first ${pi[n - 1]} characters "${s.slice(0, pi[n - 1] as number)}" are also its last ${pi[n - 1]}.`));
  return f;
}

/** KMP search: the text pointer i only moves forward; on a mismatch the pattern slides using pi. */
export function kmpSearchSteps(text = "abcabcabd", pat = "abcabd"): Frame[] {
  const n = text.length, m = pat.length, pi: number[] = Array(m).fill(0);
  for (let i = 1, k = 0; i < m; i++) { while (k > 0 && pat[i] !== pat[k]) k = pi[k - 1]; if (pat[i] === pat[k]) k++; pi[i] = k; }
  const snap = (note: string, i: number, j: number, bad = false): Frame => {
    const off = i - j, placed: Cell[] = Array(n).fill("·");
    for (let k = 0; k < m; k++) if (off + k >= 0 && off + k < n) placed[off + k] = pat[k];
    const marks: [number, string][] = [];
    for (let k = Math.max(0, off); k < i; k++) marks.push([k, "win"]);
    if (i < n) marks.push([i, bad ? "swap" : "i"]);
    return { ...mk(text.split(""), note, ...marks), aux: [{ label: `pattern "${pat}" placed at offset ${off}`, values: placed, marks: off + j >= 0 && off + j < n ? { [off + j]: ["j"] } : {} }] };
  };
  const f: Frame[] = [snap(`Search for "${pat}" in "${text}". Its prefix function is [${pi.join(", ")}]. The text pointer i only ever moves forward; j says how many pattern characters are matched.`, 0, 0)];
  let j = 0;
  for (let i = 0; i < n; i++) {
    while (j > 0 && text[i] !== pat[j]) {
      f.push(snap(`Mismatch at text[${i}] = '${text[i]}' versus pattern[${j}] = '${pat[j]}'. The ${j} matched characters "${pat.slice(0, j)}" have border ${pi[j - 1]}, so slide the pattern right and set j = ${pi[j - 1]}. The text pointer stays at ${i}.`, i, j, true));
      j = pi[j - 1];
    }
    if (text[i] === pat[j]) j++;
    f.push(snap(`text[${i}] = '${text[i]}' ${j > 0 && text[i] === pat[j - 1] ? "matches" : "does not match"}. j = ${j}.`, i + 1, j));
    if (j === m) { f.push(snap(`All ${m} characters matched: found "${pat}" at index ${i - m + 1}. Set j = pi[${m - 1}] = ${pi[m - 1]} to keep looking for overlapping matches.`, i + 1, j)); j = pi[j - 1]; }
  }
  f.push(snap(`The scan is finished after looking at each text character once: O(n + m), however many times the pattern slid.`, n, 0));
  return f;
}

const TRIE_POS: Record<string, [number, number]> = { root: [150, 20], c: [90, 65], d: [215, 65], ca: [90, 110], do: [215, 110], car: [60, 155], cat: [125, 155], cart: [60, 200] };

/** A trie of car, cat, cart, do: insertion, then three look-ups. */
export function trieSteps(): GraphFrame[] {
  const words = ["car", "cat", "cart", "do"], present = new Set<string>(["root"]), ends = new Set<string>(), state: GraphFrame["state"] = {};
  let order: string[] = [];
  const snap = (note: string, path: string[] = []): GraphFrame => {
    const ids = [...present];
    const st: GraphFrame["state"] = {};
    ends.forEach((e) => { st[e] = "done"; });
    path.forEach((p) => { st[p] = "cur"; });
    return {
      nodes: ids.map((id) => ({ id, x: TRIE_POS[id][0], y: TRIE_POS[id][1], label: id === "root" ? "·" : id[id.length - 1] })),
      edges: ids.filter((id) => id !== "root").map((id) => ({ a: id.length === 1 ? "root" : id.slice(0, -1), b: id })),
      state: { ...state, ...st }, text: Object.fromEntries([...ends].map((e) => [e, e])),
      structure: { label: "Current path (letters followed)", items: order }, order: [], note,
    };
  };
  const f: GraphFrame[] = [snap(`A trie stores words letter by letter along a path from the root. Words that share a beginning share the nodes of that beginning. Green nodes mark where a stored word ends.`)];
  for (const w of words) {
    for (let k = 1; k <= w.length; k++) {
      const pre = w.slice(0, k); order = w.slice(0, k).split("");
      const existed = present.has(pre); present.add(pre);
      f.push(snap(existed ? `Insert "${w}": the letter '${w[k - 1]}' already has a child here, so follow it (the beginning "${pre}" is shared).` : `Insert "${w}": there is no child '${w[k - 1]}' here, so create a new node.`, [pre]));
    }
    ends.add(w);
    f.push(snap(`Mark the node for "${w}" as the end of a word.`, [w]));
  }
  const look = (q: string, kind: "word" | "prefix") => {
    let cur = "root", ok = true; const path: string[] = [];
    for (let k = 1; k <= q.length; k++) {
      const pre = q.slice(0, k); order = q.slice(0, k).split("");
      if (!present.has(pre)) { f.push(snap(`Look up "${q}": no child '${q[k - 1]}' under "${cur === "root" ? "" : cur}", so "${q}" is not in the trie.`, path)); ok = false; break; }
      path.push(pre); cur = pre; f.push(snap(`Look up "${q}": follow '${q[k - 1]}'.`, [...path]));
    }
    if (ok) f.push(snap(kind === "word" ? (ends.has(q) ? `The path for "${q}" exists and its last node is a word end: "${q}" is stored.` : `The path for "${q}" exists, but its last node is not a word end: "${q}" is only a prefix of stored words, not a stored word.`) : `The path for "${q}" exists, so some stored word starts with "${q}".`, path));
  };
  look("cat", "word"); look("ca", "word"); look("cow", "word");
  return f;
}

/** Pascal's triangle: C(n, r) = C(n-1, r-1) + C(n-1, r), with 1s on both edges. */
export function pascalSteps(rows = 7): GridFrame[] {
  const cells: (Cell | null)[][] = Array.from({ length: rows }, () => Array(rows).fill(null));
  const labels = Array.from({ length: rows }, (_, i) => i);
  const rowLabels: Cell[] = labels.map((n) => `n=${n}`), colLabels: Cell[] = labels.map((r) => `r=${r}`);
  const f: GridFrame[] = [];
  const snap = (note: string, active?: [number, number], deps?: [number, number][]): GridFrame => ({ rowLabels, colLabels, cells: cells.map((r) => [...r]), active, deps, note });
  f.push(snap("Cell (n, r) holds C(n, r): the number of ways to choose r items from n. Cells with r > n stay empty, because you cannot choose more items than there are."));
  for (let n = 0; n < rows; n++) for (let r = 0; r <= n; r++) {
    if (r === 0 || r === n) {
      cells[n][r] = 1;
      f.push(snap(n === 0 ? "C(0, 0) = 1: there is exactly one way to choose nothing from nothing." : r === 0 ? `C(${n}, 0) = 1: one way to choose nothing.` : `C(${n}, ${n}) = 1: one way to choose everything.`, [n, r]));
    } else {
      const a = cells[n - 1][r - 1] as number, b = cells[n - 1][r] as number;
      cells[n][r] = a + b;
      f.push(snap(`C(${n}, ${r}) = C(${n - 1}, ${r - 1}) + C(${n - 1}, ${r}) = ${a} + ${b} = ${a + b}. Either the first item is chosen (then choose ${r - 1} more from the other ${n - 1}) or it is not (then choose all ${r} from the other ${n - 1}).`, [n, r], [[n - 1, r - 1], [n - 1, r]]));
    }
  }
  f.push(snap(`Each row sums to 2^n (row ${rows - 1}: ${(cells[rows - 1] as number[]).filter((v) => v !== null).reduce((x, y) => x + y, 0)} = 2^${rows - 1}), because every subset of n items has some size r.`));
  return f;
}

/** Bitmask DP for the assignment problem: dp[mask] = cheapest way to give the first popcount(mask) workers the tasks in mask. */
export function bitmaskAssignSteps(): Frame[] {
  const C = [[9, 2, 7], [6, 4, 3], [5, 8, 1]], n = 3, size = 1 << n;
  const val: number[] = Array(size).fill(Infinity); val[0] = 0;
  const lab = (m: number) => m.toString(2).padStart(n, "0"), pop = (m: number) => m.toString(2).split("1").length - 1;
  const snap = (note: string, ...marks: [number, string][]): Frame => ({
    ...mk(val.map((v) => (v === Infinity ? "∞" : v)), note, ...marks),
    aux: [{ label: "tasks used (binary, task 0 on the right)", values: Array.from({ length: size }, (_, m) => lab(m)), marks: {} }, { label: "workers already assigned", values: Array.from({ length: size }, (_, m) => pop(m)), marks: {} }],
  });
  const f: Frame[] = [snap(`dp[mask] is the cheapest total cost when the first popcount(mask) workers have been given exactly the tasks whose bits are set in mask. Cost table (rows are workers, columns are tasks): ${C.map((r) => `[${r.join(", ")}]`).join(" ")}. dp[000] = 0: nobody assigned.`, [0, "i"])];
  for (let mask = 0; mask < size; mask++) {
    const k = pop(mask);
    if (k === n) continue;
    for (let j = 0; j < n; j++) {
      if (mask >> j & 1) continue;
      const nxt = mask | (1 << j), nd = val[mask] + C[k][j], old = val[nxt];
      val[nxt] = Math.min(old, nd);
      f.push(snap(`From mask ${lab(mask)} (cost ${val[mask]}): worker ${k} takes task ${j}, costing C[${k}][${j}] = ${C[k][j]}. New mask ${lab(nxt)}: ${val[mask]} + ${C[k][j]} = ${nd}, ${nd < old ? (old === Infinity ? "the first way found" : `better than ${old}`) : `no better than ${old}`}, so dp[${lab(nxt)}] = ${val[nxt]}.`, [mask, "i"], [nxt, "win"]));
    }
  }
  f.push(snap(`dp[111] = ${val[size - 1]} is the minimum total cost: worker 0 takes task 1 (2), worker 1 takes task 0 (6), worker 2 takes task 2 (1). Only ${size} states were needed instead of trying all 3! = 6 orders, and for n workers that is 2^n states instead of n! orders.`, [size - 1, "win"]));
  return f;
}

/** Tree DP: maximum total weight of nodes with no two adjacent. Each node stores (take, skip). */
export function treeDpSteps(): GraphFrame[] {
  const W: Record<string, number> = { A: 3, B: 4, C: 5, D: 1, E: 3, F: 2, G: 7 };
  const kids: Record<string, string[]> = { A: ["B", "C"], B: ["D", "E"], C: ["F"], F: ["G"], D: [], E: [], G: [] };
  const pos: Record<string, [number, number]> = { A: [150, 20], B: [80, 70], C: [220, 70], D: [45, 125], E: [115, 125], F: [220, 125], G: [220, 175] };
  const ids = Object.keys(W), edges = Object.entries(kids).flatMap(([a, ks]) => ks.map((b) => ({ a, b })));
  const post: string[] = []; const walk = (v: string) => { kids[v].forEach(walk); post.push(v); }; walk("A");
  const take: Record<string, number> = {}, skip: Record<string, number> = {}, state: GraphFrame["state"] = {};
  const snap = (note: string): GraphFrame => ({
    nodes: ids.map((id) => ({ id, x: pos[id][0], y: pos[id][1], label: String(W[id]) })), edges, state: { ...state },
    text: Object.fromEntries(Object.keys(take).map((v) => [v, `${take[v]}/${skip[v]}`])),
    structure: { label: "Computed so far, as node: take/skip", items: Object.keys(take).map((v) => `${v}: ${take[v]}/${skip[v]}`) }, order: [...Object.keys(take)], note,
  });
  const f: GraphFrame[] = [snap("Each node shows its weight. We want the largest total weight of nodes with no two adjacent (a parent and its child may not both be chosen). For every node we compute two numbers, written take/skip: the best total in its subtree if the node IS chosen, and if it is NOT chosen. Children are always finished before their parent.")];
  for (const v of post) {
    state[v] = "cur";
    const ks = kids[v];
    take[v] = W[v] + ks.reduce((t, c) => t + skip[c], 0);
    skip[v] = ks.reduce((t, c) => t + Math.max(take[c], skip[c]), 0);
    const tNote = ks.length ? `take(${v}) = ${W[v]} + ${ks.map((c) => `skip(${c})`).join(" + ")} = ${W[v]} + ${ks.map((c) => skip[c]).join(" + ")} = ${take[v]}` : `take(${v}) = ${W[v]} (a leaf has no children)`;
    const sNote = ks.length ? `skip(${v}) = ${ks.map((c) => `max(take(${c}), skip(${c}))`).join(" + ")} = ${ks.map((c) => Math.max(take[c], skip[c])).join(" + ")} = ${skip[v]}` : `skip(${v}) = 0`;
    f.push(snap(`Node ${v}: ${tNote}. ${sNote}.`));
    state[v] = "done";
  }
  f.push(snap(`The answer is max(take(A), skip(A)) = max(${take.A}, ${skip.A}) = ${Math.max(take.A, skip.A)}. Every node was handled once, so the whole tree costs O(n).`));
  return f;
}

type Layout = { id: string; x: number; y: number };

/** The call tree of fib(n), with or without memoization, stepped call by call. */
export function fibTreeSteps(n: number, memo: boolean): GraphFrame[] {
  type N = { id: string; arg: number; kids: N[]; hit: boolean; value: number };
  let counter = 0;
  const cache = new Map<number, number>();
  const events: { t: "call" | "ret"; node: N }[] = [];
  const build = (arg: number): N => {
    const node: N = { id: String(counter++), arg, kids: [], hit: false, value: 0 };
    events.push({ t: "call", node });
    if (memo && cache.has(arg)) { node.hit = true; node.value = cache.get(arg)!; events.push({ t: "ret", node }); return node; }
    if (arg <= 1) node.value = arg;
    else { const a = build(arg - 1), b = build(arg - 2); node.kids = [a, b]; node.value = a.value + b.value; }
    if (memo) cache.set(arg, node.value);
    events.push({ t: "ret", node });
    return node;
  };
  const root = build(n);
  const pos = new Map<string, Layout>();
  let leaf = 0;
  const place = (node: N, depth: number): number => {
    const x = node.kids.length === 0 ? leaf++ : node.kids.map((k) => place(k, depth + 1)).reduce((s, v) => s + v, 0) / node.kids.length;
    pos.set(node.id, { id: node.id, x, y: depth });
    return x;
  };
  place(root, 0);
  const W = 300, slots = Math.max(1, leaf - 1);
  const nodes: GraphFrame["nodes"] = [...pos.values()].map((p) => ({ id: p.id, x: 24 + (leaf === 1 ? 126 : (p.x / slots) * (W - 48)), y: 20 + p.y * 46 }));
  const edges: GraphFrame["edges"] = [];
  const walk = (node: N) => { for (const k of node.kids) { edges.push({ a: node.id, b: k.id, directed: true }); walk(k); } };
  walk(root);
  const label = new Map<string, string>();
  const all: N[] = []; const collect = (x: N) => { all.push(x); x.kids.forEach(collect); }; collect(root);
  all.forEach((x) => label.set(x.id, `fib(${x.arg})`));
  nodes.forEach((nd) => { nd.label = label.get(nd.id); });
  const frames: GraphFrame[] = [];
  const state: GraphFrame["state"] = {}, text: Record<string, string> = {}, stack: string[] = [], order: string[] = [];
  const snap = (note: string): GraphFrame => ({ nodes: nodes.map((p) => ({ ...p })), edges: edges.map((e) => ({ ...e })), state: { ...state }, text: { ...text }, structure: { label: "Call stack (top on the right)", items: [...stack] }, order: [...order], note });
  let calls = 0;
  for (const e of events) {
    const name = label.get(e.node.id)!;
    if (e.t === "call") {
      calls++; stack.push(name); state[e.node.id] = "cur";
      frames.push(snap(e.node.hit ? `Call ${name}: its answer is already cached, so it returns at once.` : `Call ${name}. Push it on the call stack.`));
    } else {
      stack.pop(); state[e.node.id] = e.node.hit ? "hit" : "done"; text[e.node.id] = `= ${e.node.value}`; order.push(name);
      frames.push(snap(`${name} returns ${e.node.value}${e.node.hit ? " (cache hit)" : ""}. Pop it.`));
    }
  }
  frames.push(snap(`Finished: fib(${n}) = ${root.value} using ${calls} calls${memo ? " with memoization" : " and no memoization"}.`));
  return frames;
}

const GRAPH = {
  nodes: [
    { id: "A", x: 150, y: 20 }, { id: "B", x: 70, y: 70 }, { id: "C", x: 230, y: 70 },
    { id: "D", x: 30, y: 125 }, { id: "E", x: 110, y: 125 }, { id: "F", x: 230, y: 125 },
  ],
  edges: [["A", "B"], ["A", "C"], ["B", "D"], ["B", "E"], ["C", "F"], ["E", "F"]] as [string, string][],
};
const adj = (() => {
  const m: Record<string, string[]> = {};
  for (const n of GRAPH.nodes) m[n.id] = [];
  for (const [a, b] of GRAPH.edges) { m[a].push(b); m[b].push(a); }
  for (const k of Object.keys(m)) m[k].sort();
  return m;
})();
const graphBase = () => ({ nodes: GRAPH.nodes.map((n) => ({ ...n })), edges: GRAPH.edges.map(([a, b]) => ({ a, b })) });

/** BFS from `start` on the lesson's 6-node graph. The queue is shown explicitly. */
export function bfsSteps(start = "A"): GraphFrame[] {
  const f: GraphFrame[] = [];
  const state: GraphFrame["state"] = { [start]: "queued" }, dist: Record<string, number> = { [start]: 0 }, order: string[] = [], queue = [start];
  const text: Record<string, string> = { [start]: "d=0" };
  const snap = (note: string): GraphFrame => ({ ...graphBase(), state: { ...state }, text: { ...text }, structure: { label: "Queue (front on the left)", items: [...queue] }, order: [...order], note });
  f.push(snap(`Put ${start} in the queue and mark it seen at distance 0.`));
  while (queue.length) {
    const u = queue.shift()!;
    state[u] = "cur"; order.push(u);
    f.push(snap(`Dequeue ${u}. Look at its neighbours: ${adj[u].join(", ")}.`));
    for (const v of adj[u]) if (!(v in dist)) {
      dist[v] = dist[u] + 1; state[v] = "queued"; text[v] = `d=${dist[v]}`; queue.push(v);
      f.push(snap(`${v} is new: distance ${dist[v]}. Mark it seen now and enqueue it.`));
    }
    state[u] = "done";
  }
  f.push(snap(`Queue empty. Visit order ${order.join(" ")} goes level by level; each d is the fewest edges from ${start}.`));
  return f;
}

/** Recursive DFS from `start` on the same graph, with the call stack shown. */
export function dfsSteps(start = "A"): GraphFrame[] {
  const f: GraphFrame[] = [];
  const state: GraphFrame["state"] = {}, order: string[] = [], stack: string[] = [], text: Record<string, string> = {};
  const snap = (note: string): GraphFrame => ({ ...graphBase(), state: { ...state }, text: { ...text }, structure: { label: "Call stack (top on the right)", items: [...stack] }, order: [...order], note });
  const dfs = (u: string) => {
    state[u] = "cur"; stack.push(u); order.push(u); text[u] = `#${order.length}`;
    f.push(snap(`Enter ${u} (visit #${order.length}). Mark it visited.`));
    for (const v of adj[u]) {
      if (v in state) { f.push(snap(`From ${u}: ${v} is already visited, skip it.`)); continue; }
      f.push(snap(`From ${u}: ${v} is new, go deeper.`));
      dfs(v);
      state[u] = "cur";
      f.push(snap(`Back in ${u}: try its next neighbour.`));
    }
    state[u] = "done"; stack.pop();
    f.push(snap(`${u} has no more new neighbours. Return.`));
  };
  dfs(start);
  f.push(snap(`Done. Visit order ${order.join(" ")} plunges down one branch before backing up.`));
  return f;
}

/** Longest common subsequence table, filled row by row; deps show which cells a value came from. */
export function lcsSteps(s: string, t: string): GridFrame[] {
  const n = s.length, m = t.length;
  const cells: (number | null)[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 || j === 0 ? 0 : null)));
  const rowLabels = ["", ...s.split("")], colLabels = ["", ...t.split("")];
  const f: GridFrame[] = [];
  const snap = (note: string, active?: [number, number], deps: [number, number][] = []): GridFrame => ({ rowLabels, colLabels, cells: cells.map((r) => [...r]), active, deps, note });
  f.push(snap("dp[i][j] = length of the longest common subsequence of the first i letters of the left word and the first j letters of the top word. Empty prefixes give 0."));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    if (s[i - 1] === t[j - 1]) {
      cells[i][j] = (cells[i - 1][j - 1] as number) + 1;
      f.push(snap(`'${s[i - 1]}' = '${t[j - 1]}': the letters match, so dp[${i}][${j}] = dp[${i - 1}][${j - 1}] + 1 = ${cells[i][j]}.`, [i, j], [[i - 1, j - 1]]));
    } else {
      cells[i][j] = Math.max(cells[i - 1][j] as number, cells[i][j - 1] as number);
      f.push(snap(`'${s[i - 1]}' ≠ '${t[j - 1]}': skip one letter, so dp[${i}][${j}] = max(dp[${i - 1}][${j}], dp[${i}][${j - 1}]) = ${cells[i][j]}.`, [i, j], [[i - 1, j], [i, j - 1]]));
    }
  }
  f.push(snap(`The bottom-right cell, ${cells[n][m]}, is the answer for the full words.`, [n, m]));
  return f;
}

export { marksOf };

// ---------------------------------------------------------------- visualizations added in the geometry / contest / extra-visualization pass

/** Prim from A on the shared weighted graph. Each outside node shows its key: the cheapest edge that would join it to the tree. */
export function primSteps(): GraphFrame[] {
  const inTree = new Set<string>(["A"]);
  const marks = new Map<string, "pick" | "skip" | "cur">();
  const k = (a: string, b: string) => [a, b].sort().join("");
  let total = 0;
  const keyOf = (id: string): number | null => {
    let best: number | null = null;
    for (const [a, b, w] of WG.edges) {
      const other = a === id ? b : b === id ? a : null;
      if (other && inTree.has(other) && (best === null || w < best)) best = w;
    }
    return best;
  };
  const snap = (note: string): GraphFrame => {
    const state: GraphFrame["state"] = {};
    inTree.forEach((id) => { state[id] = "done"; });
    const text: Record<string, string> = {};
    WG.nodes.forEach((n) => { if (!inTree.has(n.id)) { const kk = keyOf(n.id); text[n.id] = kk === null ? "key ∞" : `key ${kk}`; } });
    return {
      nodes: WG.nodes.map((n) => ({ ...n })),
      edges: WG.edges.map(([a, b, w]) => ({ a, b, w, mark: marks.get(k(a, b)) })),
      state, text,
      structure: { label: `Tree so far (weight ${total})`, items: [...inTree] },
      order: [...inTree], note,
    };
  };
  const f: GraphFrame[] = [snap("Prim grows one tree from A. Every node outside the tree shows its key: the cheapest edge that would join it to the tree. Each step adds the node with the cheapest key.")];
  while (inTree.size < WG.nodes.length) {
    const cands = WG.edges.filter(([a, b]) => inTree.has(a) !== inTree.has(b));
    let best = cands[0];
    for (const e of cands) if (e[2] < best[2] || (e[2] === best[2] && k(e[0], e[1]) < k(best[0], best[1]))) best = e;
    for (const [a, b] of cands) marks.set(k(a, b), "cur");
    f.push(snap(`${cands.length} edges leave the tree. The cheapest is ${best[0]}–${best[1]} (weight ${best[2]}).`));
    for (const [a, b] of cands) if (k(a, b) !== k(best[0], best[1])) marks.set(k(a, b), "skip");
    marks.set(k(best[0], best[1]), "pick");
    const added = inTree.has(best[0]) ? best[1] : best[0];
    inTree.add(added); total += best[2];
    f.push(snap(`Take it: ${added} joins the tree. Tree weight is now ${total}.`));
  }
  for (const [a, b] of WG.edges) if (!marks.has(k(a, b))) marks.set(k(a, b), "skip");
  f.push(snap(`All ${WG.nodes.length} nodes are in the tree with ${WG.nodes.length - 1} edges and total weight ${total}. The edges left unmarked above would only close a cycle.`));
  return f;
}

/** Bellman–Ford on a small directed graph with a negative edge (but no negative cycle). Each round relaxes every edge. */
const BF = {
  nodes: [{ id: "S", x: 20, y: 75 }, { id: "A", x: 110, y: 25 }, { id: "B", x: 110, y: 125 }, { id: "C", x: 200, y: 25 }, { id: "D", x: 280, y: 75 }],
  edges: [["S", "A", 4], ["S", "B", 5], ["A", "C", -2], ["B", "A", -3], ["C", "D", 3], ["B", "D", 9]] as [string, string, number][],
};
export function bellmanFordSteps(): GraphFrame[] {
  const inf = Infinity, dist: Record<string, number> = {};
  BF.nodes.forEach((n) => { dist[n.id] = inf; });
  dist.S = 0;
  const show = (v: number) => (v === inf ? "∞" : String(v));
  const marks = new Map<number, "pick" | "skip" | "cur">();
  const snap = (note: string, changed: string[] = []): GraphFrame => ({
    nodes: BF.nodes.map((n) => ({ ...n })),
    edges: BF.edges.map(([a, b, w], i) => ({ a, b, w, directed: true, mark: marks.get(i) })),
    state: {},
    text: Object.fromEntries(BF.nodes.map((n) => [n.id, `d=${show(dist[n.id])}`])),
    structure: { label: "Nodes changed in this round", items: changed },
    order: [], note,
  });
  const f: GraphFrame[] = [snap("Bellman–Ford starts with distance 0 at S and ∞ everywhere else. It relaxes every edge, then repeats, up to V − 1 = 4 rounds. Relaxing an edge a→b asks: is the route through a shorter than b's current distance?")];
  const V = BF.nodes.length;
  for (let round = 1; round <= V - 1; round++) {
    const changed: string[] = [];
    BF.edges.forEach(([a, b, w], i) => {
      marks.set(i, "cur");
      if (dist[a] !== inf && dist[a] + w < dist[b]) {
        const old = dist[b];
        dist[b] = dist[a] + w; changed.push(b); marks.set(i, "pick");
        f.push(snap(`Round ${round}: ${a}→${b} (${w}). ${a} is ${show(dist[a])}, so the route gives ${dist[b]}, better than ${show(old)}. Update ${b}.`, changed));
      } else {
        marks.set(i, "skip");
        f.push(snap(`Round ${round}: ${a}→${b} (${w}). ${dist[a] === inf ? `${a} is still ∞, so there is nothing to extend.` : `${dist[a] + w} is not better than ${show(dist[b])}.`}`, changed));
      }
    });
    if (changed.length === 0) break;
  }
  const stillImproves = BF.edges.some(([a, b, w]) => dist[a] !== inf && dist[a] + w < dist[b]);
  f.push(snap(stillImproves
    ? "An edge can still improve after V − 1 rounds: there is a negative cycle, so no shortest path is well defined."
    : "No edge can improve any more, so these are the final distances. A check round that still improved something would reveal a negative cycle.", []));
  return f;
}

/** Floyd–Warshall on a 4-node directed graph. Cell (i, j) is updated when going through k is shorter; the cells used are highlighted. */
export function floydSteps(): GridFrame[] {
  const names = ["A", "B", "C", "D"], inf = Infinity;
  const d: number[][] = [[0, 3, inf, 7], [8, 0, 2, inf], [5, inf, 0, 1], [2, inf, inf, 0]];
  const show = (x: number): Cell => (x === inf ? "∞" : x);
  const f: GridFrame[] = [];
  const snap = (note: string, active?: [number, number], deps?: [number, number][]): GridFrame => ({
    rowLabels: names, colLabels: names, cells: d.map((r) => r.map(show)), active, deps, note,
  });
  f.push(snap("d[i][j] is the best distance from i to j found so far. Start with the direct edges only (∞ means no edge yet)."));
  const n = names.length;
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    if (d[i][k] === inf || d[k][j] === inf) {
      f.push(snap(`Through ${names[k]}: ${names[i]}→${names[k]} or ${names[k]}→${names[j]} is missing, so this cannot improve ${names[i]}→${names[j]}.`, [i, j], [[i, k], [k, j]]));
      continue;
    }
    const via = d[i][k] + d[k][j];
    if (via < d[i][j]) {
      const old = d[i][j];
      d[i][j] = via;
      f.push(snap(`Through ${names[k]}: ${names[i]}→${names[k]} (${d[i][k]}) + ${names[k]}→${names[j]} (${d[k][j]}) = ${via}, better than ${show(old)}. Update.`, [i, j], [[i, k], [k, j]]));
    } else {
      f.push(snap(`Through ${names[k]}: ${via} is not better than ${show(d[i][j])}. Keep it.`, [i, j], [[i, k], [k, j]]));
    }
  }
  f.push(snap("Done. Every cell is now the shortest distance using any intermediate nodes. Three nested loops over n nodes give O(n³) time."));
  return f;
}

/** One Lomuto partition with the last element as pivot: every value ≤ pivot moves left of the pivot's final position. */
export function partitionSteps(input: number[]): Frame[] {
  const a = [...input], hi = a.length - 1, pivot = a[hi];
  const f: Frame[] = [mk(a, `Pivot = ${pivot}, the last element. Goal: values ≤ ${pivot} go left of it, values > ${pivot} go right.`, [hi, "pivot"])];
  let i = 0;
  for (let j = 0; j < hi; j++) {
    if (a[j] <= pivot) {
      f.push(mk(a, `${a[j]} ≤ ${pivot}: it belongs on the left. Swap it into the left block at index ${i}.`, [i, "i"], [j, "j"], [hi, "pivot"]));
      [a[i], a[j]] = [a[j], a[i]];
      i++;
      f.push(mk(a, `Swapped. The left block now holds indices 0 to ${i - 1}.`, [i - 1, "left"], [hi, "pivot"]));
    } else {
      f.push(mk(a, `${a[j]} > ${pivot}: it stays in the right block.`, [i, "i"], [j, "j"], [hi, "pivot"]));
    }
  }
  [a[i], a[hi]] = [a[hi], a[i]];
  f.push(mk(a, `Move the pivot to index ${i}, its final place. Everything left of it is ≤ ${pivot}, everything right is > ${pivot}. Quicksort now recurses on both sides.`, [i, "pivot"]));
  return f;
}

/** Point update on the segment tree of segQuerySteps: change one leaf, then recompute only its ancestors. */
export function segUpdateSteps(): GraphFrame[] {
  const a = [5, 2, 6, 1, 7, 3, 8, 4], n = a.length, upd = 3, newVal = 9;
  const val: number[] = [], lo: number[] = [], hi: number[] = [];
  const build = (x: number, l: number, r: number) => {
    lo[x] = l; hi[x] = r;
    if (l === r) { val[x] = a[l]; return; }
    const m = (l + r) >> 1;
    build(2 * x, l, m); build(2 * x + 1, m + 1, r);
    val[x] = Math.min(val[2 * x], val[2 * x + 1]);
  };
  build(1, 0, n - 1);
  const pos: Record<number, { x: number; y: number }> = {};
  const place = (x: number, depth: number): number => {
    const px = lo[x] === hi[x] ? 22 + lo[x] * (256 / (n - 1)) : (place(2 * x, depth + 1) + place(2 * x + 1, depth + 1)) / 2;
    pos[x] = { x: px, y: 20 + depth * 48 };
    return px;
  };
  place(1, 0);
  const ids = Object.keys(pos).map(Number);
  const edges = ids.filter((x) => x > 1).map((x) => ({ a: String(x >> 1), b: String(x) }));
  const state: GraphFrame["state"] = {};
  const leaf = ids.find((x) => lo[x] === upd && hi[x] === upd)!;
  const snap = (note: string): GraphFrame => ({
    nodes: ids.map((x) => ({ id: String(x), x: pos[x].x, y: pos[x].y, label: String(val[x]) })),
    edges, state: { ...state },
    text: Object.fromEntries(ids.map((x) => [String(x), `${lo[x]}-${hi[x]}`])),
    structure: { label: "The array", items: a.map(String) }, order: [], note,
  });
  const f: GraphFrame[] = [snap(`Each node stores the minimum of its range (the range is written under it). Array: ${a.join(", ")}. Change position ${upd} from ${a[upd]} to ${newVal}.`)];
  a[upd] = newVal; val[leaf] = newVal; state[leaf] = "cur";
  f.push(snap(`The leaf for position ${upd} now holds ${newVal}. Its ancestors may be stale, so recompute them one by one.`));
  state[leaf] = "done";
  for (let x = leaf >> 1; x >= 1; x >>= 1) {
    const old = val[x];
    state[x] = "cur";
    val[x] = Math.min(val[2 * x], val[2 * x + 1]);
    f.push(snap(`Node ${lo[x]}-${hi[x]} = min(${val[2 * x]}, ${val[2 * x + 1]}) = ${val[x]}${val[x] === old ? " (unchanged)" : ` (was ${old})`}.`));
    state[x] = "done";
  }
  f.push(snap(`Only the leaf and its ${Math.round(Math.log2(n))} ancestors were touched: O(log n) work, not a rebuild of the whole tree.`));
  return f;
}

/** Monotone chain convex hull. Points are (x, y) with 0 ≤ x, y ≤ 6, all distinct. The stack is the chain being built. */
export function convexHullSteps(points: [number, number][]): GraphFrame[] {
  const P = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const fmt = (i: number) => `(${P[i][0]},${P[i][1]})`;
  const nodes = P.map((p, i) => ({ id: `p${i}`, x: 20 + p[0] * 42, y: 20 + (6 - p[1]) * 42, label: `${p[0]},${p[1]}` }));
  const marks = new Map<string, "pick" | "skip">();
  const drawn: [number, number][] = [];
  const setEdge = (i: number, j: number, m: "pick" | "skip") => {
    const a = Math.min(i, j), b = Math.max(i, j), key = `${a}-${b}`;
    if (!marks.has(key)) drawn.push([a, b]);
    marks.set(key, m);
  };
  let stack: number[] = [];
  const snap = (note: string, cur?: number): GraphFrame => {
    const state: GraphFrame["state"] = {};
    stack.forEach((i) => { state[`p${i}`] = "queued"; });
    if (cur !== undefined) state[`p${cur}`] = "cur";
    return {
      nodes: nodes.map((n) => ({ ...n })),
      edges: drawn.map(([a, b]) => ({ a: `p${a}`, b: `p${b}`, mark: marks.get(`${a}-${b}`) })),
      state, text: {},
      structure: { label: "Chain (stack)", items: stack.map(fmt) },
      order: [], note,
    };
  };
  const f: GraphFrame[] = [snap("Monotone chain: sort the points by x, then build the lower hull from left to right and the upper hull from right to left. A point is removed when the last two points and it do not make a left turn.")];
  const build = (order: number[], label: string): number[] => {
    stack = [];
    for (const i of order) {
      while (stack.length >= 2 && cross(P[stack[stack.length - 2]], P[stack[stack.length - 1]], P[i]) <= 0) {
        const top = stack.pop()!;
        const below = stack[stack.length - 1];
        setEdge(below, top, "skip");
        f.push(snap(`${label}: ${fmt(below)} → ${fmt(top)} → ${fmt(i)} is not a left turn, so ${fmt(top)} is not a corner. Remove it.`, i));
      }
      if (stack.length >= 1) setEdge(stack[stack.length - 1], i, "pick");
      stack.push(i);
      f.push(snap(`${label}: add ${fmt(i)} to the chain.`, i));
    }
    return [...stack];
  };
  const lower = build(P.map((_, i) => i), "Lower hull");
  const upper = build(P.map((_, i) => P.length - 1 - i), "Upper hull");
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  stack = hull;
  f.push(snap(`Hull corners, counterclockwise: ${hull.map(fmt).join(" ")}. That is ${hull.length} corners. The points left out are on an edge or inside the hull.`));
  return f;
}

/** Upsolving as a recognition map: after each problem is upsolved, the technique it taught is ticked. */
export function upsolveSteps(): GridFrame[] {
  const rows = ["Problem A", "Problem B", "Problem C", "Problem D", "Problem E"];
  const cols = ["prefix sum", "two pointers", "binary search", "DP", "BFS"];
  const signals = [
    "many range-sum queries on a fixed array: the answer is a difference of two prefix sums",
    "a sorted array and a target pair: move the two ends towards each other",
    "the answer is the smallest value that works, and 'works' is monotone: search over the value",
    "each item is taken or skipped, and the best future depends only on a small state",
    "fewest moves on a grid with unit steps: explore in layers",
  ];
  const cells: (Cell | null)[][] = rows.map(() => cols.map(() => null));
  const f: GridFrame[] = [];
  f.push({ rowLabels: rows, colLabels: cols, cells: cells.map((r) => [...r]), note: "A recognition map: after you upsolve a problem, tick the technique whose signal it taught you. Empty cells are techniques you cannot yet spot." });
  for (let r = 0; r < rows.length; r++) {
    cells[r][r] = "✓";
    f.push({ rowLabels: rows, colLabels: cols, cells: cells.map((x) => [...x]), active: [r, r], note: `Upsolved ${rows[r]}. Signal worth remembering: ${signals[r]}.` });
  }
  f.push({ rowLabels: rows, colLabels: cols, cells: cells.map((x) => [...x]), note: "Each problem taught one signal. The next contest, you match the signals in the statement against this map before you start coding." });
  return f;
}
