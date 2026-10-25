import type { LessonV2 } from "../lesson-types";

const naive = String.raw`from itertools import product

def queens_bruteforce(n):
    count = 0
    for cols in product(range(n), repeat=n):       # a column for every row: n ** n placements
        ok = all(cols[i] != cols[j] and abs(cols[i] - cols[j]) != j - i
                 for i in range(n) for j in range(i + 1, n))
        if ok:
            count += 1
    return count

print(queens_bruteforce(4))   # 2
print(queens_bruteforce(5))   # 10`;
const subsets = String.raw`def subsets(nums):
    res, path = [], []

    def go(i):
        if i == len(nums):
            res.append(path[:])
            return
        go(i + 1)                  # choice 1: skip nums[i]
        path.append(nums[i])       # choice 2: take nums[i]
        go(i + 1)
        path.pop()                 # undo the choice

    go(0)
    return res

print(subsets([1, 2, 3]))   # [[], [3], [2], [2, 3], [1], [1, 3], [1, 2], [1, 2, 3]]
print(len(subsets(list(range(10)))))   # 1024`;
const combos = String.raw`def combine(n, k):
    res, path = [], []

    def go(start):
        if len(path) == k:
            res.append(path[:])
            return
        for x in range(start, n + 1):
            path.append(x)
            go(x + 1)
            path.pop()

    go(1)
    return res

def combine_pruned(n, k):
    res, path = [], []

    def go(start):
        if len(path) == k:
            res.append(path[:])
            return
        need = k - len(path)
        for x in range(start, n - need + 2):     # not enough numbers left beyond this point
            path.append(x)
            go(x + 1)
            path.pop()

    go(1)
    return res

print(combine(4, 2))   # [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]
print(combine(6, 3) == combine_pruned(6, 3))   # True
print(len(combine(10, 5)))   # 252`;
const perms = String.raw`def permutations(nums):
    res, path = [], []
    used = [False] * len(nums)

    def go():
        if len(path) == len(nums):
            res.append(path[:])
            return
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True
            path.append(nums[i])
            go()
            path.pop()
            used[i] = False

    go()
    return res

print(permutations([1, 2, 3]))   # [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]
print(len(permutations([1, 2, 3, 4])))   # 24`;
const csum = String.raw`def combination_sum(cands, target):
    cands = sorted(cands)
    res, path = [], []

    def go(start, remain):
        if remain == 0:
            res.append(path[:])
            return
        for i in range(start, len(cands)):
            if cands[i] > remain:
                break                            # sorted, so every later candidate is too big as well
            path.append(cands[i])
            go(i, remain - cands[i])             # i, not i + 1: a number may be reused
            path.pop()

    go(0, target)
    return res

print(combination_sum([2, 3, 6, 7], 7))   # [[2, 2, 3], [7]]
print(combination_sum([2, 3, 5], 8))   # [[2, 2, 2, 2], [2, 3, 3], [3, 5]]
print(combination_sum([2], 1))   # []

def subsets_with_dup(nums):
    nums = sorted(nums)
    res, path = [], []

    def go(start):
        res.append(path[:])
        for i in range(start, len(nums)):
            if i > start and nums[i] == nums[i - 1]:
                continue                         # skip a repeated value at the same position
            path.append(nums[i])
            go(i + 1)
            path.pop()

    go(0)
    return res

print(subsets_with_dup([1, 2, 2]))   # [[], [1], [1, 2], [1, 2, 2], [2], [2, 2]]`;
const queens = String.raw`def count_queens(n):
    cols, diag1, diag2 = set(), set(), set()
    count = 0

    def go(r):
        nonlocal count
        if r == n:
            count += 1
            return
        for c in range(n):
            if c in cols or r - c in diag1 or r + c in diag2:
                continue                          # attacked: prune this whole branch
            cols.add(c)
            diag1.add(r - c)
            diag2.add(r + c)
            go(r + 1)
            cols.remove(c)
            diag1.remove(r - c)
            diag2.remove(r + c)

    go(0)
    return count

print(count_queens(4), count_queens(6), count_queens(8))   # 2 4 92`;
const bst = String.raw`class Node:
    def __init__(self, val, left=None, right=None):
        self.val, self.left, self.right = val, left, right

def build(a, lo=0, hi=None):
    if hi is None:
        hi = len(a)
    if lo >= hi:
        return None
    mid = (lo + hi) // 2
    return Node(a[mid], build(a, lo, mid), build(a, mid + 1, hi))

def inorder(n):
    return [] if n is None else inorder(n.left) + [n.val] + inorder(n.right)

def height(n):
    return 0 if n is None else 1 + max(height(n.left), height(n.right))

root = build([1, 2, 3, 4, 5, 6, 7])
print(root.val, root.left.val, root.right.val)   # 4 2 6
print(inorder(root))   # [1, 2, 3, 4, 5, 6, 7]
print(height(root), height(build(list(range(1, 1001)))))   # 3 10`;
const kth = String.raw`def find_kth_bit(n, k):
    if n == 1:
        return "0"
    length = (1 << n) - 1
    mid = (length + 1) // 2
    if k == mid:
        return "1"
    if k < mid:
        return find_kth_bit(n - 1, k)
    mirrored = find_kth_bit(n - 1, length - k + 1)
    return "0" if mirrored == "1" else "1"

print(find_kth_bit(3, 1))   # 0
print(find_kth_bit(4, 11))   # 1
print("".join(find_kth_bit(4, k) for k in range(1, 16)))   # 011100110110001`;

