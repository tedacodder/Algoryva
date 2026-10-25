import type { LessonV2 } from "../lesson-types";

const SP = String.raw`from math import gcd

class SparseTable:
    def __init__(self, a, op=min):
        self.op = op
        n = len(a)
        self.t = [list(a)]                       # t[k][i] = op over a[i .. i + 2^k - 1]
        k = 1
        while (1 << k) <= n:
            prev = self.t[k - 1]
            half = 1 << (k - 1)
            self.t.append([op(prev[i], prev[i + half]) for i in range(n - (1 << k) + 1)])
            k += 1

    def query(self, l, r):                       # inclusive positions l..r
        k = (r - l + 1).bit_length() - 1         # largest k with 2^k <= length
        return self.op(self.t[k][l], self.t[k][r - (1 << k) + 1])`;
const naive = String.raw`def all_answers(a):
    n = len(a)
    ans = {}
    for l in range(n):
        cur = a[l]
        for r in range(l, n):
            cur = min(cur, a[r])
            ans[(l, r)] = cur
    return ans

a = [5, 2, 6, 1, 7, 3, 8, 4]
table = all_answers(a)
print(table[(1, 6)])   # 1
print(len(table))   # 36
print(len(all_answers(list(range(500)))))   # 125250`;
const build = String.raw`${SP}

a = [5, 2, 6, 1, 7, 3, 8, 4]
sp = SparseTable(a)
print(sp.query(1, 6))   # 1
print(sp.query(5, 7))   # 3
print(sp.query(4, 4))   # 7
print(len(sp.t), [len(row) for row in sp.t])   # 4 [8, 7, 5, 1]
print(SparseTable(a, max).query(2, 5))   # 7
g = SparseTable([12, 18, 24, 36], gcd)
print(g.query(0, 3), g.query(1, 2), g.query(2, 3))   # 6 6 12`;
const check = String.raw`${SP}

import random
random.seed(9)
ok = True
for _ in range(300):
    n = random.randint(1, 17)
    a = [random.randint(-30, 30) for _ in range(n)]
    lo, hi = SparseTable(a, min), SparseTable(a, max)
    for _ in range(20):
        l = random.randrange(n)
        r = random.randint(l, n - 1)
        ok = ok and lo.query(l, r) == min(a[l:r + 1]) and hi.query(l, r) == max(a[l:r + 1])
print(ok)   # True`;
const sums = String.raw`def build_sum_table(a):
    n = len(a)
    t = [list(a)]
    k = 1
    while (1 << k) <= n:
        prev, half = t[k - 1], 1 << (k - 1)
        t.append([prev[i] + prev[i + half] for i in range(n - (1 << k) + 1)])
        k += 1
    return t

def range_sum(t, l, r):                        # disjoint blocks: O(log n) because sum is not idempotent
    total = 0
    length = r - l + 1
    k = length.bit_length() - 1
    while length > 0:
        if length >> k & 1:
            total += t[k][l]
            l += 1 << k
        k -= 1
        length &= (1 << (k + 1)) - 1
    return total

a = [5, 2, 6, 1, 7, 3, 8, 4]
t = build_sum_table(a)
print(range_sum(t, 1, 6))   # 27
print(range_sum(t, 0, 7), range_sum(t, 3, 3))   # 36 1
print(sum(a[1:7]))   # 27
print(min(5, 5), 5 + 5)   # 5 10`;
const spread = String.raw`${SP}

def range_spread(a, queries):
    lo, hi = SparseTable(a, min), SparseTable(a, max)
    return [hi.query(l, r) - lo.query(l, r) for l, r in queries]

print(range_spread([5, 2, 6, 1, 7, 3, 8, 4], [(0, 7), (2, 3), (4, 4), (1, 6)]))   # [7, 5, 0, 7]
print(range_spread([4], [(0, 0)]))   # [0]`;
const good = String.raw`${SP}

def longest_calm_stretch(a, d):
    lo, hi = SparseTable(a, min), SparseTable(a, max)
    best = 0
    l = 0
    for r in range(len(a)):
        while hi.query(l, r) - lo.query(l, r) > d:
            l += 1
        best = max(best, r - l + 1)
    return best

print(longest_calm_stretch([8, 2, 4, 7], 4))   # 2
print(longest_calm_stretch([10, 1, 2, 4, 7, 2], 5))   # 4
print(longest_calm_stretch([5], 0))   # 1`;

