import type { LessonV2 } from "../lesson-types";

const naive = String.raw`from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)

print(fib(500) > 10**100)   # True
try:
    fib(5000)
except RecursionError:
    print("recursion limit hit")   # recursion limit hit`;
const coins = String.raw`def min_coins(coins, amount):
    INF = float("inf")
    dp = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and dp[a - c] + 1 < dp[a]:
                dp[a] = dp[a - c] + 1
    return -1 if dp[amount] == INF else dp[amount]

print(min_coins([1, 5, 6], 10))   # 2
print(min_coins([1, 2, 5], 11))   # 3
print(min_coins([2], 3))   # -1
print(min_coins([1], 0))   # 0
print(min_coins([1, 2, 5], 10**4))   # 2000`;
const knap = String.raw`def knapsack(weights, values, cap):
    dp = [0] * (cap + 1)
    for wt, val in zip(weights, values):
        for c in range(cap, wt - 1, -1):        # downwards: each item is used at most once
            dp[c] = max(dp[c], dp[c - wt] + val)
    return dp[cap]

def unbounded(weights, values, cap):
    dp = [0] * (cap + 1)
    for wt, val in zip(weights, values):
        for c in range(wt, cap + 1):             # upwards: an item may be reused
            dp[c] = max(dp[c], dp[c - wt] + val)
    return dp[cap]

print(knapsack([1, 3, 4, 5], [1, 4, 5, 7], 7))   # 9
print(knapsack([5], [10], 4))   # 0
print(knapsack([2, 3], [3, 5], 7))   # 8
print(unbounded([2, 3], [3, 5], 7))   # 11`;
const seq = String.raw`from bisect import bisect_left

def lcs(s, t):
    n, m = len(s), len(t)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if s[i - 1] == t[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[n][m]

def edit_distance(a, b):
    n, m = len(a), len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return dp[n][m]

def lis(a):
    tails = []
    for x in a:
        i = bisect_left(tails, x)
        if i == len(tails):
            tails.append(x)
        else:
            tails[i] = x
    return len(tails)

print(lcs("ABCB", "BDCAB"))   # 3
print(edit_distance("kitten", "sitting"))   # 3
print(edit_distance("", "abc"))   # 3
print(lis([10, 9, 2, 5, 3, 7, 101, 18]))   # 4
print(lis([5, 4, 3, 2, 1]))   # 1`;
const roll = String.raw`def house_robber(a):
    prev, cur = 0, 0
    for x in a:
        prev, cur = cur, max(cur, prev + x)
    return cur

def paths_in_grid(grid):
    R, C = len(grid), len(grid[0])
    row = [0] * C
    row[0] = 1 if grid[0][0] == "." else 0
    for r in range(R):
        for c in range(C):
            if grid[r][c] == "#":
                row[c] = 0
            elif c > 0:
                row[c] += row[c - 1]
    return row[-1]

print(house_robber([2, 7, 9, 3, 1]))   # 12
print(house_robber([]))   # 0
print(paths_in_grid(["...", ".#.", "..."]))   # 2
print(paths_in_grid(["....", "....", "...."]))   # 10`;
const part = String.raw`def can_partition(nums):
    total = sum(nums)
    if total % 2:
        return False
    target = total // 2
    dp = [True] + [False] * target
    for x in nums:
        for s in range(target, x - 1, -1):
            dp[s] = dp[s] or dp[s - x]
    return dp[target]

print(can_partition([1, 5, 11, 5]))   # True
print(can_partition([1, 2, 3, 5]))   # False
print(can_partition([2]))   # False`;
const ways = String.raw`def coin_ways(coins, amount):
    dp = [1] + [0] * amount
    for c in coins:                          # coins outside: each combination counted once
        for a in range(c, amount + 1):
            dp[a] += dp[a - c]
    return dp[amount]

def coin_orderings(coins, amount):
    dp = [1] + [0] * amount
    for a in range(1, amount + 1):           # amounts outside: each ORDER counted separately
        for c in coins:
            if c <= a:
                dp[a] += dp[a - c]
    return dp[amount]

print(coin_ways([1, 2, 5], 5))   # 4
print(coin_ways([2], 3))   # 0
print(coin_ways([10], 10))   # 1
print(coin_orderings([1, 2], 3))   # 3`;

