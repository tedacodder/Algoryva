import type { LessonV2 } from "../lesson-types";

const naive = String.raw`from itertools import permutations
from math import factorial

def assignment_bruteforce(cost):
    n = len(cost)
    return min(sum(cost[i][p[i]] for i in range(n)) for p in permutations(range(n)))

print(assignment_bruteforce([[9, 2, 7], [6, 4, 3], [5, 8, 1]]))   # 9
print(factorial(8), factorial(12), 12 * 2**12)   # 40320 479001600 49152`;
const bitmask = String.raw`from itertools import permutations
import random

INF = float("inf")

def min_assignment(cost):
    n = len(cost)
    dp = [INF] * (1 << n)
    dp[0] = 0
    for mask in range(1 << n):
        if dp[mask] == INF:
            continue
        k = bin(mask).count("1")                 # workers 0 .. k-1 already have tasks
        if k == n:
            continue
        for j in range(n):
            if not mask >> j & 1:                # task j is still free
                nxt = mask | (1 << j)
                dp[nxt] = min(dp[nxt], dp[mask] + cost[k][j])
    return dp[(1 << n) - 1]

def brute(cost):
    return min(sum(cost[i][p[i]] for i in range(len(cost))) for p in permutations(range(len(cost))))

C = [[9, 2, 7], [6, 4, 3], [5, 8, 1]]
print(min_assignment(C), brute(C))   # 9 9
print(min_assignment([[5]]))   # 5

random.seed(3)
ok = True
for _ in range(200):
    n = random.randint(1, 6)
    M = [[random.randint(1, 20) for _ in range(n)] for _ in range(n)]
    ok = ok and min_assignment(M) == brute(M)
print(ok)   # True`;
const digit = String.raw`from functools import lru_cache
import random

def count_digit_sum(N, S):
    digits = list(map(int, str(N)))

    @lru_cache(maxsize=None)
    def go(pos, remaining, tight):
        if remaining < 0:
            return 0
        if pos == len(digits):
            return 1 if remaining == 0 else 0
        limit = digits[pos] if tight else 9      # while tight, we may not exceed N's own digit
        return sum(go(pos + 1, remaining - d, tight and d == limit) for d in range(limit + 1))

    return go(0, S, True)

print(count_digit_sum(100, 1))   # 3
print(count_digit_sum(99, 9))   # 10
print(count_digit_sum(10**18, 1), count_digit_sum(10**18, 162))   # 19 1
print(count_digit_sum(0, 0))   # 1

random.seed(5)
ok = True
for _ in range(300):
    N, S = random.randint(0, 3000), random.randint(0, 30)
    ok = ok and count_digit_sum(N, S) == sum(1 for k in range(N + 1) if sum(map(int, str(k))) == S)
print(ok)   # True`;
const treeMis = String.raw`import random

def max_independent_weight(n, weights, edges, root=0):
    g = [[] for _ in range(n)]
    for a, b in edges:
        g[a].append(b)
        g[b].append(a)
    parent = [-1] * n
    order = []
    seen = [False] * n
    seen[root] = True
    stack = [root]
    while stack:                                  # iterative DFS: no recursion limit problems
        u = stack.pop()
        order.append(u)
        for v in g[u]:
            if not seen[v]:
                seen[v] = True
                parent[v] = u
                stack.append(v)
    take = list(weights)                          # take[u]: best in u's subtree if u IS chosen
    skip = [0] * n                                # skip[u]: best if u is NOT chosen
    for u in reversed(order):                     # every node after all of its children
        p = parent[u]
        if p != -1:
            take[p] += skip[u]
            skip[p] += max(take[u], skip[u])
    return max(take[root], skip[root])

def brute(n, w, edges):
    best = 0
    for mask in range(1 << n):
        if all(not (mask >> a & 1 and mask >> b & 1) for a, b in edges):
            best = max(best, sum(w[i] for i in range(n) if mask >> i & 1))
    return best

W = [3, 4, 5, 1, 3, 2, 7]
E = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (5, 6)]
print(max_independent_weight(7, W, E), brute(7, W, E))   # 16 16
print(max_independent_weight(1, [5], []))   # 5

random.seed(9)
ok = True
for _ in range(300):
    n = random.randint(1, 9)
    edges = [(random.randrange(i), i) for i in range(1, n)]
    w = [random.randint(1, 9) for _ in range(n)]
    ok = ok and max_independent_weight(n, w, edges) == brute(n, w, edges)
print(ok)   # True`;
const tsp = String.raw`from itertools import permutations
import random

INF = float("inf")

def shortest_tour(dist):
    n = len(dist)
    dp = [[INF] * n for _ in range(1 << n)]       # dp[mask][last]: visited the cities in mask, now at last
    dp[1][0] = 0                                  # start at city 0, having visited only city 0
    for mask in range(1 << n):
        for last in range(n):
            if dp[mask][last] == INF or not mask >> last & 1:
                continue
            for nxt in range(n):
                if not mask >> nxt & 1:
                    nm = mask | (1 << nxt)
                    dp[nm][nxt] = min(dp[nm][nxt], dp[mask][last] + dist[last][nxt])
    full = (1 << n) - 1
    return min(dp[full][last] + dist[last][0] for last in range(n))

def brute(d):
    n = len(d)
    if n == 1:
        return 0
    return min(d[0][p[0]] + sum(d[p[i]][p[i + 1]] for i in range(n - 2)) + d[p[-1]][0] for p in permutations(range(1, n)))

D = [[0, 10, 15, 20], [10, 0, 35, 25], [15, 35, 0, 30], [20, 25, 30, 0]]
print(shortest_tour(D), brute(D))   # 80 80
print(shortest_tour([[0]]))   # 0

random.seed(1)
ok = True
for _ in range(100):
    n = random.randint(1, 6)
    d = [[0 if i == j else random.randint(1, 20) for j in range(n)] for i in range(n)]
    ok = ok and shortest_tour(d) == brute(d)
print(ok)   # True`;
const adj = String.raw`from functools import lru_cache

def count_no_adjacent_equal(N):
    digits = list(map(int, str(N)))

    @lru_cache(maxsize=None)
    def go(pos, last, tight, started):
        if pos == len(digits):
            return 1 if started else 0            # the number 0 itself is not counted
        limit = digits[pos] if tight else 9
        total = 0
        for d in range(limit + 1):
            nt = tight and d == limit
            if not started and d == 0:
                total += go(pos + 1, -1, nt, False)   # still in the leading zeros
            elif d == last:
                continue                              # two equal neighbours: forbidden
            else:
                total += go(pos + 1, d, nt, True)
        return total

    return go(0, -1, True, False)

def brute(N):
    return sum(1 for k in range(1, N + 1) if all(a != b for a, b in zip(str(k), str(k)[1:])))

print(count_no_adjacent_equal(100), brute(100))   # 90 90
print(count_no_adjacent_equal(9), count_no_adjacent_equal(10**18) > 0)   # 9 True
print(all(count_no_adjacent_equal(n) == brute(n) for n in range(0, 2000, 7)))   # True`;
const diam = String.raw`import random
from collections import deque

def diameter(n, edges):
    g = [[] for _ in range(n)]
    for a, b in edges:
        g[a].append(b)
        g[b].append(a)
    parent = [-1] * n
    order = []
    seen = [False] * n
    seen[0] = True
    stack = [0]
    while stack:
        u = stack.pop()
        order.append(u)
        for v in g[u]:
            if not seen[v]:
                seen[v] = True
                parent[v] = u
                stack.append(v)
    down = [0] * n                                # down[u]: longest downward path from u, in edges
    best = 0
    for u in reversed(order):
        p = parent[u]
        if p != -1:
            best = max(best, down[p] + down[u] + 1)   # a path through p joining two child branches
            down[p] = max(down[p], down[u] + 1)
    return best

def brute(n, edges):
    g = [[] for _ in range(n)]
    for a, b in edges:
        g[a].append(b)
        g[b].append(a)
    best = 0
    for s in range(n):
        dist = {s: 0}
        q = deque([s])
        while q:
            u = q.popleft()
            for v in g[u]:
                if v not in dist:
                    dist[v] = dist[u] + 1
                    q.append(v)
        best = max(best, max(dist.values()))
    return best

print(diameter(4, [(0, 1), (1, 2), (2, 3)]))   # 3
print(diameter(5, [(0, 1), (0, 2), (0, 3), (0, 4)]))   # 2
print(diameter(1, []))   # 0

random.seed(2)
ok = True
for _ in range(300):
    n = random.randint(1, 12)
    edges = [(random.randrange(i), i) for i in range(1, n)]
    ok = ok and diameter(n, edges) == brute(n, edges)
print(ok)   # True`;