export const sparseTable: LessonV2 = {
  topic: "sparse-table", depth: "complete", minutes: 40,
  hook: "Answer range-minimum and range-maximum queries in a single step, after a one-time table-building pass, when the data never changes.",
  objectives: [
    "Explain why overlapping blocks are fine for min, max and gcd (idempotent operations) and not for sum.",
    "Build a sparse table in O(n log n) and answer a query in O(1) using two blocks of the largest power of two that fits.",
    "Compute that power of two with `bit_length`, and index the table correctly.",
    "Use two tables together (min and max) and combine a table with a two-pointer scan.",
    "Decide between a sparse table, a segment tree, a Fenwick tree and prefix sums.",
  ],
  prereqNote: "Prefix Sum (the idea of precomputing for fast queries) and Binary Search helps for the two-pointer example. Comfort with powers of two.",
  sections: [
    { kind: "intuition", id: "mileposts", title: "Two overlapping mileposts",
      paras: ["Suppose you want the lowest point on any stretch of a long road, and you have already written down the lowest point of every stretch that is 1, 2, 4, 8, … km long, starting at every kilometre. For a 6 km stretch, take the lowest point of a 4 km stretch at its start, and the lowest point of a 4 km stretch at its end. Together they cover the whole 6 km, with a 2 km overlap in the middle.",
        "The overlap does not matter for “lowest point”: counting the same stretch twice cannot change a minimum. That small observation turns each query into **two lookups**."] },
    { kind: "naive", id: "naive", title: "Precompute every possible answer",
      paras: ["The most direct way to make queries instant is to store the answer for **every** range `(l, r)` in advance. Each query becomes one dictionary lookup.",
        "But there are n(n + 1)/2 ranges: 36 for 8 values, 125,250 for 500, and about 5 × 10⁹ for n = 10⁵. Time and memory to build the table are both O(n²)."],
      code: naive,
      cost: "O(n²) time and memory to build: impossible for n = 10⁵." },
    { kind: "observation", id: "observation", title: "Only powers of two are needed, because overlap is harmless",
      paras: ["Store answers only for blocks whose length is a power of two (1, 2, 4, 8, …). There are about n blocks per length and log₂ n lengths, so n log n answers in total instead of n².",
        "Any range is covered by two blocks of the **same** power-of-two length: the largest power `2^k` that fits inside the range, placed at its left end and at its right end. For minimum, maximum, gcd, and, or, the overlap is harmless, because `min(x, x) = x`: such operations are called **idempotent**. A sum is *not* idempotent (overlapped values would be counted twice), so a sparse table cannot answer overlapping sums in O(1)."] },
    { kind: "concept", id: "concept", title: "How the table is organised",
      paras: ["Row `k` of the table holds blocks of length `2^k`."],
      bullets: ["`t[k][i]` = the answer (min, max, gcd, …) for positions `i` to `i + 2^k − 1`.", "**Row 0** is the array itself (blocks of length 1).", "**Row k** is built from row `k − 1`: a block of length `2^k` is two adjacent blocks of length `2^(k−1)`, so `t[k][i] = op(t[k−1][i], t[k−1][i + 2^(k−1)])`.", "Row `k` has `n − 2^k + 1` entries (blocks that would run past the end are not stored). There are about `log₂ n + 1` rows.", "**Query [l, r] (inclusive):** let `len = r − l + 1` and `k = floor(log₂ len)` (in Python: `len.bit_length() − 1`). The answer is `op(t[k][l], t[k][r − 2^k + 1])`.", "**Idempotent operations only** for the O(1) query: min, max, gcd, bitwise and, bitwise or.", "**Static data only:** if a value changes, every block containing it changes, so use a segment tree instead."] },
    { kind: "viz", id: "viz-sparse", title: "Building the table and answering two queries", viz: "sparse-table",
      paras: ["The top row is the array. Watch the three rows below it fill in: each cell combines two cells of the row above, and the highlighted values show the block it covers. At the end two queries are answered: each picks the largest power-of-two block that fits and uses two overlapping copies (blue and red). The overlap cells are drawn with the blue colour."] },
    { kind: "example", id: "example", title: "The table for [5, 2, 6, 1, 7, 3, 8, 4], by hand",
      paras: ["Minimum over blocks of length 1, 2, 4 and 8 starting at each position:"],
      table: { head: ["k (block length)", "table row", "number of entries"], rows: [["0 (length 1)", "5 2 6 1 7 3 8 4", "8"], ["1 (length 2)", "2 2 1 1 3 3 4", "7"], ["2 (length 4)", "1 1 1 1 3", "5"], ["3 (length 8)", "1", "1"]] },
      steps: [{ title: "Query positions 1 to 6", body: "Length 6, so k = 2 (4 ≤ 6 < 8). Blocks: `t[2][1]` covers 1 to 4 and `t[2][3]` covers 3 to 6 (since 6 − 4 + 1 = 3). min(1, 1) = 1. Positions 3 and 4 are counted twice, which does not matter." }, { title: "Query positions 5 to 7", body: "Length 3, so k = 1. Blocks `t[1][5]` (positions 5 to 6, value 3) and `t[1][6]` (positions 6 to 7, value 4). min(3, 4) = 3." }] },
    { kind: "code", id: "code-sparse", title: "A sparse table class",
      paras: ["Pass any idempotent operation: `min`, `max` or `math.gcd`."],
      pseudocode: "t[0] = the array\nfor k = 1 while 2^k <= n: t[k][i] = op(t[k−1][i], t[k−1][i + 2^(k−1)])\nquery(l, r): k = floor(log2(r − l + 1)); return op(t[k][l], t[k][r − 2^k + 1])",
      code: build,
      walkthrough: ["`(r - l + 1).bit_length() - 1` is `floor(log₂(length))` computed with integer arithmetic: a length of 6 is `110` in binary with bit length 3, so k = 2.", "`len(sp.t)` is 4 rows, with lengths `[8, 7, 5, 1]` as in the table above (row k has `n − 2^k + 1` entries).", "The same class gives a maximum table (`max`) or a range gcd table (`gcd`): the gcd of 12, 18, 24, 36 is 6, of 18 and 24 is 6, and of 24 and 36 is 12.", "A query does two list lookups and one `op`: O(1), however long the range."] },
    { kind: "code", id: "code-check", title: "Check it against brute force",
      paras: ["Index arithmetic with `r − 2^k + 1` is easy to get off by one. The snippet below tests both a min table and a max table on 300 random arrays of different sizes, including sizes that are not powers of two."],
      code: check,
      walkthrough: ["Array lengths from 1 to 17 cover the edge cases: length 1 (one row), exact powers of two, and awkward in-between sizes.", "Each query is compared with a plain `min(a[l:r + 1])` or `max(a[l:r + 1])`.", "Printing `True` shows every one of the 6,000 queries agreed. Cheap insurance before trusting the table in a contest."] },
    { kind: "code", id: "code-sums", title: "Why sums are different",
      paras: ["For a sum, overlapping blocks would count the shared values twice. You can still use the same table by splitting the range into **disjoint** blocks, one for each bit of its length, which takes O(log n) per query, but then a prefix-sum array (O(1)) or a Fenwick tree (with updates) is simply better."],
      code: sums,
      walkthrough: ["The range 1 to 6 has length 6 = 4 + 2: take the 4-block at position 1 and the 2-block at position 5. The code peels one bit of the length at a time.", "`range_sum` returns 27, matching `sum(a[1:7])`, so the disjoint decomposition is right.", "The last line makes the point numerically: `min(5, 5)` is still 5 (idempotent), but `5 + 5` is 10 (not idempotent)."] },
    { kind: "complexity", id: "complexity", title: "Costs and comparison with the other tools",
      rows: [
        { what: "Build", time: "O(n log n)", space: "O(n log n)", why: "About log₂ n rows, each with up to n entries, each computed in O(1) from the row above." },
        { what: "Query (min, max, gcd)", time: "O(1)", space: "O(1)", why: "Two table lookups and one `op`, whatever the range length." },
        { what: "Query (sum, using disjoint blocks)", time: "O(log n)", space: "O(1)", why: "One block per set bit of the length." },
        { what: "Update one value", time: "O(n) to rebuild", space: "-", why: "Every block containing the value changes. Use a segment tree for changing data." },
        { what: "Precompute every answer (naive)", time: "O(n²)", space: "O(n²)", why: "One entry for each of the n(n + 1)/2 ranges." }],
      paras: ["**Choosing a tool.** Static data: sums → prefix sums (O(1)); min, max, gcd → sparse table (O(1) query, O(n log n) memory). Changing data: sums or xor → Fenwick tree; min, max, range updates, or searching → segment tree. For n = 10⁵ a sparse table holds about 1.7 million cells: fine in C++, tight but workable in Python."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Range of length 1", handle: "`k = 0`, both lookups are the same cell, and the answer is the value itself." }, { case: "Range equal to a power of two", handle: "Both blocks coincide (`r − 2^k + 1 = l`): the answer is a single stored cell." }, { case: "n = 1", handle: "Only row 0 exists. Queries can only be `(0, 0)`." }, { case: "Using it for sums", handle: "Overlap double-counts. Use prefix sums, or decompose into disjoint blocks." }, { case: "Data changes", handle: "The table becomes stale. Rebuild (O(n log n)) or use a segment tree." }, { case: "Inclusive versus half-open", handle: "This class takes inclusive `[l, r]`. If your input is half-open, subtract 1 from `r`." }, { case: "Memory", handle: "For n = 10⁶ the table has about 2 × 10⁷ cells. Check the memory limit before choosing it." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Using a sparse table for range sums or counts in O(1).", fix: "Overlapping blocks would count shared elements twice. Only idempotent operations work." }, { mistake: "Computing k with floating-point `log2` and rounding wrongly.", fix: "Use `(length).bit_length() − 1`, or a precomputed `log` array." }, { mistake: "Second block starting at `r − 2^k` instead of `r − 2^k + 1`.", fix: "The block must *end* at r, so it starts at `r − 2^k + 1`. The brute-force check above catches this." }, { mistake: "Using it when values change.", fix: "Updates need a segment tree." }, { mistake: "Building rows with the wrong length.", fix: "Row k has `n − 2^k + 1` entries; building more indexes past the array." }, { mistake: "Forgetting that memory is n log n, not n.", fix: "Estimate the table size before using it for very large n." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a sparse-table problem",
      signals: ["**Many range queries** for the **minimum, maximum or gcd**, and the array is **never updated**.", "Queries are **online** (you must answer each as it comes) or numerous (10⁵ to 10⁶), so O(log n) per query would be acceptable but O(1) is nicer.", "You need both `max − min` or the ratio of two range statistics for many ranges (two tables).", "A method that repeatedly asks “what is the minimum of this stretch?” inside another loop, such as a **two-pointer window** over a static array.", "A related technique: the **lowest common ancestor** of two tree nodes reduces to a range minimum over an Euler tour, answered with a sparse table."],
      notThis: ["The array changes: segment tree.", "The query is a sum, count or xor: prefix sums or a Fenwick tree.", "Memory is very tight and n is huge: a segment tree uses O(n)."] },
    { kind: "worked", id: "worked-spread", title: "Spread of a range",
      problem: "Given an array and many queries `(l, r)`, print for each the difference between the largest and smallest value in positions l to r (inclusive).",
      approach: ["The array never changes, and the statistics are a maximum and a minimum: both idempotent.", "Build one sparse table for `max` and one for `min`.", "Each query is two O(1) lookups in each table and one subtraction."],
      code: spread,
      takeaway: "Two tables answer a compound question in O(1) per query. The spread of a single element is 0, and the whole array `[5, 2, 6, 1, 7, 3, 8, 4]` has maximum 8 and minimum 1, so spread 7." },
    { kind: "worked", id: "worked-calm", title: "Longest stretch whose values stay within d",
      problem: "Given an array and a number d, find the length of the longest contiguous stretch in which the largest value minus the smallest value is at most d.",
      approach: ["Use a **two-pointer window**: extend the right end `r` one step at a time; while the window's `max − min` exceeds d, move the left end `l` forward.", "Each check of `max − min` over `[l, r]` is a range query on a static array: two sparse tables answer it in O(1).", "Both pointers only move forward, so there are O(n) checks in total."],
      code: good,
      takeaway: "A sparse table pairs naturally with two pointers: the pointers decide *which* range to test and the table answers each test instantly. Total time is O(n log n) for building plus O(n) for the scan. (A monotonic deque does the scan with less memory, but needs more care.)" },
  ],
  cheatSheet: [{ label: "Table", value: "t[k][i] = op over a[i .. i + 2^k − 1]; t[k] built from t[k−1]" }, { label: "Query [l, r]", value: "k = (r − l + 1).bit_length() − 1; op(t[k][l], t[k][r − 2^k + 1])" }, { label: "Needs", value: "idempotent op (min, max, gcd, and, or) and static data" }, { label: "Cost", value: "build O(n log n) time and space; query O(1)" }, { label: "Not for", value: "sums (double counting) or changing data" }, { label: "Pairs well with", value: "two pointers, LCA via Euler tour" }],
  summary: ["A sparse table stores answers only for blocks whose length is a power of two, about n log n values in all.", "Any range is covered by two (possibly overlapping) blocks of the largest power of two that fits, so a query is two lookups.", "Overlap is harmless for idempotent operations (min, max, gcd) but double-counts sums.", "Build costs O(n log n); queries are O(1); it only suits data that never changes.", "Choose among prefix sums, sparse table, Fenwick tree and segment tree by two questions: does the data change, and is the operation undoable or idempotent?"],
  checks: [
    { kind: "complexity", q: "What is the time of one range-minimum query on a built sparse table?", options: ["O(log n)", "O(1)", "O(n)", "O(√n)"], answer: 1, why: "Two table lookups and one comparison, whatever the length of the range." },
    { kind: "concept", q: "Why can a sparse table use overlapping blocks for minimum but not for sums?", options: ["Sums are slower", "min(x, x) = x, so overlap changes nothing, but x + x = 2x double counts", "Minimum uses less memory", "Sums need negative numbers"], answer: 1, why: "Idempotent operations ignore repeated elements. A sum counts the overlapping values twice." },
    { kind: "trace", q: "For a query on positions 1 to 6 (length 6), which power of two is used for the two blocks?", options: ["2", "4", "6", "8"], answer: 1, why: "The largest power of two not exceeding 6 is 4 (k = 2). Blocks of length 4 start at position 1 and at position 3." },
    { kind: "trace", q: "How many rows (levels) does the table for 8 values have, and how long is row 2?", options: ["3 rows, row 2 has 6 entries", "4 rows, row 2 has 5 entries", "8 rows, row 2 has 8 entries", "4 rows, row 2 has 4 entries"], answer: 1, why: "Block lengths 1, 2, 4 and 8 give 4 rows. Row k has n − 2^k + 1 entries, so row 2 has 8 − 4 + 1 = 5." },
    { kind: "recognize", q: "“Answer 10⁶ queries for the maximum of a range in an array that is never modified” is best handled by:", options: ["A sparse table", "A Fenwick tree", "A heap", "Union-Find"], answer: 0, why: "Static data with an idempotent operation is exactly the case for O(1) queries after O(n log n) preprocessing." },
    { kind: "concept", q: "What should you use if values in the array are updated between queries?", options: ["A sparse table, rebuilding it each time is cheap", "A segment tree, which supports updates in O(log n)", "A heap", "Nothing; it is impossible"], answer: 1, why: "A change to one value invalidates every block containing it, so a sparse table would need an O(n log n) rebuild. A segment tree updates in O(log n)." },
    { kind: "trace", q: "Sparse table (overlapping power-of-two blocks) for a = [5, 2, 8, 1, 9]. What is the minimum over [1, 4)?", options: ["1", "2", "8", "5"], answer: 0, why: "The range holds 2, 8 and 1; its minimum is 1." },
    { kind: "trace", q: "Same sparse table: what is the minimum over [0, 2)?", options: ["2", "5", "8", "1"], answer: 0, why: "The range holds 5 and 2; the minimum is 2." },
    { kind: "concept", q: "Why can a sparse table answer a range query in O(1)?", options: ["Two overlapping power-of-two blocks cover the range, and min gives the same result when values overlap", "It stores every possible query", "It uses a hash map", "It sorts the array first"], answer: 0, why: "Overlap is harmless for min and max, so two lookups are enough." },
    { kind: "complexity", q: "What is the cost of building a sparse table on n values, and of one query?", options: ["O(n log n) to build, O(1) per query", "O(n) to build, O(n) per query", "O(n\u00b2) to build, O(log n) per query", "O(log n) to build, O(log n) per query"], answer: 0, why: "There are about log n levels of n entries each." },
    { kind: "concept", q: "Why does a sparse table work for min but not for range sums with overlap?", options: ["Overlapping blocks would count some values twice, which is wrong for sums", "Min is always slow", "Sums are not numbers", "Overlap is not allowed"], answer: 0, why: "Idempotent operations (min, max, gcd) tolerate overlap; sums do not." },
    { kind: "trace", q: "How many levels does a sparse table have for n = 8 (level 0 included)?", options: ["4", "3", "8", "5"], answer: 0, why: "Levels exist for block lengths 1, 2, 4 and 8." },
    { kind: "trace", q: "Sparse table on a = [5, 2, 8, 1, 9]: what is the minimum over the whole range [0, 5)?", options: ["1", "2", "5", "9"], answer: 0, why: "The smallest value in the array is 1." },
    { kind: "concept", q: "When is a sparse table the right choice?", options: ["The array is static and many range queries must be answered quickly", "The array changes after every query", "Only point updates happen", "The data is a graph"], answer: 0, why: "Building once makes every later query O(1), but updates need a rebuild." },
    { kind: "concept", q: "Can a sparse table answer range sums by overlapping two blocks?", options: ["No: the overlapping part would be counted twice", "Yes, always", "Only if the array is sorted", "Only for two-dimensional arrays"], answer: 0, why: "Sums need disjoint blocks, which is why sum queries use prefix sums or a Fenwick tree." },
  ],
  nextNote: "With prefix sums, Fenwick trees, segment trees and sparse tables you now have the full toolkit for range queries. **Advanced DP** is planned next.",
};
