import { binarySearchSteps, bubbleSortSteps, pairSumSteps, slidingWindowSteps, type Viz } from "./steps";
import { bitmaskAssignSteps, treeDpSteps, pascalSteps, bitOpsSteps, kmpPrefixSteps, kmpSearchSteps, trieSteps, fenwickSteps, segQuerySteps, sparseSteps, dijkstraSteps, kruskalSteps, knapsackSteps, sieveSteps, gcdSteps, topoSteps, topoCycleSteps, mergeSortSteps, cyclicSortSteps, queensSteps, loopIfSteps, sliceSteps, hashTableSteps, zipSteps, rangeBoundsSteps, heapSteps, treeTraversalSteps, listReverseSteps, intervalGreedySteps, pairCountSteps, reverseSteps, bfsSteps, dfsSteps, fibTreeSteps, lcsSteps, monotonicStackSteps, prefixSumSteps, unionFindSteps, variableWindowSteps, primSteps, bellmanFordSteps, floydSteps, partitionSteps, segUpdateSteps, convexHullSteps, upsolveSteps } from "./generators";

/** Every visualization a lesson can reference by id. Frames are computed on the server and only serialised for the client player. */
const REGISTRY: Record<string, () => Viz> = {
  "prefix-build-and-query": () => ({ kind: "array", title: "Build the prefix array, then answer range queries", frames: prefixSumSteps([2, 4, 1, 5, 3, 6], [[1, 3], [0, 4], [3, 5]]) }),
  "binary-search-find": () => ({ kind: "array", title: "Binary search for 11: watch the region shrink", frames: binarySearchSteps([1, 3, 5, 7, 9, 11, 13, 15], 11) }),
  "binary-search-miss": () => ({ kind: "array", title: "Binary search for 8 (not present)", frames: binarySearchSteps([1, 3, 5, 7, 9, 11, 13, 15], 8) }),
  "two-pointers-pair": () => ({ kind: "array", title: "Pair with sum 13 in a sorted array", frames: pairSumSteps([1, 2, 4, 7, 11, 15], 13) }),
  "window-fixed": () => ({ kind: "array", title: "Best sum of a window of size 3", frames: slidingWindowSteps([2, 1, 5, 1, 3, 2], 3) }),
  "window-variable": () => ({ kind: "array", title: "Longest run with sum at most 8", frames: variableWindowSteps([3, 1, 2, 7, 4, 2, 1, 1, 5], 8) }),
  "nested-loops-pairs": () => ({ kind: "array", title: "Nested loops visit every pair: n(n−1)/2 of them", frames: pairCountSteps([4, 8, 15, 16, 23]) }),
  "array-reverse": () => ({ kind: "array", title: "Reverse an array in place", frames: reverseSteps([1, 2, 3, 4, 5, 6]) }),
  "tree-preorder": () => ({ kind: "graph", title: "Preorder: node, then left, then right", frames: treeTraversalSteps("pre") }),
  "tree-inorder": () => ({ kind: "graph", title: "Inorder: left, then node, then right", frames: treeTraversalSteps("in") }),
  "tree-postorder": () => ({ kind: "graph", title: "Postorder: left, right, then node", frames: treeTraversalSteps("post") }),
  "tree-level": () => ({ kind: "graph", title: "Level order: row by row with a queue", frames: treeTraversalSteps("level") }),
  "list-reverse": () => ({ kind: "graph", title: "Reverse a linked list by flipping each pointer", frames: listReverseSteps([1, 2, 3, 4]) }),
  "interval-greedy": () => ({ kind: "array", title: "Pick the most non-overlapping intervals", frames: intervalGreedySteps([[1, 4], [3, 5], [0, 6], [5, 7], [3, 9], [5, 9], [6, 10], [8, 11], [8, 12], [2, 14], [12, 16]]) }),
  "heap-insert-extract": () => ({ kind: "graph", title: "Min-heap: insert 1 (sift up), then extract the minimum (sift down)", frames: heapSteps([2, 5, 3, 9, 6], 1) }),
  "loop-if-trace": () => ({ kind: "array", title: "A loop with an if/else: label each number", frames: loopIfSteps(8) }),
  "list-slicing": () => ({ kind: "array", title: "Slicing a list: which items each form selects", frames: sliceSteps([10, 20, 30, 40, 50, 60]) }),
  "hash-buckets": () => ({ kind: "array", title: "A toy hash table: insert, collide, look up", frames: hashTableSteps() }),
  "zip-pairs": () => ({ kind: "array", title: "zip pairs two lists position by position", frames: zipSteps(["ana", "ben", "cy"], [90, 85, 72]) }),
  "range-bounds": () => ({ kind: "array", title: "range(): where it starts and where it stops", frames: rangeBoundsSteps() }),
  "sieve": () => ({ kind: "array", title: "Sieve of Eratosthenes: cross out multiples, keep the primes", frames: sieveSteps(25) }),
  "gcd-euclid": () => ({ kind: "array", title: "Euclid's algorithm for gcd(48, 18)", frames: gcdSteps(48, 18) }),
  "topo-order": () => ({ kind: "graph", title: "Topological order with Kahn's algorithm", frames: topoSteps() }),
  "topo-cycle": () => ({ kind: "graph", title: "When there is a cycle, the queue runs dry early", frames: topoCycleSteps() }),
  "merge-sort": () => ({ kind: "array", title: "Merge sort: merge two sorted halves", frames: mergeSortSteps([5, 2, 4, 1, 6, 3]) }),
  "cyclic-sort": () => ({ kind: "array", title: "Cyclic sort: swap each value home", frames: cyclicSortSteps([3, 1, 5, 4, 2]) }),
  "nqueens-backtrack": () => ({ kind: "grid", title: "4-Queens: place, fail, backtrack", frames: queensSteps(4) }),
  "dijkstra": () => ({ kind: "graph", title: "Dijkstra from A: settle the closest node, relax its edges", frames: dijkstraSteps() }),
  "kruskal": () => ({ kind: "graph", title: "Kruskal: lightest edge first, skip anything that closes a cycle", frames: kruskalSteps() }),
  "knapsack-table": () => ({ kind: "grid", title: "0/1 knapsack: fill the table row by row", frames: knapsackSteps([1, 3, 4, 5], [1, 4, 5, 7], 7) }),
  "fenwick": () => ({ kind: "array", title: "Fenwick tree: a prefix query and a point update touch only a few cells", frames: fenwickSteps() }),
  "segment-query": () => ({ kind: "graph", title: "Segment tree: answering a range-minimum query", frames: segQuerySteps() }),
  "sparse-table": () => ({ kind: "array", title: "Sparse table: build the levels, then answer with two blocks", frames: sparseSteps() }),
  "bit-ops": () => ({ kind: "array", title: "Bit operations on 12 and 10 (lowest bit first)", frames: bitOpsSteps(12, 10) }),
  "kmp-prefix": () => ({ kind: "array", title: "KMP prefix function of \"abacaba\"", frames: kmpPrefixSteps("abacaba") }),
  "kmp-search": () => ({ kind: "array", title: "KMP search: the text pointer never moves back", frames: kmpSearchSteps("abcabcabd", "abcabd") }),
  "trie-build": () => ({ kind: "graph", title: "A trie: insert words, then look them up", frames: trieSteps() }),
  "pascal-triangle": () => ({ kind: "grid", title: "Pascal's triangle: each cell is the sum of the two above it", frames: pascalSteps(7) }),
  "bitmask-assign": () => ({ kind: "array", title: "Bitmask DP: assign 3 workers to 3 tasks", frames: bitmaskAssignSteps() }),
  "tree-dp": () => ({ kind: "graph", title: "Tree DP: best set of non-adjacent nodes, computed bottom-up", frames: treeDpSteps() }),
  "bubble-sort": () => ({ kind: "array", title: "Bubble sort", frames: bubbleSortSteps([5, 2, 4, 1, 3]) }),
  "monotonic-next-greater": () => ({ kind: "array", title: "Next greater element with a monotonic stack", frames: monotonicStackSteps([2, 1, 5, 3, 4, 6, 1]) }),
  "union-find-ops": () => ({ kind: "array", title: "Union-Find: parent and size arrays", frames: unionFindSteps(6, [[0, 1], [2, 3], [1, 3], [4, 5], [0, 2], [3, 5]]) }),
  "fib-tree-plain": () => ({ kind: "graph", title: "fib(5) without memoization: the same calls repeat", frames: fibTreeSteps(5, false) }),
  "fib-tree-memo": () => ({ kind: "graph", title: "fib(5) with memoization: repeats become cache hits", frames: fibTreeSteps(5, true) }),
  "fib-call-stack": () => ({ kind: "graph", title: "The call stack while computing fib(4)", frames: fibTreeSteps(4, false) }),
  "bfs-graph": () => ({ kind: "graph", title: "BFS from A: the queue drives the order", frames: bfsSteps("A") }),
  "dfs-graph": () => ({ kind: "graph", title: "DFS from A: dive, then back up", frames: dfsSteps("A") }),
  "lcs-table": () => ({ kind: "grid", title: "Longest common subsequence of ABCB and BDCAB", frames: lcsSteps("ABCB", "BDCAB") }),
  "prim-grow": () => ({ kind: "graph", title: "Prim from A: grow one tree, always adding the cheapest edge out", frames: primSteps() }),
  "bellman-ford": () => ({ kind: "graph", title: "Bellman–Ford: relax every edge each round, even with a negative edge", frames: bellmanFordSteps() }),
  "floyd-warshall": () => ({ kind: "grid", title: "Floyd–Warshall: try each node as a stop-over, one at a time", frames: floydSteps() }),
  "quicksort-partition": () => ({ kind: "array", title: "Quicksort partition around the last element", frames: partitionSteps([5, 2, 8, 1, 9, 3, 7]) }),
  "segment-update": () => ({ kind: "graph", title: "Segment tree: change one value, then recompute only its ancestors", frames: segUpdateSteps() }),
  "convex-hull": () => ({ kind: "graph", title: "Monotone chain: build the hull, popping points that turn the wrong way", frames: convexHullSteps([[1, 1], [5, 0], [6, 3], [4, 6], [1, 5], [0, 3], [3, 3], [3, 0], [2, 2]]) }),
  "contest-knapsack": () => ({ kind: "grid", title: "Fifty minutes, three problems: fill the table to pick the best set", frames: knapsackSteps([10, 20, 30], [60, 100, 120], 50) }),
  "upsolve-map": () => ({ kind: "grid", title: "Upsolving builds a map of patterns you can now recognise", frames: upsolveSteps() }),
};

export const VIZ_IDS: ReadonlySet<string> = new Set(Object.keys(REGISTRY));
export const vizById = (id: string): Viz | null => REGISTRY[id]?.() ?? null;

export type { Viz } from "./steps";
/** Legacy: the single visualization the old lesson page showed for a topic. */
export function vizFor(slug: string): { title: string; frames: import("./steps").Frame[] } | null {
  const id = ({ "binary-search": "binary-search-find", "two-pointers": "two-pointers-pair", "sliding-window": "window-fixed", "sorting-basics": "bubble-sort" } as Record<string, string>)[slug];
  const v = id ? vizById(id) : null;
  return v && v.kind === "array" ? { title: v.title, frames: v.frames } : null;
}