export const dpAdvanced: LessonV2 = {
  topic: "dp-advanced", depth: "complete", minutes: 75,
  hook: "When one number cannot describe where you are, let the DP state be a set of used items, a position inside a number, or a node in a tree.",
  objectives: [
    "Recognise when a DP state must be a subset (bitmask), a digit position with a tightness flag, or a tree node, and say which family a problem belongs to.",
    "Write bitmask DP for assignment and for the travelling-salesman problem, and state the limit on n.",
    "Write digit DP with the tight and started flags to count numbers up to a huge N that have a property.",
    "Write tree DP bottom-up with an iterative traversal, using a (take, skip) pair or a longest-downward-path value.",
    "Check every one of these against a brute force on small inputs.",
  ],
  prereqNote: "Bottom-Up DP (states, transitions, filling order) and Bit Manipulation (masks, `1 << j`, `mask >> j & 1`). Trees and DFS help for the tree part.",
  sections: [
    { kind: "intuition", id: "states", title: "What do you need to remember?",
      paras: ["A DP state is whatever the *future* of the problem depends on, and nothing more. In a coin problem it is one number: the amount left. But sometimes the future depends on **which of 12 workers' tasks are already taken**, or on **how far you are into the digits of a 18-digit number and whether you are still bounded by it**, or on **which node of a tree you are standing at**.",
        "Those three situations give three famous families: bitmask DP, digit DP and tree DP. The recipe is the same as before (state, transition, order, base case); only the shape of the state changes."] },
    { kind: "naive", id: "naive", title: "Try every ordering",
      paras: ["Suppose n workers must each get a different one of n tasks, and cost[i][j] is the price of giving task j to worker i. The brute force tries every assignment, which means every permutation of the tasks.",
        "For 3 workers there are 6 permutations, but for 8 workers 40,320, and for 12 workers 479,001,600. The factorial wipes out any hope beyond about n = 10. Notice how little of this work is necessary: once workers 0 to 4 have been given tasks, the *order* in which those tasks were handed out no longer matters. Only **which** tasks are gone."],
      code: naive,
      cost: "O(n! · n) time: 479 million assignments for n = 12." },
    { kind: "observation", id: "observation", title: "Only the set of used items matters, not how you got there",
      paras: ["Two different ways of giving workers 0 to 2 the tasks {1, 4, 5} leave exactly the same problem for workers 3 onward. So the state does not need the whole history: it only needs the **set of tasks used**, which can be stored in one integer (a bitmask). There are 2ⁿ such sets, far fewer than n! orders (4,096 against 479 million for n = 12).",
        "The same thinking gives the other two families. In a number, what matters for the digits still to be chosen is only the position, how much you still need (for example the remaining digit sum), and whether the digits so far equal N's prefix (the **tight** flag). In a tree, what matters for a node's best answer is only its own subtree: so compute subtrees bottom-up."] },
    { kind: "concept", id: "concept", title: "The three families",
      paras: ["Each family has a standard state, a typical limit, and a typical shape of transition."],
      bullets: ["**Bitmask DP:** `dp[mask]` (or `dp[mask][last]`) where bit i of `mask` says whether item i is used or visited. Typical use: assignment, travelling salesman, “cover all items”, subset partitions. Cost: about 2ⁿ · n (or 2ⁿ · n²) steps, so **n up to about 20**, or 15 to 16 with a second index.", "**Digit DP:** count numbers in [0, N] with a digit property, for N up to 10¹⁸ or beyond. State `(position, extra info, tight)` where `tight` means “the digits chosen so far equal N's prefix, so the next digit is limited by N's digit”. Add a `started` flag if leading zeros must not count. Cost: digits × states of the extra info × 10.", "**Tree DP:** compute for every node a value (or a small tuple) from its children's values, in post-order. Typical states: `(take, skip)` for a node chosen or not, longest downward path, subtree size, counts of colourings. Cost: O(n) when each node does O(its children) work.", "**The recipe is unchanged:** define what `dp[state]` means in one sentence, list the base states, write the transition, and choose an order in which every state is computed after the states it reads. Then **check against a brute force on small inputs**, which is especially valuable here because the states are easy to get subtly wrong.", "**Which family?** A subset of at most about 20 items → bitmask. “Count numbers up to N with a property of their digits” → digit DP. Input is a tree and answers combine from children → tree DP."] },
    { kind: "viz", id: "viz-bitmask", title: "Bitmask DP: giving 3 workers 3 tasks", viz: "bitmask-assign",
      paras: ["The top row is `dp[mask]` for masks 0 to 7. The second row writes each mask in binary (a 1 means that task is used); the third counts the workers already assigned. Each step takes a mask, lets the next worker try each free task, and relaxes the bigger mask. See how masks are visited in increasing order, which guarantees every mask is final before it is used: adding a bit always makes the number larger."] },
    { kind: "viz", id: "viz-tree", title: "Tree DP: the best set of non-adjacent nodes", viz: "tree-dp",
      paras: ["Each node shows its weight, and below it a pair take/skip once it has been computed: the best total inside its subtree if the node is chosen or not chosen. Nodes are processed children first (D, E, B, G, F, C, A), so a node's pair is built from its children's finished pairs. Follow node F: it has one child G, so take(F) uses skip(G) and skip(F) uses the better of G's two options."] },
    { kind: "example", id: "example", title: "The tree DP by hand",
      paras: ["Weights A 3, B 4, C 5, D 1, E 3, F 2, G 7. A has children B and C; B has children D and E; C has child F; F has child G. “take” means the node is chosen; “skip” means it is not."],
      table: { head: ["node", "children", "take", "skip", "reasoning"], rows: [["D", "none", "1", "0", "a leaf"], ["E", "none", "3", "0", "a leaf"], ["B", "D, E", "4", "4", "take: 4 + 0 + 0; skip: max(1, 0) + max(3, 0) = 4"], ["G", "none", "7", "0", "a leaf"], ["F", "G", "2", "7", "take: 2 + skip(G) = 2; skip: max(7, 0) = 7"], ["C", "F", "12", "7", "take: 5 + skip(F) = 12; skip: max(2, 7) = 7"], ["A", "B, C", "14", "16", "take: 3 + 4 + 7 = 14; skip: max(4, 4) + max(12, 7) = 16"]] },
      steps: [{ title: "The answer", body: "max(take(A), skip(A)) = max(14, 16) = 16, achieved for example by choosing B, C and G (4 + 5 + 7)." }, { title: "Why only two numbers per node", body: "A parent cares about a child in just two ways: the child is chosen (so the parent cannot be) or it is not. Everything else inside the child's subtree is already optimised." }] },
    { kind: "code", id: "code-bitmask", title: "Bitmask DP: the minimum-cost assignment",
      paras: ["Process masks in increasing order. For a mask with k bits set, workers 0 to k − 1 are done, so the next worker is number k, and it tries every free task."],
      pseudocode: "dp[0] = 0; every other mask starts at infinity\nfor mask in increasing order:\n    k = number of 1 bits in mask          (the next worker)\n    for each task j not in mask:\n        dp[mask | 1<<j] = min(dp[mask | 1<<j], dp[mask] + cost[k][j])\nanswer: dp[all ones]",
      code: bitmask,
      walkthrough: ["`k = bin(mask).count(\"1\")` is the number of workers already assigned, so there is no separate worker index in the state: the mask alone says whose turn it is.", "`mask >> j & 1` tests whether task j is used, and `mask | (1 << j)` adds it. This is the bit toolkit from the Bit Manipulation lesson doing real work.", "Every transition goes from a mask to a **larger** one, so looping `mask` upward visits each state after all the states that feed it.", "The code is checked against the permutation brute force on 200 random matrices up to 6 × 6 (True). The answer for the sample matrix is 9, and the full dp array matches the animation: `[0, 9, 2, 8, 7, 12, 5, 9]`."] },
    { kind: "code", id: "code-digit", title: "Digit DP: counting numbers by digit sum",
      paras: ["How many integers from 0 to N have digit sum S, for N as large as 10¹⁸? Looping is out of the question. Instead build the number one digit at a time, from the most significant digit, remembering the position, how much sum is still needed, and whether we are still **tight** against N."],
      code: digit,
      walkthrough: ["`tight` is True while every digit chosen so far equals the matching digit of N. While tight the next digit cannot exceed N's digit (`limit`); once we choose a smaller digit, the number is already below N and any digit 0 to 9 is allowed from then on.", "`remaining` is how much digit sum is still needed. A negative value can never recover, so return 0 immediately; at the end exactly 0 must remain.", "Leading zeros need no special treatment here because a zero adds nothing to the digit sum: numbers shorter than N are simply counted with leading zeros.", "Results: 3 numbers up to 100 have digit sum 1 (1, 10, 100); 10 numbers up to 99 have digit sum 9; for N = 10¹⁸ there are 19 with sum 1 (the powers of ten) and exactly 1 with sum 162 (eighteen nines). The brute-force comparison on 300 random cases prints True.", "There are only about 19 positions × 163 sums × 2 tight values states, so the work is tiny even though N is huge."] },
    { kind: "code", id: "code-tree", title: "Tree DP, with an iterative traversal",
      paras: ["For the non-adjacent-nodes problem each node stores `take` and `skip`. To handle deep trees without hitting Python's recursion limit, find a parent for every node with an iterative DFS and then process nodes in reverse order of discovery, which puts every child before its parent."],
      code: treeMis,
      walkthrough: ["`order` lists nodes so that each node appears **after** its parent. Reversing it processes children first. This replaces a recursive post-order walk.", "When a child `u` is finished, it is folded into its parent: `take[p] += skip[u]` (if the parent is chosen, the child cannot be) and `skip[p] += max(take[u], skip[u])` (if the parent is not chosen, the child may do either).", "`take` starts as the node's own weight and `skip` as 0, so a leaf is already correct.", "The sample tree gives 16, matching the animation. The brute force tries all subsets for 300 random trees up to 9 nodes and agrees on all of them."] },
    { kind: "complexity", id: "complexity", title: "Costs",
      rows: [
        { what: "Brute-force assignment (permutations)", time: "O(n! · n)", space: "O(n)", why: "Tries every ordering of the tasks." },
        { what: "Bitmask DP for assignment", time: "O(2ⁿ · n)", space: "O(2ⁿ)", why: "2ⁿ masks, each trying up to n free tasks." },
        { what: "Bitmask DP for travelling salesman", time: "O(2ⁿ · n²)", space: "O(2ⁿ · n)", why: "2ⁿ · n states `(mask, last)`, each trying up to n next cities. Practical to n ≈ 15 to 16 in Python, 20 to 22 in C++." },
        { what: "Digit DP", time: "O(d · S · 10)", space: "O(d · S)", why: "d digit positions, S values of the extra state, 10 digit choices each (times 2 for the tight flag)." },
        { what: "Tree DP", time: "O(n)", space: "O(n)", why: "Every node is folded into its parent once." },
        { what: "Brute force on trees (all subsets)", time: "O(2ⁿ · n)", space: "O(n)", why: "Only usable to check small cases." }],
      paras: ["As always, time is (number of states) × (work per state). What makes these “advanced” is only that the number of states is cleverly small: 2ⁿ instead of n!, a few thousand instead of 10¹⁸, n instead of 2ⁿ."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "n = 1 in bitmask DP", handle: "Works: one mask transition. For TSP, `dp[1][0] = 0` and the tour of one city has length 0; test it." }, { case: "Large n for bitmask DP", handle: "2²⁰ is a million masks; 2²⁵ is 33 million and usually too slow or too big. If n is above about 20, the problem needs another idea." }, { case: "Unreachable masks", handle: "Skip masks whose dp is infinity so you do not add to infinity or read an undefined state." }, { case: "N = 0 in digit DP", handle: "The only number is 0. Decide whether 0 counts (digit sum 0: yes; “positive numbers only”: no) and encode it, for example with a `started` flag." }, { case: "Leading zeros", handle: "They matter when the property depends on neighbours or counts of a digit (a leading 0 is not a real digit). Use a `started` flag; for digit sums they are harmless." }, { case: "Forgetting the tight flag", handle: "Without it you count numbers above N. Pass `tight and d == limit` into the next call." }, { case: "Deep trees", handle: "A path-shaped tree of 10⁵ nodes breaks recursive DFS in Python. Use the iterative order shown." }, { case: "Disconnected input that is not a tree", handle: "Tree DP assumes one connected tree. For a forest, run it from each unvisited root and combine." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Using a bitmask DP with n around 30.", fix: "2³⁰ is a billion states. Check n first: this technique lives at n ≤ 20." }, { mistake: "Computing masks in the wrong order.", fix: "Transitions that add bits must go from smaller to larger masks, so loop upward." }, { mistake: "Dropping the tight flag, or setting it wrongly for the next position.", fix: "The next call is tight only if the current one was tight **and** the chosen digit equals the limit." }, { mistake: "Forgetting `started` when leading zeros would count as digits.", fix: "Add a flag, and treat the zeros before the first non-zero digit as “not started”." }, { mistake: "Recursing over a large tree in Python.", fix: "Build a traversal order iteratively and process it in reverse." }, { mistake: "Trusting the DP without a brute-force check.", fix: "These states are easy to get subtly wrong. Compare against brute force on small inputs, as every snippet here does." }] },
    { kind: "recognize", id: "recognize", title: "How to spot which advanced DP to use",
      signals: ["**Bitmask:** “assign / match / visit / cover **every** one of n ≤ 20 items exactly once” (assignment, travelling salesman, Hamiltonian paths, set partitions), and the future depends on which items are already used.", "**Digit:** “count the integers from 1 to N (N up to 10¹⁸) whose digits satisfy …” (digit sum, no two equal neighbours, contains a digit, divisible by k), or “count in a range [L, R]” as `f(R) − f(L − 1)`.", "**Tree:** the input is a **tree** and you must choose nodes or edges, colour, count paths, or find a diameter, and the answer for a node follows from its children.", "A brute force exists whose state obviously includes a subset, a number's prefix, or a subtree.", "Constraints: n ≤ 20 or so (bitmask), numbers up to 10¹⁸ (digit), tree sizes up to 2 × 10⁵ (tree)."],
      notThis: ["n is large and the structure is a general graph with no small separator: bitmask and tree DP do not apply.", "A greedy rule is provably correct (try to break it first).", "You need the actual optimal assignment as well as its cost: store parents (the choices made) and walk back, as in the Shortest Paths lesson."] },
    { kind: "worked", id: "worked-tsp", title: "The shortest tour through every city",
      problem: "There are n cities with a table of distances. Starting at city 0, visit every other city exactly once and return to city 0, with the smallest total distance.",
      approach: ["The future of a partial tour depends on the **set of cities visited** and the **city you are at now**, not on the order you took.", "State `dp[mask][last]`: the shortest way to start at city 0, visit exactly the cities in `mask`, and end at `last`. Base: `dp[1][0] = 0` (only city 0 visited).", "Transition: from `(mask, last)` go to any unvisited city `nxt`, adding `dist[last][nxt]`, giving state `(mask | 1 << nxt, nxt)`.", "Answer: over all `last`, the best `dp[full][last] + dist[last][0]` (return home)."],
      code: tsp,
      takeaway: "Brute force tries (n − 1)! tours; this DP does 2ⁿ · n² steps: for n = 15 that is about 7 million instead of 87 billion. The extra index `last` is what lets the next step know where it is standing. The sample's best tour costs 80, confirmed by brute force on 100 random cases." },
    { kind: "worked", id: "worked-adjacent", title: "Count numbers with no two equal neighbouring digits",
      problem: "Count the integers from 1 to N (N up to 10¹⁸) in which no two adjacent digits are equal. For example 11 and 100 are excluded, 101 is allowed.",
      approach: ["Build the number digit by digit from the left. The future depends on the **position**, the **previous digit** (to avoid repeating it), whether we are **tight** against N, and whether the number has **started** (leading zeros are not digits, so `001` is just `1`).", "While not started, choosing 0 keeps us in the leading zeros without setting a previous digit.", "Once started, a digit equal to the previous one is forbidden.", "At the end count the number only if it started (this excludes 0)."],
      code: adj,
      takeaway: "Between 1 and 100 the answer is 90: the nine numbers 11, 22, …, 99 and the number 100 are excluded. The `started` flag is why 5 and 50 are counted correctly even though 05 has a leading zero. For N up to 10¹⁸ the DP has at most 19 × 11 × 2 × 2 = 836 states." },
    { kind: "worked", id: "worked-diameter", title: "The longest path in a tree",
      problem: "Given a tree with n nodes, find its diameter: the largest number of edges on a path between any two nodes.",
      approach: ["Let `down[u]` be the length of the longest path going **down** from `u` into its subtree.", "A path whose highest point is `u` joins the two longest downward branches below `u`. When a child `c` of `u` is folded in, the best path through `u` using this branch and an earlier branch has length `down[u] + down[c] + 1`.", "Then update `down[u] = max(down[u], down[c] + 1)`. The diameter is the largest value seen.", "Process children before parents with the same iterative order as before."],
      code: diam,
      takeaway: "A diameter is a tree DP in disguise: every path has a unique highest node, so trying each node as the top covers every path. The check compares against running a breadth-first search from every node on 300 random trees. (A famous alternative uses two BFS passes; the DP version generalises to weighted trees and counting problems.)" },
  ],
  cheatSheet: [{ label: "Bitmask DP", value: "dp[mask] over subsets; loop masks upward; n ≤ ~20; O(2ⁿ·n) or O(2ⁿ·n²)" }, { label: "Bit toolkit", value: "mask >> j & 1 (test) · mask | 1 << j (add) · bin(mask).count('1') (size)" }, { label: "Digit DP", value: "state (pos, extra, tight[, started]); tight and d == limit; f(R) − f(L − 1)" }, { label: "Tree DP", value: "iterative order, then reversed: fold each child into its parent" }, { label: "Typical pairs", value: "take/skip for non-adjacent nodes; down[u] for longest paths" }, { label: "Always", value: "write the brute force and compare on small inputs" }],
  summary: ["A DP state is whatever the future depends on: sometimes a set, a position inside a number, or a node of a tree.", "Bitmask DP stores which items are used in an integer: 2ⁿ states instead of n! orders, so n up to about 20.", "Digit DP counts numbers up to a huge N with `(position, extra info, tight)` states, adding `started` when leading zeros matter.", "Tree DP builds each node's answer from its children's, bottom-up, in O(n); do the traversal iteratively in Python.", "These states are easy to get subtly wrong, so verify each DP against a brute force on small inputs."],
  checks: [
    { kind: "complexity", q: "Why is bitmask DP for assignment far faster than trying every permutation?", options: ["It uses a faster language", "Only the set of used tasks matters for the future, and there are 2ⁿ sets against n! orderings", "It skips expensive workers", "It sorts the costs first"], answer: 1, why: "Different orders of using the same tasks lead to the same remaining problem, so they can share one state." },
    { kind: "trace", q: "For the lesson's 3×3 cost matrix, what is the minimum total assignment cost?", options: ["6", "9", "14", "16"], answer: 1, why: "Worker 0 takes task 1 (cost 2), worker 1 takes task 0 (cost 6), worker 2 takes task 2 (cost 1): 9." },
    { kind: "concept", q: "In digit DP, what does the tight flag mean?", options: ["The number is as small as possible", "The digits chosen so far equal the prefix of N, so the next digit cannot exceed N's digit", "The digit sum is exact", "Leading zeros are not allowed"], answer: 1, why: "While tight we are still bounded by N. Choosing a smaller digit releases the bound, so any digit is allowed afterwards." },
    { kind: "trace", q: "How many integers from 0 to 99 have digit sum 9?", options: ["9", "10", "11", "18"], answer: 1, why: "9, 18, 27, 36, 45, 54, 63, 72, 81, 90: ten numbers." },
    { kind: "recognize", q: "“Visit every one of 15 cities exactly once and return, minimising distance” suggests:", options: ["Dijkstra", "Bitmask DP over visited cities (dp[mask][last])", "A segment tree", "Binary search"], answer: 1, why: "A small number of items that must all be used once, where the future depends on which are used and where you are, is the bitmask-DP pattern." },
    { kind: "concept", q: "In the non-adjacent-nodes tree DP, why does take(parent) use skip(child) rather than max(take, skip)?", options: ["It is faster", "If the parent is chosen, a child that is adjacent to it cannot be chosen", "Children are always skipped", "The tree is a path"], answer: 1, why: "Choosing a node forbids choosing its neighbours, so the children can only contribute their skip value." },
    { kind: "trace", q: "Bitmask enumeration over a = [1, 2, 3, 4]: how many subsets sum to exactly 5?", options: ["2", "1", "3", "4"], answer: 0, why: "The subsets {1, 4} and {2, 3} both sum to 5." },
    { kind: "trace", q: "Digit-style counting: how many whole numbers from 0 to 20 have digits that sum to 3?", options: ["2", "1", "3", "4"], answer: 0, why: "Only 3 and 12 qualify." },
    { kind: "trace", q: "Tree-style maximum independent set on the path 1-2-3 (no two adjacent nodes chosen). What is the largest size?", options: ["2", "1", "3", "0"], answer: 0, why: "Choosing nodes 1 and 3 gives 2; all three would include adjacent nodes." },
    { kind: "concept", q: "In a bitmask DP, what does a state (a bitmask) represent?", options: ["The set of items already used, one bit per item", "A single number", "A string of characters", "A graph's adjacency matrix"], answer: 0, why: "Bit i set means item i is in the set." },
    { kind: "complexity", q: "What is the running time of the Held-Karp bitmask DP for the travelling salesman problem on n cities?", options: ["O(2^n \u00b7 n\u00b2)", "O(n!)", "O(n\u00b2)", "O(n log n)"], answer: 0, why: "There are 2^n subsets and n end cities, with n transitions each." },
    { kind: "concept", q: "In tree DP, what is computed for each node?", options: ["The best answer for its subtree, combined from its children's answers", "The depth of the whole tree only", "The sum of all leaves only", "The diameter only"], answer: 0, why: "Each node's value depends only on its children, so a post-order pass works." },
    { kind: "trace", q: "No two chosen values may be adjacent in [3, 2, 7, 10]. What is the largest sum?", options: ["13", "12", "10", "17"], answer: 0, why: "Choosing 3 and 10 gives 13; choosing 7 and 10 is not allowed since they are adjacent." },
    { kind: "concept", q: "Why is bitmask DP limited to small n?", options: ["The number of states is 2^n, which grows too fast", "Bits can hold only eight values", "Python integers are too small", "Masks need sorting"], answer: 0, why: "Each extra item doubles the number of states." },
    { kind: "trace", q: "How many binary strings of length 3 contain no two consecutive 1s?", options: ["5", "4", "6", "3"], answer: 0, why: "The valid strings are 000, 001, 010, 100 and 101." },
  ],
  nextNote: "Two planned topics remain on the technique side: **Computational Geometry** and the contest-skills topics (**Contest Strategy**, **Upsolving**).",
};
