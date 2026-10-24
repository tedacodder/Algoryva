import { parseDsu, parseFenOps, parseSegOps, parseTrieOps, parseGraph, parseInts, parseInt1, parseIntervals, parseOps, parseQueries, parseWords, sortedError, type Parsed } from "./parse";
import { fenwickOps } from "./fenwick";
import { trieOps, MAX_TRIE_NODES } from "./trie";
import { trieDynamic, TRIE_NODE_LIMIT, TRIE_OPS_PSEUDOCODE } from "./trieops";
import { intervalGreedy } from "./greedy";
import { nQueens, subsetSum } from "./backtrack";
import { segmentTreeOps } from "./segtree";
import { BST_PSEUDOCODE, MAX_BST_KEYS, bstOps } from "./bst";
import { bellmanFord, bfs, dfs, dijkstra, topoSort } from "./graphs";
import { components, kruskal, prim } from "./mst";
import { dsuOps } from "./dsu";
import { climbingStairs, coinChange, floyd, knapsack, lcs } from "./dp";
import { arrayTraversal, binarySearch, linearSearch, prefixSums, slidingWindowMax, twoPointers } from "./arrays";
import { bubbleSort, heapSort, insertionSort, mergeSort, quickSort, selectionSort } from "./sorting";
import { bstSearch, queueOps, stackOps } from "./structures";
import type { Algorithm, ArrayGen, Field, Gen, RunOutcome } from "./types";

export { CATEGORIES } from "./types";
export type { Algorithm, RunOutcome } from "./types";

const fail = (error: string): RunOutcome => ({ ok: false, error });
const good = (gen: Gen): RunOutcome => ({ ok: true, gen });

const ARRAY: Field = { key: "array", label: "Array", help: "Whole numbers, separated by commas or spaces. Up to 30 values, each between -999 and 999.", placeholder: "e.g. 7, 2, 9, 4, 1" };
const SORTED_ARRAY: Field = { ...ARRAY, help: "Whole numbers in non-decreasing order, smallest first. Up to 30 values.", placeholder: "e.g. 1, 3, 5, 7, 9" };
const TARGET: Field = { key: "target", label: "Target", help: "The value to find.", placeholder: "e.g. 11" };
const K: Field = { key: "k", label: "Window size k", help: "How many consecutive values form one window. Must be between 1 and the array length.", placeholder: "e.g. 3" };

const SORT_PRESETS = [
  { label: "Random", values: { array: "29, 3, 17, 8, 42, 11, 5, 23" } },
  { label: "Nearly sorted", values: { array: "1, 2, 4, 3, 5, 7, 6, 8" } },
  { label: "Descending", values: { array: "9, 7, 5, 4, 3, 2, 1" } },
  { label: "Many duplicates", values: { array: "4, 1, 4, 2, 1, 4, 3" } },
];

const NODES: Field = { key: "nodes", label: "Number of nodes", help: "Nodes are numbered 0 to n-1. Up to 8.", placeholder: "e.g. 6" };
const EDGES: Field = { key: "edges", label: "Edges", help: 'Each edge as "u v" or "u v weight", separated by semicolons. The weight defaults to 1. Up to 20 edges.', placeholder: "e.g. 0 1; 0 2; 1 3" };
const DIRECTED: Field = { key: "directed", label: "Directed?", help: '"yes" for one-way edges, "no" for two-way edges.', placeholder: "no" };
const START: Field = { key: "start", label: "Start node", help: "Where the search or the shortest paths begin.", placeholder: "e.g. 0" };

const GRAPH_PRESETS = [
  { label: "Connected", values: { nodes: "6", edges: "0 1; 0 2; 1 3; 2 4; 3 5; 4 5", directed: "no", start: "0" } },
  { label: "Disconnected", values: { nodes: "5", edges: "0 1; 2 3", directed: "no", start: "0" } },
];

/** A start node must exist. Returns the node or the reason it is not valid. */
function startNode(r: Record<string, string>, n: number): Parsed<number> {
  const s = parseInt1(r.start ?? "", "The start node");
  if (!s.ok) return s;
  if (s.value < 0 || s.value >= n) return { ok: false, error: `The start node must be between 0 and ${n - 1}.` };
  return s;
}

