import type { LessonV2 } from "../lesson-types";

const FEN = String.raw`class Fenwick:
    def __init__(self, n):
        self.n = n
        self.t = [0] * (n + 1)          # 1-indexed: t[0] is unused

    def update(self, i, delta):          # add delta to position i
        while i <= self.n:
            self.t[i] += delta
            i += i & -i

    def prefix(self, i):                 # sum of positions 1..i
        total = 0
        while i > 0:
            total += self.t[i]
            i -= i & -i
        return total

    def range_sum(self, l, r):           # sum of positions l..r
        return self.prefix(r) - self.prefix(l - 1)`;
const naive = String.raw`from itertools import accumulate

a = [3, 2, -1, 6, 5, 4, -3, 3]
prefix = [0] + list(accumulate(a))
print(prefix[7] - prefix[0])   # 16

a[2] += 5                              # one value changes ...
prefix = [0] + list(accumulate(a))     # ... so the whole prefix array is rebuilt: O(n)
print(prefix[7] - prefix[0])   # 21`;
const fenCode = String.raw`${FEN}

f = Fenwick(8)
for i, v in enumerate([3, 2, -1, 6, 5, 4, -3, 3], start=1):
    f.update(i, v)
print(f.prefix(7))   # 16
print(f.range_sum(3, 6))   # 14
f.update(3, 5)
print(f.range_sum(3, 6))   # 19
print(f.t[1:])   # [3, 5, 4, 15, 5, 9, -3, 24]
print(5 & -5, 6 & -6, 8 & -8, 12 & -12)   # 1 2 8 4`;
const build = String.raw`def build(a):
    n = len(a)
    t = [0] + list(a)
    for i in range(1, n + 1):
        j = i + (i & -i)                 # the parent block that also contains position i
        if j <= n:
            t[j] += t[i]
    return t

print(build([3, 2, -1, 6, 5, 4, -3, 3])[1:])   # [3, 5, -1, 10, 5, 9, -3, 19]

import random
random.seed(5)
ok = True
for _ in range(300):
    a = [random.randint(-9, 9) for _ in range(random.randint(1, 12))]
    t = build(a)
    for i in range(1, len(a) + 1):
        total, j = 0, i
        while j > 0:
            total += t[j]
            j -= j & -j
        ok = ok and total == sum(a[:i])
print(ok)   # True`;
const numarray = String.raw`${FEN}

class NumArray:
    def __init__(self, nums):
        self.a = [0] * len(nums)
        self.f = Fenwick(len(nums))
        for i, v in enumerate(nums):
            self.set(i, v)

    def set(self, i, v):                  # i is 0-indexed here
        self.f.update(i + 1, v - self.a[i])
        self.a[i] = v

    def sum(self, l, r):
        return self.f.range_sum(l + 1, r + 1)

na = NumArray([1, 3, 5])
print(na.sum(0, 2))   # 9
na.set(1, 2)
print(na.sum(0, 2))   # 8
na.set(1, 2)
print(na.sum(1, 1))   # 2`;
const inv = String.raw`${FEN}

def count_inversions(a):
    ranks = {v: i for i, v in enumerate(sorted(set(a)), start=1)}   # compress values to 1..k
    f = Fenwick(len(ranks))
    inversions = 0
    for seen, x in enumerate(a):
        r = ranks[x]
        inversions += seen - f.prefix(r)       # earlier values that are strictly greater than x
        f.update(r, 1)
    return inversions

print(count_inversions([2, 4, 1, 3, 5]))   # 3
print(count_inversions([5, 4, 3, 2, 1]))   # 10
print(count_inversions([2, 2, 1]))   # 2
print(count_inversions([10**9, 1, 10**9]))   # 1`;