export const recursion2: LessonV2 = {
  topic: "recursion-2", depth: "complete", minutes: 50,
  hook: "Two powerful uses of recursion: exploring every choice while undoing mistakes (backtracking), and splitting a problem into independent halves (divide and conquer).",
  objectives: [
    "Write the backtracking template: choose, explore, un-choose, with a clear base case.",
    "Generate subsets, combinations and permutations, and handle duplicates and reuse correctly.",
    "Prune the search tree so hopeless branches are abandoned early, and see how much that saves.",
    "Solve a constraint puzzle (N-Queens) by backtracking.",
    "Apply divide and conquer: split, solve each part independently, combine.",
  ],
  prereqNote: "Recursion I (base case, call stack, the leap of faith). Trees help for picturing the search as a tree of choices.",
  sections: [
    { kind: "intuition", id: "maze", title: "A maze with chalk",
      paras: ["In a maze you reach a fork and pick a path. If it dead-ends, you walk back to the fork, rub out your chalk mark, and try the next path. You never need to remember the whole route in advance: only where you are, and which options remain at each fork.",
        "That is **backtracking**: build a solution one choice at a time; whenever the choices so far cannot lead to an answer, undo the last one and try another. **Divide and conquer** is a different recursive habit: cut the problem into smaller independent pieces, solve each, and combine the results."] },
    { kind: "naive", id: "naive", title: "Generate every placement, then check",
      paras: ["Place n queens on an n × n board so none attacks another. The blunt way: write down one column for every row (n choices each, so n^n boards), then check each board for attacks.",
        "For 4 queens that is 256 boards, fine. For 8 queens it is 16,777,216 boards, and for 12 it is about 9 × 10¹². The method wastes almost all its time finishing boards that were already hopeless after the first two queens."],
      code: naive,
      cost: "O(nⁿ × n²): every complete placement is generated and checked, however early the conflict appeared." },
    { kind: "observation", id: "observation", title: "Stop the moment a partial answer is already wrong",
      paras: ["If two queens already attack each other after placing just two rows, *no* way of placing the remaining rows can fix it. So check **as you build**, and abandon the branch immediately. That cut-off is called **pruning**, and it removes entire subtrees of the search at once.",
        "The search is a tree: each level is a decision, each branch is a choice. Backtracking is a depth-first walk of that tree that skips every subtree known to contain no solutions."] },
    { kind: "concept", id: "template", title: "The backtracking template",
      paras: ["Almost every backtracking solution has the same skeleton. Learn it once."],
      bullets: ["**State:** what choices have been made so far (a `path` list, plus helper sets like `used`).", "**Base case:** the partial answer is complete (or a solution): record a **copy** of it (`path[:]`) and return.", "**Choices:** loop over the options available *now*, skipping any that break a rule (**pruning**).", "**Choose:** add the option to the state. **Explore:** recurse. **Un-choose:** remove it, restoring the state exactly as it was.", "The un-choose step is what lets the next option start from a clean state. Forgetting it, or not restoring *everything* you changed, is the classic bug.", "The number of results often grows exponentially (2ⁿ subsets, n! permutations), so these solutions only fit small n (roughly up to 20 for subsets, 10 for permutations)."] },
    { kind: "viz", id: "viz-queens", title: "4-Queens: place, fail, backtrack", viz: "nqueens-backtrack",
      paras: ["Rows are filled top to bottom, columns tried left to right. A highlighted square is being tried; if it is attacked, the square that attacks it is shown and the column is skipped. When a row has no safe square the previous queen is **removed** and moved on. Notice how early dead ends are abandoned without ever filling the lower rows."] },
    { kind: "example", id: "example", title: "The search tree for subsets of {1, 2, 3}",
      paras: ["At each element there are two choices: skip it or take it. The path of choices *is* the subset."],
      table: { head: ["choice for 1", "choice for 2", "choice for 3", "subset"], rows: [["skip", "skip", "skip", "[]"], ["skip", "skip", "take", "[3]"], ["skip", "take", "skip", "[2]"], ["skip", "take", "take", "[2, 3]"], ["take", "skip", "skip", "[1]"], ["take", "skip", "take", "[1, 3]"], ["take", "take", "skip", "[1, 2]"], ["take", "take", "take", "[1, 2, 3]"]] },
      steps: [{ title: "Eight leaves", body: "Three yes/no choices give 2³ = 8 leaves. n items give 2ⁿ subsets, which is why enumeration is limited to small n." }, { title: "Reading the output order", body: "Code that tries “skip” before “take” visits leaves in exactly the order of this table. The order of results depends on the order you try the choices." }] },
    { kind: "code", id: "code-subsets", title: "Subsets: take it or leave it",
      paras: ["Each recursive call decides about one element. The `path.pop()` after the second call is the un-choose step."],
      pseudocode: "go(i):\n    if i is past the last element: record a copy of path; return\n    go(i + 1)                    # leave nums[i] out\n    path.append(nums[i]); go(i + 1); path.pop()   # put nums[i] in, then take it back out",
      code: subsets,
      walkthrough: ["`res.append(path[:])` stores a **copy**. If you append `path` itself, every stored result would be the same list, finally empty after all the pops.", "`go(i + 1)` first with nothing added is the “skip” branch; then add, recurse, remove for the “take” branch.", "After `path.pop()` the state is exactly as it was on entry, so the caller can continue.", "There are 2ⁿ results, so n = 10 gives 1,024 and n = 20 about a million: enumeration cost, not a flaw of the method."] },
    { kind: "code", id: "code-combos", title: "Combinations, and pruning",
      paras: ["To choose k numbers from 1 to n, loop over the next number to add, and recurse with a start just past it so each combination appears once, in increasing order. Pruning removes starts that cannot possibly leave enough numbers."],
      code: combos,
      walkthrough: ["`go(x + 1)` means the next number must be larger, so [1, 2] and [2, 1] are not both produced.", "In `combine_pruned`, `need = k - len(path)` numbers are still required, and the last start that leaves enough room is `n - need + 1`, hence the range end `n - need + 2`. Without pruning the loop would start branches that can never reach size k.", "Pruning does not change the answer (the equality check prints True), only the work.", "There are C(10, 5) = 252 combinations of 5 from 10."] },
    { kind: "code", id: "code-perms", title: "Permutations: use each item once",
      paras: ["For orderings, every position may take any item not yet used. A boolean list `used` records which are taken, and must be restored on the way back."],
      code: perms,
      walkthrough: ["`used[i] = True` and `used[i] = False` are the choose and un-choose pair for the extra state, next to `append` and `pop`. Restoring *both* is essential.", "`for i in range(len(nums))` tries every item as the next element, skipping those already used.", "The count is n! (24 for four items, 3,628,800 for ten), so this is only for small n.", "`itertools.permutations` does the same in the standard library; write your own when the problem adds pruning rules."] },
    { kind: "code", id: "code-csum", title: "Reuse, sorted pruning, and duplicates",
      paras: ["Two small changes handle common variations. **Reuse:** recurse with the same index (`i`) instead of `i + 1` so a number may be picked again. **Duplicates in the input:** sort, then skip a value equal to the previous one at the same decision position, so identical branches are not explored twice."],
      code: csum,
      walkthrough: ["In `combination_sum`, sorting lets us `break` as soon as one candidate exceeds the remainder: every later one is at least as big, so the whole rest of the loop is pruned.", "`go(i, remain - cands[i])` passes `i`, not `i + 1`, which allows the same number again, but never goes backwards to a smaller index, so [2, 3] and [3, 2] are not both produced.", "In `subsets_with_dup`, `i > start and nums[i] == nums[i - 1]` skips a repeated value only when it would start the *same* branch as its twin, while still allowing both copies in one subset ([1, 2, 2]).", "`combination_sum([2], 1)` is an example with no answer: the result is simply an empty list."] },
    { kind: "code", id: "code-queens", title: "N-Queens with fast conflict checks",
      paras: ["Checking every earlier queen for each square is slow. Instead, keep sets of the used columns and diagonals. Squares on the same diagonal share `row − col` (one direction) or `row + col` (the other)."],
      code: queens,
      walkthrough: ["`c in cols or r - c in diag1 or r + c in diag2` is the pruning test: three set lookups, O(1) each.", "The six lines adding and removing from the sets are the choose and un-choose pair. Every set that was changed is restored.", "`nonlocal count` lets the inner function update the outer variable.", "Known counts: 2 solutions for n = 4, 4 for n = 6, 92 for n = 8. Brute force at n = 8 tests 16.7 million boards; backtracking visits only a few thousand partial boards."] },
    { kind: "concept", id: "dc", title: "Divide and conquer: split, solve, combine",
      paras: ["Backtracking *explores choices*. **Divide and conquer** *splits a problem* into smaller independent pieces of the same kind. The pattern:"],
      bullets: ["**Divide:** cut the input (usually in half).", "**Conquer:** solve each piece recursively (base case: a piece small enough to answer directly).", "**Combine:** merge the pieces' answers into the answer for the whole.", "You have already met it: merge sort, binary search (conquer only one half), fast exponentiation, tree recursion.", "Unlike dynamic programming, the pieces are **independent** and do not repeat, so no memoisation is needed. If pieces overlap, see Top-Down DP."] },
    { kind: "code", id: "code-bst", title: "Divide and conquer: a balanced tree from a sorted list",
      paras: ["Make a balanced binary search tree from a sorted list. The middle item is the root; the left half builds the left subtree and the right half builds the right subtree. Each half is the same problem, smaller."],
      code: bst,
      walkthrough: ["The base case `lo >= hi` is an empty range, which becomes `None`.", "The recursive calls pass index ranges instead of slicing, so no copying happens: O(n) time overall.", "Because the root is always the middle, both sides have nearly equal size, so the height is about log₂ n: 3 for 7 items and 10 for 1,000.", "Inorder of the result is the original sorted list, which confirms the BST property."] },
    { kind: "code", id: "code-kth", title: "Divide and conquer: a recursively built string",
      paras: ["Define S₁ = \"0\" and Sᵢ = Sᵢ₋₁ + \"1\" + reverse(invert(Sᵢ₋₁)), where invert flips every bit. Find the k-th character of Sₙ **without building the huge string**. The length is 2ⁿ − 1, so building it is hopeless for large n, but the structure tells you which part of the string position k is in."],
      code: kth,
      walkthrough: ["Position `mid` (the middle) is always \"1\". A position in the left half equals the same position in Sₙ₋₁, so recurse on it.", "A position in the right half is the **mirror image, inverted**: it corresponds to position `length − k + 1` of Sₙ₋₁ with the bit flipped.", "Only one recursive call is made per level, so the cost is O(n), not O(2ⁿ).", "The last line builds S₄ by asking for each of its 15 characters, and matches the string written out by hand: 011100110110001."] },
    { kind: "complexity", id: "complexity", title: "Costs",
      rows: [
        { what: "Subsets of n items", time: "O(n × 2ⁿ)", space: "O(n) stack, plus output", why: "2ⁿ leaves; copying each result costs up to n." },
        { what: "Permutations of n items", time: "O(n × n!)", space: "O(n) stack, plus output", why: "n! leaves, each a list of length n." },
        { what: "Combinations C(n, k)", time: "O(k × C(n, k))", space: "O(k)", why: "One output per combination; pruning keeps dead branches out." },
        { what: "N-Queens", time: "far below O(nⁿ), roughly O(n!) worst case", space: "O(n)", why: "Pruning removes whole subtrees; each row has at most n columns, with fewer after each placement." },
        { what: "Backtracking in general", time: "O(number of nodes visited)", space: "O(depth)", why: "Cost is the size of the explored tree; the stack depth equals the number of decisions." },
        { what: "Divide and conquer: halving with a combine step costing c(n)", time: "e.g. O(n log n) for merge sort", space: "O(log n) to O(n)", why: "log₂ n levels, each costing about n in total." },
        { what: "Kth-bit recursion (one call per level)", time: "O(n)", space: "O(n)", why: "Only one half is explored at each level." }],
      paras: ["Backtracking answers are often exponential in size, so judge feasibility by the *number of results or nodes*, not by a polynomial formula. Pruning is how you shrink it."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Empty input", handle: "`subsets([])` is `[[]]` (one empty subset), `permutations([])` is `[[]]`. Decide the base case deliberately." }, { case: "Storing the path, not a copy", handle: "Always append `path[:]` (or `list(path)`) to results." }, { case: "Duplicates in the input", handle: "Sort and skip equal neighbours at the same level, or you will list identical answers several times." }, { case: "Target 0 or empty candidate list", handle: "`combination_sum` with target 0 returns `[[]]`; with no candidates and a positive target returns `[]`." }, { case: "Deep recursion", handle: "Depth equals the number of decisions, usually small. For very long inputs (thousands of decisions) switch to an explicit stack." }, { case: "Large n", handle: "2ⁿ and n! explode quickly. If n is above about 20, backtracking over all subsets is the wrong tool: look for DP or a smarter idea." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Appending the live `path` to the results.", fix: "Append a copy (`path[:]`). Otherwise all results end up identical (and empty)." }, { mistake: "Forgetting to un-choose, or restoring only some of the state.", fix: "Every change made before the recursive call must be undone after it: `append`/`pop`, `add`/`remove`, `used[i] = True/False`." }, { mistake: "Starting the loop at 0 every time for combinations.", fix: "Pass a `start` index so each combination is produced once, not in every order." }, { mistake: "Not pruning.", fix: "Test constraints before recursing, and use sorting and early `break` where possible." }, { mistake: "Using backtracking where subproblems repeat.", fix: "If the same state is reached many times by different paths, memoise it (Top-Down DP) instead of re-exploring." }, { mistake: "Confusing “skip duplicates at the same level” with “never use duplicates”.", fix: "The condition `i > start` still lets both 2s appear together in `[1, 2, 2]`." }] },
    { kind: "recognize", id: "recognize", title: "How to spot backtracking and divide and conquer",
      signals: ["**“Generate all …”**, “list every …”: subsets, combinations, permutations, partitions, parenthesis strings: backtracking.", "A **constraint puzzle** with small size: N-Queens, Sudoku, word search, placing items without conflict.", "“Is there a way to …” with a **small n** (up to about 20) and many interacting choices: try, check, undo.", "A problem that **halves** or splits naturally: build a balanced tree from a sorted list, count inversions, max subarray, closest pair: divide and conquer.", "A recursive **definition** of a structure (a string built from smaller strings, a fractal) where you want one element of it: recurse into only the relevant part."],
      notThis: ["Overlapping subproblems and you only need a count or an optimum: dynamic programming (Top-Down DP) is exponentially faster.", "A greedy rule provably works: it needs no exploration at all.", "n is large (thousands) and you need *all* answers: the output itself would be astronomically big, so the problem must ask for something smaller."] },
    { kind: "worked", id: "worked-queens", title: "Count the N-Queens solutions",
      problem: "Count the ways to place n queens on an n × n board so that no two attack each other.",
      approach: ["Place queens row by row: exactly one per row is forced, so the decision at each level is *which column*.", "A column is allowed if it is not already in `cols` and its two diagonals (`r − c`, `r + c`) are not in the diagonal sets.", "Choose a column, recurse to the next row, then undo all three set updates.", "A full board (row == n) counts as one solution."],
      code: queens,
      takeaway: "Three sets turn the attack check into O(1) lookups, and the row-by-row order removes the “one queen per row” rule from the search entirely. The same shape (a row per level, columns as choices, sets for conflicts) solves Sudoku-type puzzles." },
    { kind: "worked", id: "worked-kth", title: "Find the k-th bit of a huge recursive string",
      problem: "The strings are built by S₁ = \"0\" and Sᵢ = Sᵢ₋₁ + \"1\" + reverse(invert(Sᵢ₋₁)). Return the k-th character of Sₙ (1-indexed). n can be large enough that Sₙ could not be stored.",
      approach: ["Do not build the string. Sₙ has length 2ⁿ − 1 and a clear shape: left copy, a single \"1\" in the middle, then the mirrored and inverted copy.", "If k is the middle, the answer is \"1\". If k is in the left half, ask the same question of Sₙ₋₁.", "If k is in the right half, its mirror position is `length − k + 1` in Sₙ₋₁, and the answer is the *opposite* bit of that.", "Only one branch is followed per level: n steps."],
      code: kth,
      takeaway: "When a structure is defined recursively, you can often answer a question about one element by recursing into just the relevant part. The work drops from the size of the structure (2ⁿ) to its recursion depth (n)." },
  ],
  cheatSheet: [{ label: "Template", value: "base case: record path[:]; for each valid choice: choose, recurse, un-choose" }, { label: "Subsets / permutations / combinations", value: "2ⁿ / n! / C(n, k) results" }, { label: "Combinations", value: "recurse with start = x + 1 so each set appears once" }, { label: "Duplicates", value: "sort; skip nums[i] == nums[i−1] when i > start" }, { label: "Prune", value: "reject a partial answer as soon as it cannot succeed" }, { label: "Divide and conquer", value: "split, solve independent halves, combine; recursion depth log n" }],
  summary: ["Backtracking builds an answer one choice at a time and undoes a choice when it leads nowhere: choose, explore, un-choose.", "Store a copy of the path when you record a result, and restore every piece of state after the recursive call.", "Pruning abandons hopeless branches early and is what makes puzzles like N-Queens feasible.", "Subsets, combinations and permutations differ only in which choices are allowed at each step; duplicates need sorting plus a skip rule.", "Divide and conquer splits a problem into independent smaller copies and combines their answers; often only one part needs exploring."],
  checks: [
    { kind: "concept", q: "In the backtracking template, what is the purpose of the un-choose step?", options: ["To make the result sorted", "To restore the state so the next choice starts from a clean state", "To stop the recursion", "To copy the path"], answer: 1, why: "After exploring a choice, removing it returns the state to exactly what it was, so the next option behaves as if the previous one had never been tried." },
    { kind: "trace", q: "How many subsets does a set of 10 items have?", options: ["10", "100", "1,024", "3,628,800"], answer: 2, why: "Each of the 10 items is either in or out: 2¹⁰ = 1,024. (3,628,800 is 10!, the number of permutations.)" },
    { kind: "concept", q: "Why must a result be recorded as `path[:]` rather than `path`?", options: ["It is faster", "`path` keeps changing, so every stored result would end up as the same (empty) list", "Python requires slices", "To remove duplicates"], answer: 1, why: "The same list object is modified by append and pop all along. Only a copy preserves the state at the moment of recording." },
    { kind: "recognize", q: "“Return all ways to arrange these 4 distinct letters” suggests:", options: ["Binary search", "Backtracking over permutations (4! = 24 results)", "Dynamic programming", "A sieve"], answer: 1, why: "Listing every arrangement is a permutation enumeration, naturally written as backtracking with a used marker." },
    { kind: "concept", q: "In `subsets_with_dup`, what does `if i > start and nums[i] == nums[i - 1]: continue` prevent?", options: ["Using any value twice", "Starting two identical branches from the same decision point", "Sorting the list", "Taking more than two items"], answer: 1, why: "It skips a repeated value only when it would begin the same branch as its twin. Both copies can still appear together in one subset like [1, 2, 2]." },
    { kind: "complexity", q: "Backtracking N-Queens with pruning is much faster than generating all n^n placements because:", options: ["It uses a faster language", "It abandons a partial placement as soon as two queens attack, cutting off the whole subtree beneath it", "It only handles small boards", "It sorts the columns"], answer: 1, why: "Once a conflict exists, none of the placements that extend it can be valid, so they are never generated." },
    { kind: "trace", q: "How many subsets does [1, 2] have, counted with itertools.combinations for every size?", options: ["4", "2", "3", "8"], answer: 0, why: "The empty set, {1}, {2} and {1, 2}." },
    { kind: "trace", q: "How many permutations does [1, 2, 3] have? Print len(list(permutations(...))).", options: ["6", "3", "9", "27"], answer: 0, why: "There are 3! = 6 orderings." },
    { kind: "trace", q: "Count the placements of 4 non-attacking queens on a 4x4 board (try every column permutation). What is printed?", options: ["2", "1", "4", "0"], answer: 0, why: "Only two arrangements avoid all diagonal attacks." },
    { kind: "trace", q: "A divide-and-conquer max over [3, 9, 2, 7]: what does it print?", options: ["9", "7", "3", "21"], answer: 0, why: "The halves give 3 vs 9, and 2 vs 7; the larger halves max is 9." },
    { kind: "concept", q: "What does pruning mean in backtracking?", options: ["Abandoning a branch as soon as it cannot lead to a valid answer", "Removing the recursion entirely", "Deleting part of the input", "Sorting the output"], answer: 0, why: "Pruning turns an exhaustive search into a much smaller one." },
    { kind: "complexity", q: "How many subsets does a set of n items have, and what is the time to list them all?", options: ["2^n subsets, so O(2^n) time", "n! subsets, so O(n!) time", "n\u00b2 subsets", "n log n subsets"], answer: 0, why: "Each item is either in or out, giving 2 choices per item." },
    { kind: "concept", q: "Why must backtracking undo a choice after the recursive call returns?", options: ["So the next branch starts from the same state", "To free the memory of the input", "Python requires it", "To sort the results"], answer: 0, why: "Without undoing, earlier choices leak into later branches." },
    { kind: "trace", q: "Count combinations of [1, 2, 3] (no repeats, any size) whose sum is exactly 3.", options: ["2", "1", "3", "4"], answer: 0, why: "The combinations are [3] and [1, 2]." },
    { kind: "trace", q: "Recursive digit sum: def ds(n): return 0 if n == 0 else n % 10 + ds(n // 10). What is ds(1234)?", options: ["10", "1234", "4", "12"], answer: 0, why: "1 + 2 + 3 + 4 = 10." },
  ],
  nextNote: "Next, **Top-Down DP** shows what to do when a recursion keeps repeating the same subproblems.",
};