export const ALGORITHMS: Algorithm[] = [
  {
    id: "linear-search",
    title: "Linear search",
    category: "arrays",
    lessonSlug: "arrays",
    summary: "Check each value in turn until the target appears or the array runs out. Works on any array, sorted or not.",
    complexity: { time: "O(n)", space: "O(1)", note: "Worst case checks every element." },
    pseudocode: ["for i = 0 to n - 1:", "  if A[i] == target:", "    return i", "return -1"],
    fields: [ARRAY, TARGET],
    presets: [
      { label: "Found", values: { array: "7, 2, 9, 4, 1", target: "9" } },
      { label: "Missing", values: { array: "7, 2, 9, 4, 1", target: "5" } },
      { label: "Empty array", values: { array: "", target: "5" } },
    ],
    run: (r) => {
      const a = parseInts(r.array ?? "", "The array", { min: 0 });
      if (!a.ok) return fail(a.error);
      const t = parseInt1(r.target ?? "", "The target");
      if (!t.ok) return fail(t.error);
      return good(linearSearch(a.value, t.value));
    },
  },
  {
    id: "binary-search",
    title: "Binary search",
    category: "arrays",
    lessonSlug: "binary-search",
    summary: "Look at the middle of a sorted range, then discard the half that cannot contain the target.",
    precondition: "The array must be sorted from smallest to largest.",
    complexity: { time: "O(log n)", space: "O(1)" },
    pseudocode: ["lo = 0, hi = n - 1", "while lo <= hi:", "  mid = (lo + hi) // 2", "  if A[mid] == target: return mid", "  if A[mid] < target: lo = mid + 1", "  else: hi = mid - 1", "return -1"],
    fields: [SORTED_ARRAY, TARGET],
    presets: [
      { label: "Found", values: { array: "1, 3, 5, 7, 9, 11, 13, 15", target: "11" } },
      { label: "Missing", values: { array: "1, 3, 5, 7, 9, 11, 13, 15", target: "8" } },
      { label: "Unsorted (rejected)", values: { array: "5, 1, 9, 3", target: "3" } },
    ],
    run: (r) => {
      const a = parseInts(r.array ?? "", "The array", { min: 0 });
      if (!a.ok) return fail(a.error);
      const bad = sortedError(a.value, "The array");
      if (bad) return fail(bad);
      const t = parseInt1(r.target ?? "", "The target");
      if (!t.ok) return fail(t.error);
      return good(binarySearch(a.value, t.value));
    },
  },
  {
    id: "two-pointers",
    title: "Two pointers: pair with a target sum",
    category: "arrays",
    lessonSlug: "two-pointers",
    summary: "On a sorted array, move one pointer from each end. A sum that is too small moves the left pointer right; too large moves the right pointer left.",
    precondition: "The array must be sorted from smallest to largest.",
    complexity: { time: "O(n)", space: "O(1)", note: "Each pointer only moves in one direction." },
    pseudocode: ["i = 0, j = n - 1", "while i < j:", "  s = A[i] + A[j]", "  if s == target: return (i, j)", "  else if s < target: i = i + 1", "  else: j = j - 1", "return none"],
    fields: [SORTED_ARRAY, { key: "target", label: "Target sum", help: "The pair of values should add up to this.", placeholder: "e.g. 13" }],
    presets: [
      { label: "Pair exists", values: { array: "1, 2, 4, 7, 11, 15", target: "13" } },
      { label: "No pair", values: { array: "1, 2, 4, 7, 11, 15", target: "100" } },
    ],
    run: (r) => {
      const a = parseInts(r.array ?? "", "The array", { min: 0 });
      if (!a.ok) return fail(a.error);
      const bad = sortedError(a.value, "The array");
      if (bad) return fail(bad);
      const t = parseInt1(r.target ?? "", "The target sum");
      if (!t.ok) return fail(t.error);
      return good(twoPointers(a.value, t.value));
    },
  },
  {
    id: "sliding-window",
    title: "Sliding window: best sum of k values",
    category: "arrays",
    lessonSlug: "sliding-window",
    summary: "Keep a window of k values. Each slide adds one value on the right and removes one on the left, so each slide costs O(1).",
    complexity: { time: "O(n)", space: "O(1)", note: "Recomputing each window from scratch would cost O(n·k)." },
    pseudocode: ["window = A[0] + ... + A[k-1]; best = window", "for start = 1 to n - k:", "  window = window + A[start + k - 1] - A[start - 1]", "  best = max(best, window)", "return best"],
    fields: [ARRAY, K],
    presets: [
      { label: "k = 3", values: { array: "2, 1, 5, 1, 3, 2", k: "3" } },
      { label: "k = 1", values: { array: "2, 1, 5, 1, 3, 2", k: "1" } },
    ],
    run: (r) => {
      const a = parseInts(r.array ?? "", "The array");
      if (!a.ok) return fail(a.error);
      const k = parseInt1(r.k ?? "", "The window size");
      if (!k.ok) return fail(k.error);
      if (k.value < 1 || k.value > a.value.length) return fail(`The window size must be between 1 and ${a.value.length}, the array length.`);
      return good(slidingWindowMax(a.value, k.value));
    },
  },
  {
    id: "prefix-sums",
    title: "Prefix sums: answer range sums in O(1)",
    category: "arrays",
    lessonSlug: "prefix-sum",
    summary: "Build P, where P[i] is the sum of the first i values. Then the sum of any range [l, r] is P[r+1] - P[l].",
    complexity: { time: "O(n + q)", space: "O(n)", note: "Build once in O(n), then each of q queries is O(1)." },
    pseudocode: ["P[0] = 0", "for i = 1 to n: P[i] = P[i - 1] + A[i - 1]", "for each query (l, r): answer = P[r + 1] - P[l]", "return answers"],
    fields: [
      ARRAY,
      { key: "queries", label: "Range queries", help: 'Inclusive, 0-based ranges written as "l r" and separated by semicolons.', placeholder: "e.g. 1 3; 0 4" },
    ],
    presets: [
      { label: "Three queries", values: { array: "2, 4, 1, 5, 3, 6", queries: "1 3; 0 4; 3 5" } },
    ],
    run: (r) => {
      const a = parseInts(r.array ?? "", "The array");
      if (!a.ok) return fail(a.error);
      const q = parseQueries(r.queries ?? "", a.value.length);
      if (!q.ok) return fail(q.error);
      return good(prefixSums(a.value, q.value));
    },
  },
  {
    id: "array-traversal",
    title: "Array traversal: one pass, running maximum",
    category: "arrays",
    lessonSlug: "arrays",
    summary: "Visit every index exactly once, keeping the best value seen so far. This is the base pattern behind most array loops.",
    complexity: { time: "O(n)", space: "O(1)" },
    pseudocode: ["best = A[0]", "for i = 0 to n - 1:", "  if A[i] > best: best = A[i]", "return best"],
    fields: [ARRAY],
    presets: [{ label: "Example", values: { array: "3, 9, 2, 7, 5" } }],
    run: (r) => {
      const a = parseInts(r.array ?? "", "The array", { min: 0 });
      if (!a.ok) return fail(a.error);
      return good(arrayTraversal(a.value));
    },
  },
  {
    id: "bubble-sort",
    title: "Bubble sort",
    category: "sorting",
    lessonSlug: "sorting-basics",
    summary: "Repeatedly swap neighbours that are out of order. Each pass pushes the largest unsorted value to the end.",
    complexity: { time: "O(n²)", space: "O(1)", note: "Stops early in a real implementation once a pass makes no swaps. This version does all passes so every step is shown." },
    pseudocode: ["for end = n - 1 down to 1:", "  for i = 0 to end - 1:", "    if A[i] > A[i + 1]: swap them", "  A[end] is in its final place"],
    fields: [{ ...ARRAY, placeholder: "e.g. 5, 2, 4, 1, 3" }],
    presets: SORT_PRESETS,
    run: (r) => sortRun(r, bubbleSort),
  },
  {
    id: "selection-sort",
    title: "Selection sort",
    category: "sorting",
    lessonSlug: "sorting-basics",
    summary: "Find the smallest unsorted value and swap it into the next slot. The sorted prefix grows by one each pass.",
    complexity: { time: "O(n²)", space: "O(1)", note: "Always scans the whole unsorted part, so it does the same work on sorted input." },
    pseudocode: ["for i = 0 to n - 2:", "  min = i", "  for j = i + 1 to n - 1:", "    if A[j] < A[min]: min = j", "  swap A[i] and A[min]"],
    fields: [{ ...ARRAY, placeholder: "e.g. 5, 2, 4, 1, 3" }],
    presets: SORT_PRESETS,
    run: (r) => sortRun(r, selectionSort),
  },
  {
    id: "insertion-sort",
    title: "Insertion sort",
    category: "sorting",
    lessonSlug: "sorting-basics",
    summary: "Take each value and slide it left into the sorted part until it fits. Fast when the array is nearly sorted.",
    complexity: { time: "O(n²) worst, O(n) best", space: "O(1)", note: "On an already sorted array each value needs one comparison." },
    pseudocode: ["for i = 1 to n - 1:", "  key = A[i]; j = i - 1", "  while j >= 0 and A[j] > key:", "    A[j + 1] = A[j]; j = j - 1", "  A[j + 1] = key"],
    fields: [{ ...ARRAY, placeholder: "e.g. 5, 2, 4, 1, 3" }],
    presets: SORT_PRESETS,
    run: (r) => sortRun(r, insertionSort),
  },
  {
    id: "merge-sort",
    title: "Merge sort",
    category: "sorting",
    lessonSlug: "sorting-advanced",
    summary: "Split the array in half, sort each half, then merge two sorted halves by repeatedly taking the smaller front value.",
    complexity: { time: "O(n log n)", space: "O(n)", note: "The merge needs a buffer the size of the range being merged." },
    pseudocode: ["mergeSort(lo, hi):", "  if lo >= hi: return", "  mid = (lo + hi) // 2", "  mergeSort(lo, mid); mergeSort(mid + 1, hi)", "  merge the halves, taking the smaller head", "  copy the merged run back into A[lo..hi]"],
    fields: [{ ...ARRAY, placeholder: "e.g. 5, 2, 4, 1, 6, 3" }],
    presets: SORT_PRESETS,
    run: (r) => sortRun(r, mergeSort),
  },
  {
    id: "quick-sort",
    title: "Quick sort",
    category: "sorting",
    lessonSlug: "sorting-advanced",
    summary: "Partition around a pivot so smaller values sit to its left and larger values to its right, then sort each side.",
    complexity: { time: "O(n log n) average, O(n²) worst", space: "O(log n) average", note: "This version uses the last value as the pivot, so sorted input is the worst case." },
    pseudocode: ["quickSort(lo, hi):", "  if lo >= hi: return", "  p = partition(lo, hi)", "  quickSort(lo, p - 1); quickSort(p + 1, hi)", "partition(lo, hi):", "  pivot = A[hi]; i = lo", "  for j = lo to hi - 1:", "    if A[j] < pivot: swap A[i], A[j]; i = i + 1", "  swap A[i] and A[hi]; return i"],
    fields: [{ ...ARRAY, placeholder: "e.g. 5, 2, 8, 1, 9, 3" }],
    presets: SORT_PRESETS,
    run: (r) => sortRun(r, quickSort),
  },
  {
    id: "heap-sort",
    title: "Heap sort",
    category: "sorting",
    lessonSlug: "heap",
    summary: "Build a max-heap inside the array, then repeatedly move the largest value to the end and restore the heap on the rest.",
    complexity: { time: "O(n log n)", space: "O(1)", note: "Builds the heap in O(n), then does n extractions of O(log n) each." },
    pseudocode: ["for i = n/2 - 1 down to 0:", "  sift(i, n)", "for end = n - 1 down to 1:", "  swap A[0] and A[end]", "  sift(0, end)", "sift(root, size):", "  child = 2 * root + 1", "  while child < size:", "    if child + 1 < size and A[child + 1] > A[child]: child = child + 1", "    if A[child] > A[root]: swap; root = child; child = 2 * child + 1", "    else: stop"],
    fields: [{ ...ARRAY, placeholder: "e.g. 5, 2, 4, 1, 3" }],
    presets: SORT_PRESETS,
    run: (r) => sortRun(r, heapSort),
  },
  {
    id: "stack",
    title: "Stack: push, pop, peek",
    category: "structures",
    lessonSlug: "stacks-queues",
    summary: "Last in, first out. Push adds to the top, pop removes from the top, and peek reads the top without removing it.",
    complexity: { time: "O(1) per operation", space: "O(n)" },
    pseudocode: ["push(x): add x as the new top", "pop(): if empty, underflow; else remove and return the top", "peek(): read the top without removing it"],
    fields: [{ key: "ops", label: "Operations", help: 'Separate operations with commas: "push 3, push 5, pop, peek". Up to 20.', placeholder: "e.g. push 3, push 5, pop" }],
    presets: [
      { label: "Example", values: { ops: "push 3, push 5, pop, push 7, peek" } },
      { label: "Underflow", values: { ops: "pop, push 1, pop, pop" } },
    ],
    run: (r) => {
      const o = parseOps(r.ops ?? "", { push: true, pop: false, peek: false });
      if (!o.ok) return fail(o.error);
      return good(stackOps(o.value));
    },
  },
  {
    id: "queue",
    title: "Queue: enqueue, dequeue, front",
    category: "structures",
    lessonSlug: "stacks-queues",
    summary: "First in, first out. Enqueue joins the back, dequeue removes from the front, and front reads the front without removing it.",
    complexity: { time: "O(1) per operation with a ring buffer or linked list", space: "O(n)", note: "This visualization shifts the array on dequeue, which is O(n) per operation." },
    pseudocode: ["enqueue(x): add x at the back", "dequeue(): if empty, underflow; else remove and return the front", "front(): read the front without removing it"],
    fields: [{ key: "ops", label: "Operations", help: 'Separate operations with commas: "enqueue 3, enqueue 5, dequeue, front". Up to 20.', placeholder: "e.g. enqueue 3, enqueue 5, dequeue" }],
    presets: [
      { label: "Example", values: { ops: "enqueue 3, enqueue 5, dequeue, enqueue 7, front" } },
      { label: "Underflow", values: { ops: "dequeue, enqueue 1, dequeue, dequeue" } },
    ],
    run: (r) => {
      const o = parseOps(r.ops ?? "", { enqueue: true, dequeue: false, front: false });
      if (!o.ok) return fail(o.error);
      return good(queueOps(o.value));
    },
  },
  {
    id: "bst",
    title: "Binary search tree: insert and search",
    category: "trees",
    lessonSlug: "trees",
    summary: "Each node's left subtree holds smaller values and its right subtree holds larger ones. Insert and search follow one path down the tree.",
    precondition: "Values must be distinct. Up to 9 values so the tree stays readable.",
    complexity: { time: "O(log n) average, O(n) worst", space: "O(n)", note: "A tree built from sorted input becomes a chain, which is the O(n) worst case." },
    pseudocode: ["insert(x):", "  if the tree is empty: x becomes the root", "  node = root", "  loop:", "    if x < node.key: next = node.left, else next = node.right", "    if next is empty: attach x there", "    node = next", "search(t):", "  node = root", "  while node is not empty:", "    if t == node.key: found", "    if t < node.key: node = node.left, else node = node.right", "  not found"],
    fields: [
      { key: "insert", label: "Insert, in order", help: "Distinct whole numbers, inserted left to right. Up to 9.", placeholder: "e.g. 8, 3, 10, 1, 6" },
      { key: "target", label: "Search for", help: "The value to look for after all insertions.", placeholder: "e.g. 6" },
    ],
    presets: [
      { label: "Found", values: { insert: "8, 3, 10, 1, 6, 14", target: "6" } },
      { label: "Missing", values: { insert: "8, 3, 10, 1, 6, 14", target: "7" } },
    ],
    run: (r) => {
      const v = parseInts(r.insert ?? "", "The values", { min: 1, max: 9, distinct: true });
      if (!v.ok) return fail(v.error);
      const t = parseInt1(r.target ?? "", "The search value");
      if (!t.ok) return fail(t.error);
      return good(bstSearch(v.value, t.value));
    },
  },
  {
    id: "bfs",
    title: "Breadth-first search (BFS)",
    category: "graphs",
    lessonSlug: "bfs",
    summary: "Explore outward in rings: visit every neighbour of the start, then their neighbours, and so on. A queue drives the order.",
    complexity: { time: "O(n + m)", space: "O(n)", note: "n nodes and m edges. Each edge is examined once from each end." },
    pseudocode: ["seen = {start}; queue = [start]", "while queue is not empty:", "  u = dequeue()", "  for each neighbour v of u:", "    if v is not seen: mark seen and enqueue v", "  u is finished"],
    fields: [NODES, EDGES, DIRECTED, START],
    presets: GRAPH_PRESETS,
    run: (r) => {
      const g = parseGraph(r.nodes ?? "", r.edges ?? "", r.directed ?? "no");
      if (!g.ok) return fail(g.error);
      const s = startNode(r, g.value.n);
      if (!s.ok) return fail(s.error);
      return good(bfs(g.value, s.value));
    },
  },
  {
    id: "dfs",
    title: "Depth-first search (DFS)",
    category: "graphs",
    lessonSlug: "dfs",
    summary: "Follow one path as deep as it goes, then back up to try the next branch. The call stack holds the path.",
    complexity: { time: "O(n + m)", space: "O(n)", note: "The recursion depth can reach n on a path-shaped graph." },
    pseudocode: ["dfs(u):", "  mark u seen and record it", "  for each neighbour v of u:", "    if v is not seen: dfs(v)", "  u is finished"],
    fields: [NODES, EDGES, DIRECTED, START],
    presets: GRAPH_PRESETS,
    run: (r) => {
      const g = parseGraph(r.nodes ?? "", r.edges ?? "", r.directed ?? "no");
      if (!g.ok) return fail(g.error);
      const s = startNode(r, g.value.n);
      if (!s.ok) return fail(s.error);
      return good(dfs(g.value, s.value));
    },
  },
  {
    id: "dijkstra",
    title: "Dijkstra's shortest paths",
    category: "graphs",
    lessonSlug: "shortest-paths",
    summary: "Settle the closest unsettled node, then try to shorten the distances of its neighbours. Works when no weight is negative.",
    precondition: "Edge weights must be 0 or more.",
    complexity: { time: "O((n + m) log n) with a heap; O(n²) as written here", space: "O(n)", note: "This version finds the closest node by scanning all nodes, which keeps every step visible." },
    pseudocode: ["dist[start] = 0; every other dist = ∞", "while some unsettled node has a finite dist:", "  settle the unsettled node u with the smallest dist", "  for each edge u -> v with weight w:", "    if dist[u] + w < dist[v]: dist[v] = dist[u] + w", "  the search is over"],
    fields: [NODES, EDGES, DIRECTED, START],
    presets: [
      { label: "Weighted directed", values: { nodes: "5", edges: "0 1 4; 0 2 1; 2 1 2; 1 3 1; 2 3 5; 3 4 3", directed: "yes", start: "0" } },
      { label: "Unreachable node", values: { nodes: "4", edges: "0 1 2; 1 2 3", directed: "yes", start: "0" } },
    ],
    run: (r) => {
      const g = parseGraph(r.nodes ?? "", r.edges ?? "", r.directed ?? "no", { nonNegative: true });
      if (!g.ok) return fail(g.error);
      const s = startNode(r, g.value.n);
      if (!s.ok) return fail(s.error);
      return good(dijkstra(g.value, s.value));
    },
  },
  {
    id: "topo-sort",
    title: "Topological sort (Kahn's algorithm)",
    category: "graphs",
    lessonSlug: "topological-sort",
    summary: "Order the nodes of a directed graph so every edge points forward. Repeatedly take a node with no incoming edges left. If some nodes never become free, the graph has a cycle.",
    precondition: "The graph must be directed.",
    complexity: { time: "O(n + m)", space: "O(n)" },
    pseudocode: ["indeg[v] = number of edges into v", "queue = every node with indeg 0", "while queue is not empty:", "  u = dequeue(); append u to the order", "  for each edge u -> v: indeg[v] -= 1; if indeg[v] == 0: enqueue v", "if the order has all n nodes: valid, else cycle"],
    fields: [NODES, EDGES, DIRECTED],
    presets: [
      { label: "Valid order", values: { nodes: "6", edges: "5 2; 5 0; 4 0; 4 1; 2 3; 3 1", directed: "yes" } },
      { label: "Cycle", values: { nodes: "3", edges: "0 1; 1 2; 2 0", directed: "yes" } },
    ],
    run: (r) => {
      const g = parseGraph(r.nodes ?? "", r.edges ?? "", r.directed ?? "no");
      if (!g.ok) return fail(g.error);
      if (!g.value.directed) return fail('Topological sort needs a directed graph. Set Directed to "yes".');
      return good(topoSort(g.value));
    },
  },
  {
    id: "climbing-stairs",
    title: "Climbing stairs",
    category: "dp",
    lessonSlug: "dp-top-down",
    summary: "Count the ways to reach step n when each move climbs 1 or 2 steps. Each count is the sum of the two counts before it.",
    complexity: { time: "O(n)", space: "O(n), or O(1) keeping only the last two counts" },
    pseudocode: ["ways[0] = 1, ways[1] = 1", "for i = 2 to n:", "  ways[i] = ways[i-1] + ways[i-2]", "return ways[n]"],
    fields: [{ key: "n", label: "Steps n", help: "The number of steps to climb, from 0 to 30.", placeholder: "e.g. 6" }],
    presets: [{ label: "n = 6", values: { n: "6" } }, { label: "n = 0", values: { n: "0" } }],
    run: (r) => {
      const n = parseInt1(r.n ?? "", "The number of steps");
      if (!n.ok) return fail(n.error);
      if (n.value < 0 || n.value > 30) return fail("The number of steps must be between 0 and 30.");
      return good(climbingStairs(n.value));
    },
  },
  {
    id: "coin-change",
    title: "Coin change: fewest coins",
    category: "dp",
    lessonSlug: "dp-bottom-up",
    summary: "Build dp[a], the fewest coins that make each amount a, from smaller amounts. Each amount tries every coin it can use.",
    complexity: { time: "O(amount × coins)", space: "O(amount)" },
    pseudocode: ["dp[0] = 0; dp[a] = ∞ for a > 0", "for a = 1 to amount:", "  for each coin c with c <= a:", "    dp[a] = min(dp[a], dp[a - c] + 1)", "return dp[amount] (impossible if ∞)"],
    fields: [
      { key: "coins", label: "Coin values", help: "Positive whole numbers separated by commas. Up to 6 coin types.", placeholder: "e.g. 1, 3, 4" },
      { key: "amount", label: "Amount", help: "The total to make, from 0 to 30.", placeholder: "e.g. 6" },
    ],
    presets: [
      { label: "Makeable", values: { coins: "1, 3, 4", amount: "6" } },
      { label: "Impossible", values: { coins: "2, 4", amount: "7" } },
    ],
    run: (r) => {
      const c = parseInts(r.coins ?? "", "The coin values", { min: 1, max: 6 });
      if (!c.ok) return fail(c.error);
      if (c.value.some((x) => x < 1)) return fail("Coin values must be positive.");
      const a = parseInt1(r.amount ?? "", "The amount");
      if (!a.ok) return fail(a.error);
      if (a.value < 0 || a.value > 30) return fail("The amount must be between 0 and 30.");
      return good(coinChange(c.value, a.value));
    },
  },
  {
    id: "lcs",
    title: "Longest common subsequence",
    category: "dp",
    lessonSlug: "dp-bottom-up",
    summary: "Fill a table where each cell is the LCS length of two prefixes. A match extends the diagonal; a mismatch takes the better of the two neighbours.",
    complexity: { time: "O(m × n)", space: "O(m × n), or O(n) keeping one row" },
    pseudocode: ["dp[i][0] = dp[0][j] = 0", "for i = 1 to m:", "  for j = 1 to n:", "    if s[i-1] == t[j-1]: dp[i][j] = dp[i-1][j-1] + 1", "    else: dp[i][j] = max(dp[i-1][j], dp[i][j-1])", "return dp[m][n]"],
    fields: [
      { key: "s", label: "First string", help: "Letters only, up to 8 characters.", placeholder: "e.g. ABCB" },
      { key: "t", label: "Second string", help: "Letters only, up to 8 characters.", placeholder: "e.g. BDCAB" },
    ],
    presets: [
      { label: "ABCB and BDCAB", values: { s: "ABCB", t: "BDCAB" } },
      { label: "No shared letters", values: { s: "abc", t: "xyz" } },
    ],
    run: (r) => {
      const s = r.s ?? "";
      const t = r.t ?? "";
      if (!/^[A-Za-z]{1,8}$/.test(s) || !/^[A-Za-z]{1,8}$/.test(t)) return fail("Each string needs 1 to 8 letters, with no spaces or digits.");
      return good(lcs(s, t));
    },
  },
  {
    id: "knapsack",
    title: "0/1 knapsack",
    category: "dp",
    lessonSlug: "dp-bottom-up",
    summary: "Each item is taken whole or left out. Row i holds the best value using the first i items at every capacity.",
    complexity: { time: "O(items × capacity)", space: "O(items × capacity), or O(capacity) with one row" },
    pseudocode: ["dp[0][w] = 0 for every capacity w", "for i = 1 to k:", "  for w = 0 to W:", "    dp[i][w] = dp[i-1][w]  (skip item i)", "    if weight[i] <= w: dp[i][w] = max(dp[i][w], dp[i-1][w - weight[i]] + value[i])", "return dp[k][W]"],
    fields: [
      { key: "weights", label: "Item weights", help: "Positive whole numbers separated by commas. Up to 8 items.", placeholder: "e.g. 1, 3, 4, 5" },
      { key: "values", label: "Item values", help: "Whole numbers, zero or more, one per weight.", placeholder: "e.g. 1, 4, 5, 7" },
      { key: "capacity", label: "Capacity W", help: "The most weight the bag can hold, from 0 to 30.", placeholder: "e.g. 7" },
    ],
    presets: [
      { label: "Small", values: { weights: "1, 3, 4, 5", values: "1, 4, 5, 7", capacity: "7" } },
      { label: "Contest", values: { weights: "10, 20, 30", values: "60, 100, 120", capacity: "30" } },
    ],
    run: (r) => {
      const w = parseInts(r.weights ?? "", "The item weights", { min: 1, max: 8 });
      if (!w.ok) return fail(w.error);
      const v = parseInts(r.values ?? "", "The item values", { min: 1, max: 8 });
      if (!v.ok) return fail(v.error);
      if (w.value.length !== v.value.length) return fail(`There are ${w.value.length} weights but ${v.value.length} values. Give one value per weight.`);
      if (w.value.some((x) => x < 1)) return fail("Item weights must be positive.");
      if (v.value.some((x) => x < 0)) return fail("Item values must be 0 or more.");
      const c = parseInt1(r.capacity ?? "", "The capacity");
      if (!c.ok) return fail(c.error);
      if (c.value < 0 || c.value > 30) return fail("The capacity must be between 0 and 30.");
      return good(knapsack(w.value, v.value, c.value));
    },
  },
  {
    id: "bellman-ford",
    title: "Bellman–Ford shortest paths",
    category: "graphs",
    lessonSlug: "shortest-paths",
    summary: "Relax every edge once per round. After n-1 rounds the distances are final, unless an edge can still shorten one, which means a negative cycle.",
    complexity: { time: "O(n · m)", space: "O(n)", note: "Works with negative weights. Negative cycles are detected, not solved." },
    pseudocode: ["dist[start] = 0; every other dist = ∞", "repeat n - 1 times:", "  for each edge u -> v with weight w:", "    if dist[u] + w < dist[v]: dist[v] = dist[u] + w", "one more pass: if any edge still improves, a negative cycle exists"],
    fields: [NODES, EDGES, DIRECTED, START],
    presets: [
      { label: "Negative edge", values: { nodes: "4", edges: "0 1 4; 0 2 5; 2 1 -3; 1 3 2", directed: "yes", start: "0" } },
      { label: "Negative cycle", values: { nodes: "3", edges: "0 1 1; 1 2 -2; 2 1 0", directed: "yes", start: "0" } },
    ],
    run: (r) => {
      const g = parseGraph(r.nodes ?? "", r.edges ?? "", r.directed ?? "no");
      if (!g.ok) return fail(g.error);
      if (!g.value.directed && g.value.edges.some((e) => e.w < 0)) return fail('Negative weights need a directed graph here. In an undirected graph one negative edge is already a negative cycle. Set Directed to "yes".');
      const s = startNode(r, g.value.n);
      if (!s.ok) return fail(s.error);
      return good(bellmanFord(g.value, s.value));
    },
  },
  {
    id: "floyd-warshall",
    title: "Floyd–Warshall: all pairs",
    category: "dp",
    lessonSlug: "shortest-paths",
    summary: "Let each node in turn be a stop-over, and improve the distance of every pair through it. The table ends with all shortest distances.",
    complexity: { time: "O(n³)", space: "O(n²)", note: "Good for small dense graphs, where every pair is needed." },
    pseudocode: ["dist[i][j] = 0 if i == j, the edge weight if an edge exists, else ∞", "for k = 0 to n - 1:", "  for i, j: dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j])", "return dist"],
    fields: [NODES, EDGES, DIRECTED],
    presets: [
      { label: "Weighted directed", values: { nodes: "4", edges: "0 1 3; 1 2 1; 0 2 7; 2 3 2; 3 0 1", directed: "yes" } },
      { label: "Negative edge", values: { nodes: "4", edges: "0 1 4; 0 2 5; 2 1 -3; 1 3 2", directed: "yes" } },
    ],
    run: (r) => {
      const g = parseGraph(r.nodes ?? "", r.edges ?? "", r.directed ?? "no");
      if (!g.ok) return fail(g.error);
      return good(floyd(g.value));
    },
  },
  {
    id: "kruskal",
    title: "Kruskal's minimum spanning tree",
    category: "graphs",
    lessonSlug: "mst",
    summary: "Sort the edges lightest first and keep each edge that joins two different components. Skipping the rest avoids cycles.",
    precondition: "The graph must be undirected.",
    complexity: { time: "O(m log m)", space: "O(n)", note: "Sorting dominates. Union-find keeps the component checks almost constant time." },
    pseudocode: ["sort all edges by weight", "for each edge (u, v, w) in that order:", "  if u and v are in different components: take the edge and merge them", "  else: skip it, since it would close a cycle", "report the total weight of the taken edges"],
    fields: [NODES, EDGES],
    presets: [
      { label: "Weighted", values: { nodes: "5", edges: "0 1 2; 0 3 6; 1 2 3; 1 3 8; 1 4 5; 2 4 7; 3 4 9", directed: "no" } },
      { label: "Disconnected", values: { nodes: "4", edges: "0 1 3; 2 3 1", directed: "no" } },
    ],
    run: (r) => {
      const g = parseGraph(r.nodes ?? "", r.edges ?? "", "no");
      if (!g.ok) return fail(g.error);
      return good(kruskal(g.value));
    },
  },
  {
    id: "prim",
    title: "Prim's minimum spanning tree",
    category: "graphs",
    lessonSlug: "mst",
    summary: "Grow one tree from the start. Each round adds the cheapest edge that leaves the tree and brings in a new node.",
    precondition: "The graph must be undirected.",
    complexity: { time: "O(n²) as written here; O(m log n) with a heap", space: "O(n)", note: "Scanning the cut each round keeps every choice visible." },
    pseudocode: ["tree = {start}", "while the tree has fewer than n nodes:", "  scan the edges with exactly one end in the tree; keep the cheapest", "  if there are none: the graph is not connected, stop", "  add the outside node of the cheapest edge, with that edge"],
    fields: [NODES, EDGES, START],
    presets: [
      { label: "Weighted", values: { nodes: "5", edges: "0 1 2; 0 3 6; 1 2 3; 1 3 8; 1 4 5; 2 4 7; 3 4 9", directed: "no", start: "0" } },
      { label: "Disconnected", values: { nodes: "4", edges: "0 1 3; 2 3 1", directed: "no", start: "0" } },
    ],
    run: (r) => {
      const g = parseGraph(r.nodes ?? "", r.edges ?? "", "no");
      if (!g.ok) return fail(g.error);
      const s = startNode(r, g.value.n);
      if (!s.ok) return fail(s.error);
      return good(prim(g.value, s.value));
    },
  },
  {
    id: "components",
    title: "Connected components",
    category: "graphs",
    lessonSlug: "dfs",
    summary: "Label each group of nodes that can reach each other. Start a new label whenever an unlabelled node is found, and label everything reachable from it.",
    precondition: "The graph must be undirected.",
    complexity: { time: "O(n + m)", space: "O(n)" },
    pseudocode: ["label every node unlabelled; c = 0", "for each node s:", "  if s is unlabelled: c = c + 1, and explore from s", "    label each node reached with c", "report the components"],
    fields: [NODES, EDGES],
    presets: [
      { label: "Three parts", values: { nodes: "6", edges: "0 1; 1 2; 3 4", directed: "no" } },
      { label: "Connected", values: { nodes: "4", edges: "0 1; 1 2; 2 3", directed: "no" } },
    ],
    run: (r) => {
      const g = parseGraph(r.nodes ?? "", r.edges ?? "", "no");
      if (!g.ok) return fail(g.error);
      return good(components(g.value));
    },
  },
  {
    id: "union-find",
    title: "Union-find (disjoint sets)",
    category: "graphs",
    lessonSlug: "union-find",
    summary: "Track which elements share a set. find returns a set's root; union merges two sets. Attaching the smaller tree under the larger keeps the trees shallow.",
    complexity: { time: "Nearly constant per operation with union by size and path compression", space: "O(n)", note: "Union by size keeps trees shallow; path compression flattens the paths that finds walk." },
    pseudocode: ["parent[i] = i and size[i] = 1 for every i", "find(x): follow parent links until a node points to itself", "  path compression: point every node on the path at the root", "union(a, b): ra = find(a); rb = find(b)", "  if ra == rb: they are already in one set", "  else: attach the smaller root under the larger", "find(x) returns the root of x's set"],
    fields: [
      { key: "nodes", label: "Number of elements", help: "Elements are numbered 0 to n-1. Up to 30.", placeholder: "e.g. 6" },
      { key: "ops", label: "Operations", help: 'Separate with commas: "union a b" or "find a".', placeholder: "e.g. union 0 1, union 2 3, find 1" },
    ],
    presets: [
      { label: "Merge and query", values: { nodes: "6", ops: "union 0 1, union 2 3, union 1 3, find 0" } },
      { label: "Redundant union", values: { nodes: "4", ops: "union 0 1, union 1 0, find 1" } },
    ],
    run: (r) => {
      const n = parseInt1(r.nodes ?? "", "The number of elements");
      if (!n.ok) return fail(n.error);
      if (n.value < 1 || n.value > 30) return fail("The number of elements must be between 1 and 30.");
      const ops = parseDsu(r.ops ?? "", n.value);
      if (!ops.ok) return fail(ops.error);
      return good(dsuOps(n.value, ops.value));
    },
  },
  {
    id: "fenwick",
    title: "Fenwick tree (binary indexed tree)",
    category: "structures",
    lessonSlug: "fenwick-tree",
    summary: "Store block sums so a prefix sum or a point change touches only about log n cells. Each index covers the block of values below its lowest set bit.",
    complexity: { time: "O(log n) per add or query", space: "O(n)", note: "Index 0 is unused, so indices run from 1 to n." },
    pseudocode: ["build: add each value at its index (1..n)", "add(i, d): while i <= n: tree[i] += d; i += i & -i", "query(i): sum = 0; while i > 0: sum += tree[i]; i -= i & -i", "return sum"],
    fields: [
      { key: "values", label: "Initial values", help: "Whole numbers separated by commas. Up to 12.", placeholder: "e.g. 3, 2, -1, 6, 5, 4, -3, 3" },
      { key: "ops", label: "Operations", help: 'Separate with commas: "add i d" adds d at 1-based index i, and "query i" gives the sum of indices 1 to i.', placeholder: "e.g. query 4, add 3 5, query 4" },
    ],
    presets: [
      { label: "Query and update", values: { values: "3, 2, -1, 6, 5, 4, -3, 3", ops: "query 4, add 3 5, query 4, query 8" } },
      { label: "Build only", values: { values: "1, 2, 3, 4", ops: "" } },
    ],
    run: (r) => {
      const v = parseInts(r.values ?? "", "The values", { min: 1, max: 12 });
      if (!v.ok) return fail(v.error);
      const ops = r.ops?.trim() ? parseFenOps(r.ops, v.value.length) : { ok: true as const, value: [] };
      if (!ops.ok) return fail(ops.error);
      return good(fenwickOps(v.value, ops.value));
    },
  },
  {
    id: "trie",
    title: "Trie: insert and search",
    category: "trees",
    lessonSlug: "string-algorithms",
    summary: "Store words by their letters, so words with a shared prefix share nodes. A search follows one child per letter, then checks whether the last node ends a stored word.",
    complexity: { time: "O(L) per insert or search, for word length L", space: "O(total letters)" },
    pseudocode: ["insert(word): node = root", "for each char c of word:", "  if node has no child c: create it", "  node = the child c", "mark node as the end of a word", "search(word): node = root", "for each char c of word: if no child c: return false", "  node = child c", "return node is marked as a word"],
    fields: [
      { key: "words", label: "Words to insert", help: "Up to 4 lowercase words of 1 to 4 letters, separated by commas.", placeholder: "e.g. cat, car, ca" },
      { key: "search", label: "Search for", help: "A lowercase word of 1 to 4 letters.", placeholder: "e.g. ca" },
    ],
    presets: [
      { label: "Stored word", values: { words: "cat, car, ca", search: "ca" } },
      { label: "Prefix only", values: { words: "cat, car", search: "ca" } },
      { label: "Missing", values: { words: "cat, car", search: "dog" } },
    ],
    run: (r) => {
      const w = parseWords(r.words ?? "");
      if (!w.ok) return fail(w.error);
      const s = parseWords(r.search ?? "");
      if (!s.ok || s.value.length !== 1) return fail("Search for exactly one lowercase word of 1 to 4 letters.");
      const prefixes = new Set<string>([""]);
      for (const x of w.value) for (let k = 1; k <= x.length; k++) prefixes.add(x.slice(0, k));
      if (prefixes.size > MAX_TRIE_NODES) return fail(`These words need ${prefixes.size} nodes. The limit is ${MAX_TRIE_NODES}, so the tree fits on screen. Use fewer or shorter words.`);
      return good(trieOps(w.value, s.value[0] ?? ""));
    },
  },
  {
    id: "interval-greedy",
    title: "Greedy: most non-overlapping intervals",
    category: "techniques",
    lessonSlug: "greedy",
    summary: "Sort by end time and always take the interval that finishes first among those that fit. That choice never blocks a better one later.",
    complexity: { time: "O(n log n)", space: "O(n)", note: "The sort dominates. The scan itself is one pass." },
    pseudocode: ["sort the intervals by end time", "last = -∞; taken = []", "for each interval [s, e] in that order:", "  if s >= last: take it, and last = e", "  else: skip it, since it overlaps a taken interval", "report the taken intervals"],
    fields: [{ key: "intervals", label: "Intervals", help: 'Each as "start end" with 0 <= start < end <= 99, separated by semicolons. Up to 10.', placeholder: "e.g. 1 4; 3 5; 0 6; 5 7" }],
    presets: [
      { label: "Eight intervals", values: { intervals: "1 4; 3 5; 0 6; 5 7; 3 9; 5 9; 6 10; 8 11" } },
      { label: "All overlap", values: { intervals: "0 5; 1 6; 2 7" } },
    ],
    run: (r) => {
      const iv = parseIntervals(r.intervals ?? "");
      if (!iv.ok) return fail(iv.error);
      return good(intervalGreedy(iv.value));
    },
  },
  {
    id: "n-queens",
    title: "Backtracking: N-Queens",
    category: "techniques",
    lessonSlug: "recursion-2",
    summary: "Place one queen per row. When a row has no safe column, undo the last choice and try the next. The search tries every board and keeps the valid ones.",
    complexity: { time: "O(n!) worst case, far less with pruning", space: "O(n)", note: "Limited to 6 here so the full search stays watchable." },
    pseudocode: ["solve(row):", "  if row == n: record the solution, return", "  for each column:", "    if safe: place a queen, solve(row + 1), then remove it (backtrack)", "    else skip the column"],
    fields: [{ key: "n", label: "Board size n", help: "From 1 to 6.", placeholder: "e.g. 4" }],
    presets: [{ label: "n = 4", values: { n: "4" } }, { label: "n = 5", values: { n: "5" } }],
    run: (r) => {
      const n = parseInt1(r.n ?? "", "The board size");
      if (!n.ok) return fail(n.error);
      if (n.value < 1 || n.value > 6) return fail("The board size must be from 1 to 6.");
      return good(nQueens(n.value));
    },
  },
  {
    id: "segment-tree",
    title: "Segment tree: range minimum",
    category: "trees",
    lessonSlug: "segment-tree",
    summary: "Each node stores the minimum of a range, and the root covers everything. A query combines a few nodes that exactly cover the range, and an update recomputes only the nodes above one leaf.",
    complexity: { time: "O(log n) per query or update", space: "O(n)", note: "Values are 0 to 99 so the labels fit on the nodes." },
    pseudocode: ["build(k, l, r): a leaf stores a[l]; otherwise build both halves, then store their min", "query(k, ql, qr): outside the range → ∞; inside → stored min; partly → min of both halves", "update(k, i, v): descend to leaf i, set it, recompute each node on the way back"],
    fields: [
      { key: "values", label: "Values", help: "Non-negative whole numbers, up to 99, separated by commas. Up to 8.", placeholder: "e.g. 5, 2, 8, 1, 9, 3" },
      { key: "ops", label: "Operations", help: 'Separate with commas: "query l r" for the minimum of indices l to r, or "update i v" to set index i to v.', placeholder: "e.g. query 1 4, update 2 0, query 0 5" },
    ],
    presets: [
      { label: "Query and update", values: { values: "5, 2, 8, 1, 9, 3", ops: "query 1 4, update 2 0, query 0 5" } },
      { label: "Build only", values: { values: "7, 4, 6, 2", ops: "" } },
    ],
    run: (r) => {
      const v = parseInts(r.values ?? "", "The values", { min: 1, max: 8 });
      if (!v.ok) return fail(v.error);
      if (v.value.some((x) => x < 0 || x > 99)) return fail("Segment tree values must be from 0 to 99 so the labels fit on the nodes.");
      const ops = r.ops?.trim() ? parseSegOps(r.ops, v.value.length) : { ok: true as const, value: [] };
      if (!ops.ok) return fail(ops.error);
      return good(segmentTreeOps(v.value, ops.value));
    },
  },
  {
    id: "bst-delete",
    title: "Binary search tree: insert, delete, search",
    category: "trees",
    lessonSlug: "trees",
    summary: "Insert, delete and search on one tree that changes shape. Deleting a node with two children replaces its value with the next value in order.",
    precondition: "At most 9 keys in the tree at once. Keys are 0 to 99.",
    complexity: { time: "O(h) per operation, where h is the height", space: "O(n)", note: "h is about log n for a balanced tree, but n in the worst case, such as keys inserted in sorted order." },
    pseudocode: BST_PSEUDOCODE,
    fields: [{ key: "ops", label: "Operations", help: 'Separate with commas: "insert x", "delete x", or "search x". Up to 20 operations.', placeholder: "e.g. insert 8, insert 3, insert 10, delete 3" }],
    presets: [
      { label: "Delete with two children", values: { ops: "insert 8, insert 3, insert 10, insert 1, insert 6, insert 14, delete 3, search 6" } },
      { label: "Missing key", values: { ops: "insert 5, insert 2, delete 9, search 5" } },
    ],
    run: (r) => {
      const o = parseOps(r.ops ?? "", { insert: true, delete: true, search: true });
      if (!o.ok) return fail(o.error);
      const present = new Set<number>();
      for (const op of o.value) {
        const x = op.arg ?? 0;
        if (x < 0 || x > 99) return fail("Keep every key from 0 to 99 so the labels fit.");
        if (op.name === "insert" && !present.has(x)) {
          present.add(x);
          if (present.size > MAX_BST_KEYS) return fail(`More than ${MAX_BST_KEYS} keys would be in the tree at once. Delete some first so it fits on screen.`);
        } else if (op.name === "delete") {
          present.delete(x);
        }
      }
      return good(bstOps(o.value));
    },
  },
  {
    id: "trie-delete",
    title: "Trie: insert, delete and search",
    category: "trees",
    lessonSlug: "string-algorithms",
    summary: "Delete a word by unmarking its end, then remove only the nodes nothing else needs. A shared prefix stays while another word still uses it.",
    precondition: "At most 16 trie nodes at once, including the root. Words are 1 to 4 lowercase letters.",
    complexity: { time: "O(L) per operation, for word length L", space: "O(total letters stored)" },
    pseudocode: TRIE_OPS_PSEUDOCODE,
    fields: [{ key: "ops", label: "Operations", help: 'Separate with commas: "insert word", "delete word", or "search word".', placeholder: "e.g. insert cat, insert car, delete cat" }],
    presets: [
      { label: "Delete keeps shared prefix", values: { ops: "insert cat, insert car, delete cat, search car" } },
      { label: "Delete prunes branch", values: { ops: "insert ca, insert cat, delete cat, search cat" } },
    ],
    run: (r) => {
      const t = parseTrieOps(r.ops ?? "");
      if (!t.ok) return fail(t.error);
      const gen = trieDynamic(t.value);
      const most = Math.max(0, ...gen.frames.map((f) => f.nodes.length));
      if (most > TRIE_NODE_LIMIT) return fail(`The trie would hold ${most} nodes at once. The limit is ${TRIE_NODE_LIMIT}, so it fits on screen.`);
      return good(gen);
    },
  },
  {
    id: "subset-sum",
    title: "Backtracking: subset sum",
    category: "techniques",
    lessonSlug: "recursion-2",
    summary: "For each value, try including it and then try skipping it. Stop a branch as soon as the running sum passes the target, so the search cuts off hopeless choices early.",
    precondition: "Values must be positive whole numbers. Up to 8 values.",
    complexity: { time: "O(2ⁿ) worst case, far less with pruning", space: "O(n)", note: "Every subset is one leaf of the search tree; pruning skips whole branches." },
    pseudocode: ["search(i, s): i is the next value, s is the running sum", "  if s == target: record the subset, return", "  if i == n or s > target: prune, return", "  include a[i]: search(i + 1, s + a[i]), then undo", "  exclude a[i]: search(i + 1, s)"],
    fields: [
      { key: "values", label: "Values", help: "Positive whole numbers up to 99, separated by commas. Up to 8.", placeholder: "e.g. 3, 34, 4, 12, 5, 2" },
      { key: "target", label: "Target sum", help: "The sum to reach, from 0 to 999.", placeholder: "e.g. 9" },
    ],
    presets: [
      { label: "Several subsets", values: { values: "3, 34, 4, 12, 5, 2", target: "9" } },
      { label: "None", values: { values: "3, 5, 7", target: "4" } },
    ],
    run: (r) => {
      const v = parseInts(r.values ?? "", "The values", { min: 1, max: 8 });
      if (!v.ok) return fail(v.error);
      if (v.value.some((x) => x < 1 || x > 99)) return fail("Subset sum values must be positive and at most 99.");
      const t = parseInt1(r.target ?? "", "The target");
      if (!t.ok) return fail(t.error);
      if (t.value < 0 || t.value > 999) return fail("The target must be between 0 and 999.");
      return good(subsetSum(v.value, t.value));
    },
  },
];

