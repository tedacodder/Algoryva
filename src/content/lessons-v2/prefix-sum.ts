import type { LessonV2 } from "../lesson-types";

export const prefixSum: LessonV2 = {
  topic: "prefix-sum",
  depth: "complete",
  minutes: 30,
  hook: "Answer thousands of range-sum questions by doing the adding once, up front, instead of once per question.",
  objectives: [
    "Explain why re-adding a range for every query is too slow, and what repeated work the prefix array removes.",
    "Build a prefix array with a leading `0` and answer any range sum with a single subtraction.",
    "Extend the idea to rectangles in a grid (2D) and to many range updates at once (the difference array).",
    "Turn “count subarrays with property X” into “find two prefix values that differ by k” using a dictionary.",
    "Decide when prefix sums do **not** apply: changing data, and operations that cannot be undone like max.",
  ],
  prereqNote: "You should be comfortable with list indexing (the first element is index `0`) and looping over a list with `for`.",
  sections: [
    {
      kind: "intuition", id: "odometer", title: "Your car's odometer already does this",
      paras: [
        "Suppose your odometer read 12,400 km when you left home and 12,465 km when you arrived. How long was the trip? You did not add up every kilometre: you subtracted **65 = 12,465 − 12,400**.",
        "The odometer keeps a running total from the day the car was built. Any trip between two moments is the difference of two readings. A prefix array is an odometer for your array: it stores the running total at every position, so the sum of any stretch is one subtraction.",
      ],
    },
    {
      kind: "naive", id: "naive", title: "Answer each query by adding the range",
      paras: [
        "You are given an array `a` and many questions of the form “what is the sum from index `l` to index `r`?”. The direct answer loops over the range every time.",
        "Look at what the loop wastes. The queries `[1, 3]` and `[0, 4]` overlap, yet each one re-adds `a[1] + a[2] + a[3]` from scratch. Nothing is remembered between queries, so the same additions are done again and again.",
      ],
      code: "def range_sum_naive(a, l, r):\n    total = 0\n    for i in range(l, r + 1):\n        total += a[i]\n    return total",
      cost: "O(n) per query, so O(n × q) overall. With n = q = 200,000 that is about 4 × 10^10 additions: far beyond the roughly 10^8 a program can do in a second.",
    },
    {
      kind: "observation", id: "observation", title: "A range sum is a difference of two sums that start at the front",
      paras: [
        "The sum of `a[l..r]` equals “everything from the start up to `r`” minus “everything from the start up to just before `l`”. Everything before `l` appears in both and cancels, exactly like the odometer.",
        "So store, once, the sum of the first `k` elements for every `k`. Call it `P[k]`, with `P[0] = 0` because the sum of zero elements is zero. Then: **sum(a[l..r]) = P[r + 1] − P[l]**.",
        "The leading `0` is not decoration. It lets `l = 0` work with no special case, because `P[0]` is simply 0.",
      ],
    },
    {
      kind: "viz", id: "viz-build", title: "Build P once, then query it",
      viz: "prefix-build-and-query",
      paras: [
        "Watch the first phase: each new `P[i+1]` is the previous `P[i]` plus one array element, so building costs one pass. Then watch the queries: the highlighted part of the array is the range, and the two coloured cells in `P` are the only two values used.",
      ],
    },
    {
      kind: "example", id: "example", title: "The same array, by hand",
      paras: ["Take `a = [2, 4, 1, 5, 3, 6]`. Here is `P`, aligned so that `P[k]` is the sum of the first `k` elements (note that `P` has one more entry than `a`)."],
      table: { head: ["k", "0", "1", "2", "3", "4", "5", "6"], rows: [["a[k-1]", "·", "2", "4", "1", "5", "3", "6"], ["P[k]", "0", "2", "6", "7", "12", "15", "21"]] },
      steps: [
        { title: "Sum of a[1..3]", body: "`P[3 + 1] − P[1] = P[4] − P[1] = 12 − 2 = 10`. Check by hand: 4 + 1 + 5 = 10." },
        { title: "Sum of a[0..4]", body: "`P[5] − P[0] = 15 − 0 = 15`. The leading zero makes the “from the start” case work with the same formula." },
        { title: "Sum of a[3..5]", body: "`P[6] − P[3] = 21 − 7 = 14`. Check: 5 + 3 + 6 = 14." },
      ],
    },
    {
      kind: "code", id: "code-1d", title: "Prefix sums in Python",
      paras: ["Plan first, then code. The plan has two functions: one pass to build, one subtraction to query."],
      pseudocode: "P = list of n + 1 zeros\nfor each index i from 0 to n - 1:\n    P[i + 1] = P[i] + a[i]\nto answer (l, r):  return P[r + 1] - P[l]",
      code: "def build_prefix(a):\n    P = [0] * (len(a) + 1)\n    for i, x in enumerate(a):\n        P[i + 1] = P[i] + x\n    return P\n\ndef range_sum(P, l, r):      # inclusive, 0-indexed\n    return P[r + 1] - P[l]\n\na = [2, 4, 1, 5, 3, 6]\nP = build_prefix(a)\nprint(range_sum(P, 1, 3))    # 10",
      walkthrough: [
        "`[0] * (len(a) + 1)` makes room for the leading zero, so `P[0]` is already 0 and `P` is one longer than `a`.",
        "Inside the loop, `P[i + 1] = P[i] + x` says: the sum of the first `i + 1` elements is the sum of the first `i` plus element `i`. This is the whole idea in one line.",
        "`range_sum` never loops. `r + 1` is because `P[r + 1]` includes element `r`; `l` is because `P[l]` stops just before element `l`.",
        "Python also has `itertools.accumulate`: `P = [0] + list(accumulate(a))` builds the same array. Write the loop by hand until it feels obvious, then use the shortcut.",
      ],
    },
    {
      kind: "concept", id: "variants", title: "The variants you will meet",
      paras: [
        "The idea has a few standard shapes. They differ only in what is stored and what the formula subtracts.",
      ],
      bullets: [
        "**Running sum:** you only need the current total, so you keep one variable instead of an array (for example “how many points so far”).",
        "**Inclusive vs exclusive prefix:** an inclusive array `S[i]` includes `a[i]`; an exclusive one excludes it. Our `P` is the exclusive form shifted by one, which is why it needs the leading `0`. Pick one convention per problem and stay with it.",
        "**2D prefix sum:** `P[i][j]` is the sum of the rectangle from the top-left corner to just before row `i`, column `j`. A rectangle query uses four lookups.",
        "**Difference array:** the reverse operation. Instead of summing a range cheaply, you *add to a range* cheaply, then rebuild the array with one prefix sum.",
      ],
    },
    {
      kind: "code", id: "code-2d", title: "Rectangle sums in a grid",
      paras: [
        "To build `P[i + 1][j + 1]`, add the cell to the block above and the block to the left. Those two blocks overlap in the block above-and-left, which got counted twice, so subtract it once. A query uses the same inclusion and exclusion: take the big rectangle, cut away the strip above and the strip to the left, and add back the corner that was cut twice.",
      ],
      code: "def build_2d(grid):\n    R, C = len(grid), len(grid[0])\n    P = [[0] * (C + 1) for _ in range(R + 1)]\n    for i in range(R):\n        for j in range(C):\n            P[i + 1][j + 1] = grid[i][j] + P[i][j + 1] + P[i + 1][j] - P[i][j]\n    return P\n\ndef rect_sum(P, r1, c1, r2, c2):   # inclusive corners, 0-indexed\n    return P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1]",
      walkthrough: [
        "The extra zero row and zero column are the 2D version of the leading zero: they make queries touching the top or left edge need no special case.",
        "In `build_2d`, `P[i][j + 1]` is the block above, `P[i + 1][j]` is the block to the left, and `- P[i][j]` removes the double-counted overlap.",
        "In `rect_sum`, `P[r1][c2 + 1]` is the strip above the rectangle and `P[r2 + 1][c1]` is the strip to its left. Both contain `P[r1][c1]`, so it is added back once.",
        "Cost: building is O(rows × cols); each query is four lookups, O(1).",
      ],
    },
    {
      kind: "code", id: "code-diff", title: "Many range updates: the difference array",
      paras: [
        "Now the opposite problem. You get many updates of the form “add `k` to every element from `l` to `r`”, and only at the end do you need the array. Doing each update with a loop is O(n) each again.",
        "Place a **+k** at position `l` and a **−k** at position `r + 1`. When you take the prefix sum of that difference array, the `+k` switches the boost on at `l` and the `−k` switches it off after `r`. Every update costs O(1), and one pass at the end applies them all.",
      ],
      code: "def apply_range_adds(n, updates):      # updates: (l, r, k), 0-indexed inclusive\n    diff = [0] * (n + 1)               # one spare slot for r + 1 == n\n    for l, r, k in updates:\n        diff[l] += k\n        diff[r + 1] -= k\n    result, running = [], 0\n    for i in range(n):\n        running += diff[i]\n        result.append(running)\n    return result\n\nprint(apply_range_adds(5, [(1, 3, 2), (2, 4, 1)]))   # [0, 2, 3, 3, 1]",
      walkthrough: [
        "`diff` has `n + 1` slots so that an update ending at the last element can still write to `r + 1` without an index error.",
        "The second loop is exactly the prefix-sum loop from before, applied to `diff` instead of `a`.",
        "Check the example: element 2 is covered by both updates (2 + 1 = 3); element 4 only by the second (1). That matches the output.",
        "This only works when all updates come before you read any values. If updates and reads are interleaved, you need a Fenwick tree or segment tree (see those lessons).",
      ],
    },
    {
      kind: "complexity", id: "complexity", title: "Why these costs",
      paras: ["The pattern is always the same: pay O(n) once to build, then every question is constant time."],
      rows: [
        { what: "Build the 1D prefix array", time: "O(n)", space: "O(n)", why: "One pass, one stored value per element (plus the leading zero)." },
        { what: "One range-sum query", time: "O(1)", space: "O(1)", why: "Two array reads and one subtraction, regardless of range length." },
        { what: "Naive, for comparison", time: "O(n) per query", space: "O(1)", why: "Loops over the range every time, so q queries cost O(n × q)." },
        { what: "2D build, then a rectangle query", time: "O(R·C) then O(1)", space: "O(R·C)", why: "Each cell is computed once from three neighbours; a query is four lookups." },
        { what: "Difference array with q updates", time: "O(n + q)", space: "O(n)", why: "Each update touches two cells; one final pass rebuilds the array." },
      ],
    },
    {
      kind: "edge", id: "edges", title: "Cases that trip people up",
      items: [
        { case: "`l = 0`", handle: "Works with no special case because `P[0] = 0`. If you skipped the leading zero you would need an `if`." },
        { case: "Single element (`l = r`)", handle: "`P[l + 1] − P[l]` is just `a[l]`. Good sanity test for your indexing." },
        { case: "Negative numbers", handle: "No problem. Prefix sums never assume values are positive (unlike the variable sliding window)." },
        { case: "1-indexed input", handle: "Many problems give `l` and `r` starting at 1. Convert once when you read them (`l -= 1; r -= 1`) instead of adjusting inside formulas." },
        { case: "Huge sums", handle: "Python integers do not overflow. In C++ or Java use a 64-bit type for `P`, since n × max(a) can exceed 2^31." },
        { case: "Empty array", handle: "`P = [0]` and no valid query exists. Make sure your build code does not index `a[0]`." },
      ],
    },
    {
      kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [
        { mistake: "Writing `P[r] − P[l]` for an inclusive range.", fix: "That drops `a[r]`. With the leading-zero convention it is `P[r + 1] − P[l]`. Test a one-element range to catch this." },
        { mistake: "Forgetting the leading zero, then special-casing `l = 0`.", fix: "Start `P` with 0. Fewer branches means fewer bugs." },
        { mistake: "Mixing 0-indexed arrays with 1-indexed queries.", fix: "Convert at input time, once. Never let two index conventions meet in a formula." },
        { mistake: "Rebuilding the prefix array inside the query loop.", fix: "Build before the loop. Building per query turns O(n + q) back into O(n × q)." },
        { mistake: "Using a prefix array when values change between queries.", fix: "Each change would invalidate O(n) entries. Use a Fenwick or segment tree instead." },
        { mistake: "In 2D, forgetting to add back the corner.", fix: "Two overlapping strips are subtracted, so the overlap must be added once. Draw the four rectangles if unsure." },
      ],
    },
    {
      kind: "recognize", id: "recognize", title: "How to spot a prefix-sum problem",
      paras: ["In a contest you will rarely see the words “prefix sum”. You will see a shape. Learn the shapes."],
      signals: [
        "Many queries of the form “sum (or count, or xor) of the elements between positions `l` and `r`” on data that does not change.",
        "“Count the subarrays whose sum equals `k`”. A subarray sum is `P[j] − P[i]`, so you are looking for two prefix values that differ by `k`.",
        "“Apply many range additions, then print the final array”. That is the difference array.",
        "A condition about a *balance*: equal numbers of 0s and 1s, or matching brackets. Map the items to +1/−1; a balanced stretch is one where the running total returns to an earlier value.",
        "Constraints around 2 × 10^5 for both the array and the number of queries, where O(n × q) cannot pass.",
      ],
      notThis: [
        "Elements are updated between queries (one update would force you to fix O(n) prefix values). Think Fenwick tree or segment tree.",
        "The query is maximum, minimum or gcd over a range. Those cannot be “subtracted out”, so prefix arrays do not work. Think sparse table or segment tree.",
      ],
    },
    {
      kind: "worked", id: "worked-k", title: "Count subarrays with sum exactly k",
      problem: "Given an array of integers (values may be negative) and a number `k`, count how many contiguous non-empty subarrays have sum exactly `k`.",
      approach: [
        "Naive idea: try every pair `(i, j)` and sum it, which is O(n²) or worse, too slow for n = 2 × 10^5.",
        "A subarray `a[i..j-1]` has sum `P[j] − P[i]`. We want that to equal `k`, so `P[i] = P[j] − k`.",
        "Scan left to right keeping the running prefix value. For each new prefix value, add how many *earlier* prefix values equal `running − k`.",
        "Keep a dictionary counting prefix values seen so far. Start it with `{0: 1}` for the empty prefix, so subarrays starting at index 0 are counted.",
      ],
      code: "from collections import defaultdict\n\ndef count_subarrays_with_sum(a, k):\n    seen = defaultdict(int)\n    seen[0] = 1                 # the empty prefix\n    running = count = 0\n    for x in a:\n        running += x\n        count += seen[running - k]\n        seen[running] += 1\n    return count\n\nprint(count_subarrays_with_sum([1, 2, 3, -3, 3], 3))   # 5",
      takeaway: "Prefix sums turn “this subarray has property X” into “two prefix values differ by k”, and a dictionary finds the partner in O(1). Total O(n) time and O(n) space, and it works with negative numbers where a sliding window would fail.",
    },
    {
      kind: "worked", id: "worked-pivot", title: "Find the pivot index",
      problem: "Find the leftmost index whose left-side sum equals its right-side sum (the element itself is excluded from both). Return -1 if there is none.",
      approach: [
        "For index `i`, the left sum is `P[i]` (everything before `i`).",
        "The right sum is `total − P[i + 1]` (everything after `i`).",
        "Test each `i` in O(1) and return the first match.",
      ],
      code: "def pivot_index(a):\n    P = [0]\n    for x in a:\n        P.append(P[-1] + x)\n    total = P[-1]\n    for i in range(len(a)):\n        if P[i] == total - P[i + 1]:\n            return i\n    return -1\n\nprint(pivot_index([1, 7, 3, 6, 5, 6]))   # 3",
      takeaway: "Whenever you catch yourself summing “everything to the left” and “everything to the right” for each position, you are recomputing prefix sums. Precompute them.",
    },
  ],
  cheatSheet: [
    { label: "Build (1D)", value: "P[0] = 0;  P[i+1] = P[i] + a[i]   →  O(n)" },
    { label: "Range sum a[l..r]", value: "P[r+1] − P[l]   →  O(1)" },
    { label: "Rectangle (2D)", value: "P[r2+1][c2+1] − P[r1][c2+1] − P[r2+1][c1] + P[r1][c1]" },
    { label: "Range add (difference array)", value: "diff[l] += k;  diff[r+1] −= k;  then prefix-sum diff" },
    { label: "Subarray sum = k", value: "count += seen[running − k]; seen[running] += 1" },
    { label: "Works for", value: "sum, count, xor (operations you can undo). Not max / min / gcd." },
  ],
  summary: [
    "A range sum is a difference of two prefix sums, so one precomputation makes every query O(1).",
    "Use `P` with a leading zero: `sum(a[l..r]) = P[r + 1] − P[l]`. Convert input to 0-indexed once.",
    "Reverse the trick for updates: +k at `l`, −k at `r + 1`, then one prefix sum rebuilds the array.",
    "Subarray-sum problems become “find two prefix values that differ by k”, solved with a dictionary.",
    "Prefix sums need an undoable operation and unchanging data; otherwise reach for a Fenwick or segment tree.",
  ],
  checks: [
    { kind: "trace", q: "For `a = [3, 1, 4, 1, 5]` the prefix array (with leading zero) is `[0, 3, 4, 8, 9, 14]`. What is the sum of `a[1..3]`?", options: ["5", "6", "8", "9"], answer: 1, why: "`P[4] − P[1] = 9 − 3 = 6`, and indeed 1 + 4 + 1 = 6. Using `P[3] − P[1]` would give 5 and drop `a[3]`." },
    { kind: "concept", q: "Why do we put a `0` at the front of the prefix array?", options: ["It makes the array sorted", "So a range starting at index 0 needs no special case", "Python requires it", "To make the sums positive"], answer: 1, why: "`P[0] = 0` represents the sum of nothing, so the formula `P[r + 1] − P[l]` also works when `l = 0`." },
    { kind: "recognize", q: "Which task is **not** a good fit for a plain prefix-sum array?", options: ["100,000 queries for the sum of `a[l..r]` on a fixed array", "Count subarrays whose sum is `k`", "Alternating “set `a[i] = x`” updates with range-sum queries", "Print the array after 100,000 range additions"], answer: 2, why: "Each update would invalidate up to O(n) prefix values. The other three are standard prefix-sum or difference-array uses. Interleaved updates call for a Fenwick or segment tree." },
    { kind: "complexity", q: "With n = q = 200,000, roughly how many basic steps do the naive and the prefix approaches take?", options: ["≈ 4 × 10^10 versus ≈ 4 × 10^5", "≈ 4 × 10^5 versus ≈ 4 × 10^10", "Both ≈ 4 × 10^5", "Both ≈ 4 × 10^10"], answer: 0, why: "Naive is n × q = 4 × 10^10. Prefix is n to build plus q to answer = 4 × 10^5. That gap is the whole point." },
    { kind: "trace", q: "With n = 5, updates add 2 to `[1, 3]` and add 1 to `[2, 4]`. After applying a difference array, what is the final array (all zeros at the start)?", options: ["[0, 2, 3, 3, 1]", "[0, 2, 3, 3, 3]", "[0, 2, 1, 0, -2]", "[2, 3, 3, 1, 0]"], answer: 0, why: "`diff` becomes [0, 2, 1, 0, -2, -1]. Its running total is 0, 2, 3, 3, 1. Element 4 is only covered by the second update, so it is 1." },
    { kind: "concept", q: "Which of these can be answered with prefix-style precomputation?", options: ["Range sum and range xor", "Range maximum", "Range minimum", "Range gcd"], answer: 0, why: "Sum and xor can be undone (subtract, or xor again), so two prefixes cancel the shared part. Max, min and gcd cannot be undone, so they need other structures." },
    { kind: "trace", q: "prefix = [0]; for x in [2, -1, 3]: prefix.append(prefix[-1] + x). What does `prefix[3] - prefix[1]` give?", options: ["2", "4", "-1", "5"], answer: 0, why: "P[r+1] - P[l] is the sum of elements l..r. Here indices 1 and 2 hold -1 and 3." },
    { kind: "trace", q: "How many subarrays of [1, 1, 1] have sum exactly 2?", options: ["2", "1", "3", "4"], answer: 0, why: "The windows at positions 0-1 and 1-2 each sum to 2; the whole array sums to 3." },
    { kind: "trace", q: "In nums = [1, 2, 3] with k = 3, how many contiguous subarrays sum to k?", options: ["2", "1", "3", "0"], answer: 0, why: "[1, 2] and [3] both sum to 3. A prefix-count hash map finds them in one pass." },
    { kind: "trace", q: "Using a prefix array P for [5, 5, 5], what is P[2]?", options: ["10", "5", "15", "0"], answer: 0, why: "P[0]=0, P[1]=5, P[2]=10: P[i] is the sum of the first i values." },
    { kind: "trace", q: "For nums = [1, -1, 1, -1], how many subarrays have sum 0?", options: ["4", "2", "3", "6"], answer: 0, why: "[1,-1] at 0-1, [-1,1] at 1-2, [1,-1] at 2-3, and [1,-1,1,-1] at 0-3 all sum to zero." },
    { kind: "concept", q: "Why does a prefix array need n + 1 entries, with P[0] = 0?", options: ["P[0] = 0 lets P[r+1] - P[l] cover ranges that start at index 0 with no special case", "Python lists must have a fixed length", "The total is stored twice", "It is only needed for two-dimensional arrays"], answer: 0, why: "With P[0] = 0, the same formula works for every range, including those starting at the first element." },
    { kind: "complexity", q: "After O(n) preprocessing, how long does one range-sum query take?", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], answer: 0, why: "A query is one subtraction of two stored values." },
    { kind: "concept", q: "Which formula gives the sum of a rectangle in a 2D prefix-sum table (1-indexed, P[r][c] = sum of the top-left block)?", options: ["P[r2][c2] - P[r1-1][c2] - P[r2][c1-1] + P[r1-1][c1-1]", "P[r2][c2] + P[r1][c1]", "P[r2][c2] - P[r1][c1]", "The sum of the four corner cells"], answer: 0, why: "Subtract the strips above and to the left, then add back the corner that was removed twice." },
    { kind: "concept", q: "Why are prefix sums built from a running total, rather than summing each range directly?", options: ["So each range query costs one subtraction instead of walking the whole range", "Because direct sums give wrong answers", "Running totals use less memory than the array itself", "Python cannot add numbers in a loop"], answer: 0, why: "A single precomputed pass turns many O(length) range sums into O(1) queries." },
  ],
  nextNote: "Next, **Two Pointers** shows how a sorted array or a monotonic property lets two indices replace nested loops.",
};