export const dpBottomUp: LessonV2 = {
  topic: "dp-bottom-up", depth: "complete", minutes: 55,
  hook: "Fill the DP table with plain loops, from the smallest cases upward: no recursion, no depth limit, and the easiest way to save memory.",
  objectives: [
    "Convert a top-down (memoized) solution into a bottom-up table, choosing a safe filling order.",
    "Write 1D tabulation for coin change and house-robber style problems, and count ways versus minimise.",
    "Solve 0/1 knapsack and explain why the capacity loop runs downwards (and upwards for unbounded).",
    "Fill 2D tables for LCS, edit distance and grid paths, and reduce memory by keeping only the rows you need.",
    "Recognise knapsack, subsequence and grid patterns, and choose between top-down and bottom-up.",
  ],
  prereqNote: "Top-Down DP is essential: you should know what a state, a transition and a base case are.",
  sections: [
    { kind: "intuition", id: "stairs", title: "Climbing the stairs from the bottom",
      paras: ["Top-down DP is like asking “what is the answer for step 100?” and letting that question trigger smaller questions. Bottom-up DP is like climbing from step 0: you know step 0, so compute step 1; you know steps 0 and 1, so compute step 2; and so on, until you reach the step you wanted.",
        "Nothing is ever asked twice and nothing is ever *waiting* on a deeper call. You only need to be sure that when you compute a step, the steps it depends on are already written down. That ordering is the whole craft."] },
    { kind: "naive", id: "naive", title: "Recursion that memoizes, but still recurses",
      paras: ["Memoization fixes the repeated work, as you saw. But the recursion itself is still there. Each unfinished call sits on the call stack, and Python allows only about 1,000 nested calls.",
        "So a memoized function that needs a state depth of 5,000 crashes, even though only 5,000 distinct states exist and the answer is easy to compute. The depth is a limit of the *method*, not the problem."],
      code: naive,
      cost: "Correct and O(n), but the stack depth equals the number of states, so a deep recursion raises RecursionError in Python." },
    { kind: "observation", id: "observation", title: "If you know the order, you do not need the recursion",
      paras: ["In every DP, each state depends on a few **smaller** states (smaller amount, fewer items, shorter prefix). That gives a natural order: fill states from smallest to largest, and every dependency is ready when you need it.",
        "So replace the recursive calls with a loop over states in that order, and the memo dictionary with an array (a **table**). The recurrence is identical; only the traversal changes: top-down discovers states on demand, bottom-up computes them all in a planned order."] },
    { kind: "concept", id: "recipe", title: "The tabulation recipe, and top-down versus bottom-up",
      paras: ["Use the same state and transition as in Top-Down DP, then add three decisions:"],
      bullets: ["**Table:** an array (1D) or list of lists (2D) with one cell per state, holding the answer for that state.", "**Base cells:** fill the cells whose answers are known without any transition (`dp[0] = 0`, first row, first column).", "**Order:** loop so that every cell is computed after the cells it reads. Usually increasing index; for some knapsack variants, decreasing (see below).", "**Answer cell:** usually the last cell (`dp[amount]`, `dp[n][m]`). Sometimes the best over all cells.", "**Space saving:** if a row only reads the previous row, keep two rows (or one), turning O(n·m) memory into O(m).", "**Top-down:** easier to write, computes only reachable states, but limited by recursion depth. **Bottom-up:** no recursion limit, usually faster, easy to optimise memory, but you must get the order right and it computes every state."] },
    { kind: "viz", id: "viz-knap", title: "Filling a knapsack table", viz: "knapsack-table",
      paras: ["Items have a weight `w` and a value `v`. Cell (i, c) holds the best value using the first i items with capacity c. Each cell either **skips** item i (copy the cell above) or **takes** it (its value plus the cell above-and-left by the item's weight). Yellow cells are the two it reads. Rows are filled top to bottom, so everything a cell needs already exists."] },
    { kind: "example", id: "example", title: "Coin change as a table",
      paras: ["Fewest coins to make 10 from coins 1, 5 and 6. Greedy (take the biggest first) gives 6 + 1 + 1 + 1 + 1 = 5 coins. The table finds better."],
      table: { head: ["amount", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], rows: [["fewest coins", "0", "1", "2", "3", "4", "1", "1", "2", "3", "4", "2"]] },
      steps: [{ title: "How the last cell is computed", body: "`dp[10]` tries each coin: coin 1 gives `dp[9] + 1 = 5`; coin 5 gives `dp[5] + 1 = 2`; coin 6 gives `dp[4] + 1 = 5`. The minimum is 2: five plus five." }, { title: "How an earlier cell is computed", body: "`dp[7]`: coin 1 gives `dp[6] + 1 = 2`; coin 5 gives `dp[2] + 1 = 3`; coin 6 gives `dp[1] + 1 = 2`. Minimum 2: six plus one." }, { title: "Why the order works", body: "Every cell reads cells with a smaller amount, so filling left to right means they are always ready." }] },
    { kind: "code", id: "code-coins", title: "1D tabulation: minimum coins",
      paras: ["The table has one cell per amount. Impossible amounts stay at infinity."],
      pseudocode: "dp[0] = 0; every other amount starts at infinity\nfor amount a from 1 to target:\n    for each coin c <= a:\n        dp[a] = min(dp[a], dp[a - c] + 1)\nanswer: dp[target], or -1 if still infinity",
      code: coins,
      walkthrough: ["The two loops are the whole algorithm: the outer one fixes the **order** (amounts upward) and the inner one is the **transition** (try every coin).", "`INF` marks “not reachable”. Since `dp[a - c] + 1` with infinity stays infinity, impossible states never win a minimum.", "Amount 0 is a legal input and needs 0 coins; a target of 10,000 is a plain loop with no recursion problem (2,000 coins of 5, since 5 is the largest coin here).", "Time is `amount × number of coins`; space is `amount + 1`."] },
    { kind: "code", id: "code-knap", title: "0/1 knapsack, one row, and the direction of the loop",
      paras: ["Choose items, each at most once, to maximise value without exceeding capacity. The 2D table in the animation needs a row per item, but each row only reads the row above, so one array is enough, **if the capacity loop runs downwards**."],
      code: knap,
      walkthrough: ["Going from high capacity to low means `dp[c - wt]` has **not yet been updated** for the current item, so it still describes the state *without* this item. Each item is therefore used at most once.", "Running the capacity loop **upwards** (the `unbounded` version) lets `dp[c - wt]` already include the current item, so it can be used again: that is the *unbounded knapsack*, where items may repeat.", "On weights 2 and 3 (values 3 and 5) with capacity 7: using each at most once gives 2 + 3 = 5 weight for value 8; reusing allows 3 + 2 + 2 = 7 weight for value 5 + 3 + 3 = 11.", "`knapsack([5], [10], 4)` is 0: the only item does not fit. Time `n × capacity`, space `capacity + 1`."] },
    { kind: "code", id: "code-seq", title: "2D tables: LCS, edit distance, and an LIS shortcut",
      paras: ["Two sequences give a natural 2D state: `dp[i][j]` for the first `i` characters of one and the first `j` of the other. The recurrence looks at the three neighbours up, left and diagonal, all of which are filled earlier in row-by-row order."],
      code: seq,
      walkthrough: ["**LCS:** matching characters extend the diagonal (`dp[i - 1][j - 1] + 1`); otherwise take the better of dropping a character from either string. This is exactly the table in the earlier LCS animation, now filled by loops.", "**Edit distance:** the first row and column are the cost of building a prefix from nothing (`i` insertions or deletions). Otherwise the cell is 0 extra on a match, or 1 plus the cheapest of delete, insert and replace. “kitten” → “sitting” needs 3 edits.", "**LIS (longest increasing subsequence):** the simple DP is `dp[i] = 1 + max(dp[j])` over earlier smaller values, O(n²). The version here keeps `tails[k]`, the smallest possible last value of an increasing subsequence of length `k + 1`, and uses binary search for O(n log n).", "All three fill cells in an order where every dependency is already computed."] },
    { kind: "code", id: "code-roll", title: "Saving memory by keeping only what you read",
      paras: ["If a cell depends only on the previous one or two cells, you do not need the whole table. Keep a couple of variables, or one row of a 2D table."],
      code: roll,
      walkthrough: ["`house_robber`: you cannot take two neighbouring houses. `cur` is the best total using houses so far, `prev` the best before the last house. `max(cur, prev + x)` skips this house or takes it and the best from two houses back. Two variables replace a whole array.", "`paths_in_grid` counts right-and-down paths avoiding walls. Each cell is the sum of the cell above (still in `row[c]`, from the previous row) and the cell to the left (`row[c - 1]`, already updated). One row of the table is enough.", "Space drops from O(R × C) to O(C), which matters when a table would be too large for memory.", "The price: once you overwrite a row you cannot recover older cells, so this only works when the recurrence never needs them again."] },
    { kind: "complexity", id: "complexity", title: "Time and space of a table",
      rows: [
        { what: "Coin change, minimum coins", time: "O(amount × coins)", space: "O(amount)", why: "One cell per amount; each tries every coin." },
        { what: "0/1 knapsack", time: "O(n × capacity)", space: "O(capacity) with one row", why: "n items, each updating every capacity once." },
        { what: "LCS / edit distance", time: "O(n × m)", space: "O(n × m), or O(m) with two rows", why: "One cell per pair of prefixes, O(1) work each." },
        { what: "LIS", time: "O(n²) simple, O(n log n) with tails", space: "O(n)", why: "n states each scanning earlier ones, or n binary searches." },
        { what: "Counting coin combinations", time: "O(amount × coins)", space: "O(amount)", why: "Same shape as minimum coins, but summing instead of minimising." },
        { what: "Knapsack when capacity is 10⁹", time: "infeasible as written", space: "-", why: "The table size depends on the numeric value of capacity, not on n: pseudo-polynomial." }],
      paras: ["As always, **time = (number of states) × (work per state)**. Space = number of cells kept.", "Knapsack-style time is **pseudo-polynomial**: it depends on the *value* of the capacity. That is fine for 10⁴ and impossible for 10⁹; then you need a different idea (for example, DP over value instead of weight, or meet-in-the-middle)."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Amount or capacity 0", handle: "Base case: 0 coins, value 0, one way (the empty selection). Make sure the loops handle it." }, { case: "Unreachable states", handle: "Use infinity (minimise) or 0 ways (count) and convert at the end, e.g. -1." }, { case: "Items heavier than the capacity", handle: "The loop `range(cap, wt - 1, -1)` is empty, so such items are skipped safely." }, { case: "Empty input", handle: "A table with one base cell: handle it explicitly (house robber on an empty list is 0)." }, { case: "Off-by-one in 1-indexed tables", handle: "In `dp[i][j]` the characters are `s[i - 1]` and `t[j - 1]`. Mixing the two conventions is the most common 2D DP bug." }, { case: "Very large tables", handle: "A 10⁴ × 10⁴ table has 10⁸ cells, too much memory in Python. Use rolling rows, or rethink the state." }, { case: "Order of the two loops in counting problems", handle: "Coins outside counts **combinations**; amounts outside counts **orderings** (see the worked problem)." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Looping capacity upwards in 0/1 knapsack with one row.", fix: "Go downwards so each item is used once; upwards turns it into unbounded knapsack." }, { mistake: "Filling cells in an order where a dependency is not ready.", fix: "Write down which cells each cell reads, then choose loops so they come earlier." }, { mistake: "Initialising every cell to 0 for a minimisation problem.", fix: "Unreachable states need infinity; 0 would claim they cost nothing." }, { mistake: "Mixing up combinations and permutations when counting.", fix: "Coins in the outer loop for combinations, amounts in the outer loop for ordered sequences." }, { mistake: "Reusing a rolling row after it was overwritten.", fix: "Only roll when the recurrence reads just the previous row (or two)." }, { mistake: "Forgetting the base row and column in 2D tables.", fix: "Fill them first: they are the empty-prefix answers." }] },
    { kind: "recognize", id: "recognize", title: "How to spot bottom-up DP problems",
      signals: ["**Knapsack shape:** choose items with a size and a benefit under a **capacity**, or reach an exact **sum** (subset sum, partition, coin problems).", "**Two sequences** compared prefix by prefix: longest common subsequence, edit distance, interleaving.", "**One sequence, best structure inside it:** longest increasing subsequence, maximum subarray, house-robber (“no two adjacent”).", "**Grid paths:** count or minimise paths moving only right and down, with obstacles or cell costs.", "The state is **small and numeric** (amount up to 10⁴, lengths up to 2,000), and each state depends on smaller ones.", "A recursive solution exists but **depth would exceed 1,000**, or you want to cut memory."],
      notThis: ["The state would need a huge number (capacity 10⁹): look for a different formulation.", "No overlapping subproblems and a provably greedy rule: use greedy.", "You must list the actual solutions: backtracking, not counting."] },
    { kind: "worked", id: "worked-partition", title: "Can the numbers be split into two equal halves?",
      problem: "Given a list of positive integers, decide whether it can be split into two groups with equal sums.",
      approach: ["If the total is odd, the answer is No. Otherwise we need a subset whose sum is exactly `total / 2`.", "That is **subset sum**, a knapsack with weight = value and exact-fit instead of maximise.", "Let `dp[s]` mean “some subset adds to exactly s”. For each number, update from high sums to low so each number is used once."],
      code: part,
      takeaway: "Many problems are knapsacks in disguise: here the “capacity” is half the total and the table holds booleans. The downward loop is again what guarantees each number is used at most once." },
    { kind: "worked", id: "worked-ways", title: "Count the ways to make an amount",
      problem: "Given coin values (each usable any number of times) and a target, count the **combinations** of coins that sum to the target. Order does not matter: 1 + 2 and 2 + 1 are the same combination.",
      approach: ["Let `dp[a]` be the number of ways to make `a`. `dp[0] = 1` (the empty combination).", "Process **one coin at a time** in the outer loop, and for each coin let `dp[a]` also include the ways that end by using that coin: `dp[a] += dp[a - c]`.", "Because coins are handled in a fixed order, each combination is built in only one order and is counted once. Swapping the loops (amounts outside) would count each order separately."],
      code: ways,
      takeaway: "The same table with the loops swapped answers a different question: `coin_orderings([1, 2], 3)` is 3 (1+1+1, 1+2, 2+1) while combinations of the same coins make only 2. Which loop is outermost *is* the problem statement." },
  ],
  cheatSheet: [{ label: "Tabulation", value: "table of states · base cells · loops in dependency order · answer cell" }, { label: "Min coins", value: "dp[a] = min(dp[a − c] + 1); unreachable = ∞" }, { label: "0/1 knapsack", value: "for each item: for c from cap down to wt: dp[c] = max(dp[c], dp[c − wt] + val)" }, { label: "Unbounded", value: "same, but c runs upward" }, { label: "Count combinations", value: "coins outside, amounts inside; dp[0] = 1" }, { label: "Rolling space", value: "keep only the rows the recurrence reads" }],
  summary: ["Bottom-up DP computes the same states as memoization, but with loops in a chosen order and a table instead of recursion.", "Write the same state, base case and transition, then choose a fill order so every dependency is ready.", "In 0/1 knapsack the capacity loop runs downwards so each item is used once; upwards allows reuse.", "2D tables handle two sequences (LCS, edit distance) and grids; rolling rows cut memory when only the previous row is read.", "Time is states × work per state; knapsack-style tables are pseudo-polynomial in the capacity."],
  checks: [
    { kind: "concept", q: "What is the main practical advantage of bottom-up DP over memoized recursion in Python?", options: ["It is always faster by a large factor", "It has no recursion-depth limit", "It needs no base case", "It never uses a table"], answer: 1, why: "Loops do not stack calls, so a state count of 10⁵ is fine, whereas recursion would hit the call-depth limit around 1,000." },
    { kind: "trace", q: "For coins [1, 5, 6], what is `dp[7]` (fewest coins for 7)?", options: ["1", "2", "3", "7"], answer: 1, why: "6 + 1 uses two coins: `dp[6] + 1 = 2`." },
    { kind: "concept", q: "In 0/1 knapsack with a single 1D array, why must the capacity loop run from high to low?", options: ["To make it faster", "So each item is used at most once: `dp[c - wt]` must still be the value without the current item", "To avoid negative indices", "It does not matter"], answer: 1, why: "Going upwards would let an item already placed be used again, turning it into unbounded knapsack." },
    { kind: "complexity", q: "What is the time complexity of 0/1 knapsack with n items and capacity W?", options: ["O(n + W)", "O(n × W)", "O(2ⁿ)", "O(W log n)"], answer: 1, why: "There are n × W states (item count by capacity), each updated in O(1)." },
    { kind: "recognize", q: "“Find the length of the longest common subsequence of two strings” is best solved with:", options: ["A 2D DP table over prefixes of both strings", "A heap", "Union-Find", "Binary search on the answer"], answer: 0, why: "The state is a pair of prefix lengths (i, j), and each cell depends on its up, left and diagonal neighbours." },
    { kind: "trace", q: "`coin_ways([1, 2], 3)` counts combinations (order ignored). What does it return?", options: ["1", "2", "3", "4"], answer: 1, why: "The combinations are 1 + 1 + 1 and 1 + 2; counting orderings would give 3 instead." },
    { kind: "trace", q: "0/1 knapsack: weights [1, 3, 4], values [15, 20, 30], capacity 4. What is the best value?", options: ["35", "30", "45", "50"], answer: 0, why: "Taking the items of weight 1 and 3 gives 15 + 20 = 35 within capacity 4." },
    { kind: "trace", q: "Length of the longest increasing subsequence of [10, 9, 2, 5, 3, 7, 101, 18]?", options: ["4", "3", "5", "6"], answer: 0, why: "For example 2, 3, 7, 18 is an increasing subsequence of length 4." },
    { kind: "trace", q: "Edit distance between 'kitten' and 'sitting' (insert, delete, replace each cost 1). What is printed?", options: ["3", "2", "4", "5"], answer: 0, why: "Replace k with s, replace e with i, and insert g." },
    { kind: "concept", q: "Why does a bottom-up table avoid recursion overhead?", options: ["It fills the table in dependency order with loops", "It uses no memory at all", "It removes the need for subproblems", "It works only on graphs"], answer: 0, why: "Loops replace recursive calls, so there is no call-stack cost." },
    { kind: "complexity", q: "0/1 knapsack with n items and capacity W, bottom-up: what is the time?", options: ["O(nW)", "O(2^n)", "O(n log W)", "O(W\u00b2)"], answer: 0, why: "Each item updates each capacity once." },
    { kind: "trace", q: "Subset sum: can [1, 5, 11, 5] be split into parts with sum 11 (a subset summing to 11 exists)?", options: ["True", "False", "It raises an error", "11"], answer: 0, why: "Take {11}, which sums to 11 on its own." },
    { kind: "trace", q: "Longest common subsequence of 'abcde' and 'ace'. What is printed?", options: ["3", "2", "4", "5"], answer: 0, why: "'ace' is a subsequence of both." },
    { kind: "trace", q: "Paths from the top-left to the bottom-right of a 3x3 grid moving only right or down. How many are there?", options: ["6", "3", "9", "12"], answer: 0, why: "Each cell's count is the sum of the cell above and the cell to the left: the last cell gets 6." },
    { kind: "concept", q: "When filling a bottom-up table, what order must you follow?", options: ["Every cell's dependencies are computed before the cell", "Any order works", "Reverse of the input order", "Largest value first"], answer: 0, why: "Each cell uses earlier cells, so those must already be filled." },
  ],
  nextNote: "Next, **Advanced DP** (bitmask, digit and tree DP) is planned: it builds on this table-filling idea with more complex states.",
};