export const fenwickTree: LessonV2 = {
  topic: "fenwick-tree", depth: "complete", minutes: 45,
  hook: "A tiny structure that keeps prefix sums up to date while values change: both updating and querying cost only about log n steps.",
  objectives: [
    "Explain the problem a Fenwick tree solves, and why a prefix-sum array cannot handle changing data.",
    "Read and use lowbit (`i & -i`), and trace which cells a query and an update touch.",
    "Implement point update, prefix query and range query in a few lines.",
    "Build a Fenwick tree in O(n) and convert “set a value” into “add a difference”.",
    "Use a Fenwick tree with coordinate compression to count inversions, and know its limits (invertible operations only).",
  ],
  prereqNote: "Prefix Sum is essential. Comfort with binary numbers helps: you will use the lowest set bit of an index.",
  sections: [
    { kind: "intuition", id: "ledger", title: "A ledger with running subtotals on every page",
      paras: ["A shop keeps its sales in a ledger. A manager keeps asking “how much have we sold since the start of the month up to day 17?”, while clerks keep correcting individual days. Storing only the daily figures makes each question slow; storing a running total after each day makes questions instant but every correction forces you to rewrite all the later totals.",
        "A Fenwick tree is a clever compromise: it stores a few **partial subtotals**, each covering a block of days whose length is a power of two. Any prefix is the sum of at most log n blocks, and any single correction touches at most log n blocks."] },
    { kind: "naive", id: "naive", title: "A prefix array that must be rebuilt",
      paras: ["The Prefix Sum lesson gave O(1) range sums, but only for data that never changes. If one value changes, every prefix sum after it changes too.",
        "Rebuilding the prefix array after each update costs O(n). With n = q = 2 × 10⁵ interleaved updates and queries, that is about 4 × 10¹⁰ steps. Skipping the array and summing the range directly costs O(n) per query: equally slow."],
      code: naive,
      cost: "O(n) per update (or O(n) per query), so O(n × q) overall when updates and queries are mixed." },
    { kind: "observation", id: "observation", title: "Blocks whose length is the lowest set bit",
      paras: ["Any number is a sum of distinct powers of two: 7 = 4 + 2 + 1. Likewise any prefix of length 7 splits into three blocks of lengths 4, 2 and 1. Store the sum of each such block, and a prefix query adds at most log₂ n numbers.",
        "The trick is *which* blocks. Let `lowbit(i)` be the lowest set bit of `i` (computed as `i & -i`). Define `T[i]` as the sum of the `lowbit(i)` values ending at position `i`. Then `T[4]` covers positions 1 to 4, `T[6]` covers 5 to 6, `T[7]` covers 7 alone. A query on `i` jumps to `i − lowbit(i)` after taking `T[i]`; an update on `i` jumps to `i + lowbit(i)`, the next block that also contains `i`."] },
    { kind: "concept", id: "concept", title: "lowbit and the two walks",
      paras: ["Everything in a Fenwick tree comes from one expression, `i & -i`, which isolates the lowest 1-bit of `i`."],
      bullets: ["`6 = 110` in binary, so `6 & -6 = 010 = 2`. `12 = 1100`, so `12 & -12 = 4`. A power of two such as 8 has `8 & -8 = 8`.", "**Query (prefix up to i):** add `T[i]`, then `i -= i & -i`; repeat until `i` is 0. This strips one bit per step, so at most log₂ n steps.", "**Update (add δ at i):** add δ to `T[i]`, then `i += i & -i`; repeat while `i <= n`. This climbs to ever larger blocks that contain position `i`.", "**Range sum (l to r):** `prefix(r) − prefix(l − 1)`, exactly as with a prefix array.", "The tree is **1-indexed**: position 0 would make `i & -i` equal 0 and loop forever.", "It is not really a tree in memory: it is one flat array, and the “tree” is the pattern of which blocks cover which positions."] },
    { kind: "viz", id: "viz-fenwick", title: "A query and an update on 8 values", viz: "fenwick",
      paras: ["The top row is the Fenwick array T (index 0 is unused); the row below it is the original values. First a **prefix query** for the first 7 values: watch it hop from 7 to 6 to 4, taking one block at a time. Then a **point update**: adding 5 at position 3 climbs 3 → 4 → 8, fixing only the blocks that contain position 3."] },
    { kind: "example", id: "example", title: "The numbers by hand",
      paras: ["For `a = [3, 2, −1, 6, 5, 4, −3, 3]` (positions 1 to 8), the stored blocks are:"],
      table: { head: ["i", "lowbit", "block covered", "T[i]"], rows: [["1", "1", "1", "3"], ["2", "2", "1 to 2", "5"], ["3", "1", "3", "−1"], ["4", "4", "1 to 4", "10"], ["5", "1", "5", "5"], ["6", "2", "5 to 6", "9"], ["7", "1", "7", "−3"], ["8", "8", "1 to 8", "19"]] },
      steps: [{ title: "Prefix of 7", body: "7 = 111 in binary. Take T[7] = −3 (position 7), then i = 6: T[6] = 9 (positions 5 to 6), then i = 4: T[4] = 10 (positions 1 to 4). Total −3 + 9 + 10 = 16. Three reads instead of seven." }, { title: "Update position 3 by +5", body: "T[3] becomes 4, then i = 3 + 1 = 4: T[4] becomes 15, then i = 4 + 4 = 8: T[8] becomes 24, then i = 16 which is past the end. Three writes." }] },
    { kind: "code", id: "code-fenwick", title: "A Fenwick tree in a dozen lines",
      paras: ["The class has three methods. The two loops are the two walks."],
      pseudocode: "update(i, δ): while i <= n: T[i] += δ; i += lowbit(i)\nprefix(i):    total = 0; while i > 0: total += T[i]; i -= lowbit(i); return total\nrange_sum(l, r) = prefix(r) − prefix(l − 1)",
      code: fenCode,
      walkthrough: ["`update` walks **up**: from `i` to the next block that contains it. `prefix` walks **down**: from `i` stripping its lowest bit.", "Building the tree by calling `update` once per value costs O(n log n). The final `print(f.t[1:])` shows the array after the extra `update(3, 5)`: `[3, 5, 4, 15, 5, 9, -3, 24]`, exactly as in the animation.", "`range_sum(3, 6)` is `prefix(6) − prefix(2)`: from 14 to 19 after adding 5 at position 3.", "The last line shows `lowbit` for a few numbers: `5 & -5 = 1`, `6 & -6 = 2`, `8 & -8 = 8`, `12 & -12 = 4`."] },
    { kind: "code", id: "code-build", title: "Building in O(n), and checking it",
      paras: ["Instead of n separate updates, push each block's total into its parent block once. The parent of block `i` is `i + lowbit(i)`. The second half of the snippet checks the result against plain sums on 300 random arrays, a habit worth copying whenever you write a data structure."],
      code: build,
      walkthrough: ["`t = [0] + list(a)` starts every block as just its own value. Then in increasing `i`, add `t[i]` to its parent `t[i + lowbit(i)]`. By the time we reach `i`, all of its children have already contributed.", "The result `[3, 5, -1, 10, 5, 9, -3, 19]` matches the table in the example (before the update).", "The check confirms that for every prefix, the walk over `t` equals the ordinary sum of the first `i` values: it prints True.", "Total cost is O(n): each position pushes into one parent."] },
    { kind: "complexity", id: "complexity", title: "Costs, and what a Fenwick tree cannot do",
      rows: [
        { what: "Point update", time: "O(log n)", space: "O(1)", why: "At most log₂ n hops, each adding the lowest bit." },
        { what: "Prefix / range query", time: "O(log n)", space: "O(1)", why: "At most log₂ n hops, each stripping one bit (a range uses two prefix queries)." },
        { what: "Build from an array", time: "O(n)", space: "O(n)", why: "Each position pushes into one parent block." },
        { what: "Prefix-sum array, for comparison", time: "query O(1), update O(n)", space: "O(n)", why: "Updates must rewrite every later total." },
        { what: "Plain array, for comparison", time: "update O(1), query O(n)", space: "O(n)", why: "Queries must add up the range." }],
      paras: ["A Fenwick tree balances the two: both operations cost O(log n). Its limitation: it needs an operation you can **undo** (sum, xor, count), because a range is computed as `prefix(r) − prefix(l − 1)`. Minimum and maximum cannot be undone, so use a segment tree or sparse table for them."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Index 0", handle: "The tree is 1-indexed. Updating position 0 would loop forever because `0 & -0 = 0`. Convert 0-indexed input once." }, { case: "Setting a value instead of adding", handle: "Keep the original array and update by the **difference**: `update(i, new − old)`." }, { case: "Range with l = 1", handle: "`prefix(0)` returns 0 (the loop does not run), so the formula still works." }, { case: "Large values", handle: "Sums can exceed 32 bits (2 × 10⁵ values of 10⁹). Python is safe; use 64-bit integers elsewhere." }, { case: "Values up to 10⁹ used as positions", handle: "Compress coordinates first (map the sorted distinct values to 1..k), as in the inversion-count problem." }, { case: "Many updates before any query", handle: "If all updates come first, a plain prefix sum is simpler (or a difference array)." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Using 0-indexed positions.", fix: "A Fenwick tree must start at 1. Add 1 when reading 0-indexed positions, and remember it when writing the range formula." }, { mistake: "Writing `i -= i & -i` in the update loop (or `+=` in the query loop).", fix: "Updates go **up** (`+=`), queries go **down** (`-=`)." }, { mistake: "Using it for minimum or maximum range queries.", fix: "Those need a segment tree or sparse table: min and max cannot be subtracted out." }, { mistake: "Overwriting instead of adding.", fix: "`update` adds a delta. To set a value, add `new − old`." }, { mistake: "Allocating size n instead of n + 1.", fix: "Index n must exist: allocate `n + 1` cells." }, { mistake: "Counting “smaller” and “not greater” the same way.", fix: "In the inversion problem, equal values must **not** count as inversions: use `prefix(rank)` for “not greater”." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a Fenwick-tree problem",
      signals: ["Values **change** between queries, and you need **sums (or counts, or xor) over ranges or prefixes**.", "“Process n updates and q queries, each of the form: set a value / add to a position / ask the sum of l to r.”", "**Counting how many earlier elements are smaller or larger** than the current one (inversions, “count of smaller numbers after self”): a Fenwick tree over compressed values.", "A **running frequency table** where you ask “how many values so far are at most x?”.", "Both n and the number of operations are around 10⁵ to 2 × 10⁵, so O(n) per operation is too slow but O(log n) is fine."],
      notThis: ["The data never changes: a prefix-sum array is simpler and O(1) per query.", "The query is minimum, maximum or gcd over a range: segment tree (with updates) or sparse table (without).", "You need to add a value to a whole **range** and then query a range (lazy propagation in a segment tree, or two Fenwick trees as an advanced trick)."] },
    { kind: "worked", id: "worked-numarray", title: "A mutable array with range sums",
      problem: "Design a structure for an array of integers that supports `set(i, v)` (replace the value at index i) and `sum(l, r)` (the sum of indices l to r, 0-indexed, inclusive), each in O(log n).",
      approach: ["Keep a copy of the current values and a Fenwick tree over them.", "To set a value, add the **difference** `v − old` at position `i + 1` (the tree is 1-indexed), then store the new value.", "To sum a range, use `range_sum(l + 1, r + 1)`."],
      code: numarray,
      takeaway: "Setting a value is the same as adding a difference, which is why a structure built for `add` also supports `set`. The only bookkeeping is the 0-indexed to 1-indexed shift. Calling `set(1, 2)` twice leaves the sum unchanged the second time, because the difference is 0." },
    { kind: "worked", id: "worked-inversions", title: "Count inversions with a Fenwick tree",
      problem: "Count the pairs of positions i < j with a[i] > a[j] in O(n log n). (The Sorting II lesson solved this with merge sort.)",
      approach: ["Process the array left to right. For each new value x, the inversions it completes are the **earlier values strictly greater than x**.", "Keep a Fenwick tree counting how many earlier values have each rank. The number of earlier values that are *not greater* than x is `prefix(rank of x)`, so the number that are greater is `seen − prefix(rank)`.", "Values can be as large as 10⁹, so first map them to ranks 1..k (coordinate compression) by sorting the distinct values."],
      code: inv,
      takeaway: "A Fenwick tree is a fast way to ask “how many items so far are at most x?” while inserting items one at a time. The same pattern gives “count of smaller numbers after self” and many ordering-count problems. The fourth call shows compression at work: huge values become ranks 2, 1, 2 and the answer is 1." },
  ],
  cheatSheet: [{ label: "lowbit", value: "i & -i (lowest set bit)" }, { label: "Update (add δ at i)", value: "while i <= n: T[i] += δ; i += i & -i" }, { label: "Prefix (sum of 1..i)", value: "while i > 0: total += T[i]; i -= i & -i" }, { label: "Range", value: "prefix(r) − prefix(l − 1)" }, { label: "Cost", value: "O(log n) per operation, O(n) build, O(n) space" }, { label: "Needs", value: "1-indexing and an invertible operation (sum, xor, count)" }],
  summary: ["A Fenwick tree keeps prefix sums current under updates: both a query and an update cost O(log n).", "Cell `T[i]` stores the sum of the `lowbit(i)` values ending at position `i`; queries strip the lowest bit, updates add it.", "Set a value by adding the difference; build in O(n) by pushing each block into its parent.", "It only works for operations that can be undone (sum, xor, count), not min or max.", "With coordinate compression it counts inversions and “how many earlier values are at most x”."],
  checks: [
    { kind: "concept", q: "What is `12 & -12`, the lowbit of 12?", options: ["1", "2", "4", "8"], answer: 2, why: "12 is 1100 in binary; its lowest set bit is 100, which is 4." },
    { kind: "trace", q: "In an 8-position Fenwick tree, which cells does a prefix query for position 7 read?", options: ["T[7], T[6], T[4]", "T[7], T[8]", "T[1] to T[7]", "T[4], T[2], T[1]"], answer: 0, why: "7 → 7 − 1 = 6 → 6 − 2 = 4 → 4 − 4 = 0. The cells read are 7, 6 and 4." },
    { kind: "trace", q: "Updating position 3 in an 8-position tree changes which cells?", options: ["T[3], T[4], T[8]", "T[3], T[2], T[1]", "T[3] only", "T[3] to T[8]"], answer: 0, why: "3 → 3 + 1 = 4 → 4 + 4 = 8 → 8 + 8 = 16, which is past the end. So cells 3, 4 and 8." },
    { kind: "complexity", q: "What does a Fenwick tree cost per point update or prefix query?", options: ["O(1)", "O(log n)", "O(n)", "O(√n)"], answer: 1, why: "Each step adds or strips one bit of the index, so there are at most about log₂ n steps." },
    { kind: "recognize", q: "“Handle many updates to single values and many queries for the sum of a range” suggests:", options: ["A plain prefix-sum array", "A Fenwick tree (or segment tree)", "Sorting", "Union-Find"], answer: 1, why: "Mixed updates and range sums are the textbook case: both operations in O(log n)." },
    { kind: "concept", q: "Why can a Fenwick tree not answer range-minimum queries the way it answers range sums?", options: ["It is too slow", "A range is computed as prefix(r) − prefix(l − 1), and minimum cannot be subtracted out", "Minimum needs a heap", "It only stores positive numbers"], answer: 1, why: "Subtraction undoes a sum, but you cannot undo a minimum, so prefix minimums cannot give range minimums." },
    { kind: "trace", q: "Fenwick tree over [1, 2, 3, 4, 5] (1-indexed, built by adding each value). What is the prefix sum q(3)?", options: ["6", "5", "10", "3"], answer: 0, why: "1 + 2 + 3 = 6." },
    { kind: "trace", q: "After adding 10 at position 2 of the same tree, what is q(5)?", options: ["25", "15", "20", "30"], answer: 0, why: "The total was 15; adding 10 gives 25." },
    { kind: "trace", q: "Same tree with no update: what is the range sum from position 2 to 4 (q(4) - q(1))?", options: ["9", "6", "10", "4"], answer: 0, why: "Positions 2, 3, 4 hold 2, 3, 4, which sum to 9." },
    { kind: "concept", q: "What does the trick i & -i (the lowest set bit) give a Fenwick tree?", options: ["The step to the next node that covers index i during updates and queries", "Whether i is even", "The middle index", "A hash of i"], answer: 0, why: "Adding or removing this bit moves through the tree's covering blocks." },
    { kind: "complexity", q: "A Fenwick tree update or prefix query on n items: what is the time?", options: ["O(log n)", "O(1)", "O(n)", "O(n log n)"], answer: 0, why: "Each step clears or adds one lowest bit, so there are about log n steps." },
    { kind: "concept", q: "Why can't a Fenwick tree directly answer range minimum queries?", options: ["Min cannot be undone by subtraction, which Fenwick ranges rely on", "It is too slow", "It only stores sums of pairs", "Min needs the array sorted first"], answer: 0, why: "The tree combines blocks by subtraction, which needs an invertible operation." },
    { kind: "trace", q: "Count inversions with a Fenwick tree for a = [3, 1, 2] (pairs where a larger value comes first). What is printed?", options: ["2", "1", "3", "0"], answer: 0, why: "The inversions are (3,1) and (3,2)." },
    { kind: "concept", q: "Why are Fenwick trees usually 1-indexed?", options: ["Index 0 has lowest bit 0, so the loop would never move", "Python lists start at 1", "It saves memory", "Sums need index 1"], answer: 0, why: "With index 0, i & -i is 0 and the loop never advances." },
    { kind: "trace", q: "What does q(0) return on a Fenwick tree with any values added?", options: ["0", "1", "the total", "It raises an error"], answer: 0, why: "A prefix of length 0 is empty, so the loop never runs and the sum is 0." },
  ],
  nextNote: "Next, **Segment Tree** handles what a Fenwick tree cannot: minimum, maximum and other operations, plus updates to whole ranges.",
};