/** Shared run for the sorting algorithms: validates the array, then builds the frames. */
function sortRun(r: Record<string, string>, sort: (a: number[]) => ArrayGen): RunOutcome {
  const a = parseInts(r.array ?? "", "The array", { min: 0 });
  if (!a.ok) return fail(a.error);
  return good(sort(a.value));
}

export const getAlgorithm = (id: string): Algorithm | undefined => ALGORITHMS.find((a) => a.id === id);
export const algosForLesson = (slug: string): Algorithm[] => ALGORITHMS.filter((a) => a.lessonSlug === slug);

/** The inputs a fresh visit to an algorithm starts with: its first preset. */
export function defaultsOf(algo: Algorithm): Record<string, string> {
  const first = algo.presets[0];
  return Object.fromEntries(algo.fields.map((f) => [f.key, first?.values[f.key] ?? ""]));
}

/** Runs the algorithm on raw input. Any unexpected failure becomes a message instead of a crash. */
export function runAlgorithm(algo: Algorithm, raw: Record<string, string>): RunOutcome {
  try {
    return algo.run(raw);
  } catch {
    return fail("Something went wrong while building the steps. Check the input and try again.");
  }
}

/** Keeps a step index inside the frames that exist. */
export const clampIndex = (i: number, last: number): number => Math.max(0, Math.min(i, last));

