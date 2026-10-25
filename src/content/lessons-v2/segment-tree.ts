import type { LessonV2 } from "../lesson-types";

const naive = String.raw`a = [5, 2, 6, 1, 7, 3, 8, 4]

def range_min_naive(a, l, r):          # positions l..r inclusive
    best = a[l]
    for i in range(l + 1, r + 1):
        if a[i] < best:
            best = a[i]
    return best

print(range_min_naive(a, 2, 6))   # 1
a[3] = 9                               # a point update is O(1) ...
print(range_min_naive(a, 2, 6))   # 3
# ... but every query still scans the whole range: O(n)`;
const seg = String.raw`INF = float("inf")

class SegTree:
    def __init__(self, a, op=min, identity=INF):
        self.n = len(a)
        self.op = op
        self.identity = identity
        self.t = [identity] * self.n + list(a)      # leaves live at t[n .. 2n - 1]
        for i in range(self.n - 1, 0, -1):
            self.t[i] = op(self.t[2 * i], self.t[2 * i + 1])

    def update(self, i, v):                         # set position i (0-indexed) to v
        i += self.n
        self.t[i] = v
        while i > 1:
            i //= 2
            self.t[i] = self.op(self.t[2 * i], self.t[2 * i + 1])

    def query(self, l, r):                          # half-open range [l, r)
        res = self.identity
        l += self.n
        r += self.n
        while l < r:
            if l & 1:
                res = self.op(res, self.t[l])
                l += 1
            if r & 1:
                r -= 1
                res = self.op(res, self.t[r])
            l //= 2
            r //= 2
        return res

a = [5, 2, 6, 1, 7, 3, 8, 4]
st = SegTree(a)
print(st.query(2, 7))   # 1
st.update(3, 9)
print(st.query(2, 7))   # 3
print(st.query(0, 8), st.query(4, 5))   # 2 7
total = SegTree(a, lambda x, y: x + y, 0)
print(total.query(0, 8))   # 36
print(total.query(3, 3))   # 0`;
const check = String.raw`import random

INF = float("inf")

class SegTree:
    def __init__(self, a, op=min, identity=INF):
        self.n, self.op, self.identity = len(a), op, identity
        self.t = [identity] * self.n + list(a)
        for i in range(self.n - 1, 0, -1):
            self.t[i] = op(self.t[2 * i], self.t[2 * i + 1])

    def update(self, i, v):
        i += self.n
        self.t[i] = v
        while i > 1:
            i //= 2
            self.t[i] = self.op(self.t[2 * i], self.t[2 * i + 1])

    def query(self, l, r):
        res = self.identity
        l += self.n
        r += self.n
        while l < r:
            if l & 1:
                res = self.op(res, self.t[l])
                l += 1
            if r & 1:
                r -= 1
                res = self.op(res, self.t[r])
            l //= 2
            r //= 2
        return res

random.seed(11)
ok = True
for _ in range(300):
    n = random.randint(1, 13)
    a = [random.randint(-20, 20) for _ in range(n)]
    st = SegTree(a)
    for _ in range(25):
        if random.random() < 0.4:
            i, v = random.randrange(n), random.randint(-20, 20)
            a[i] = v
            st.update(i, v)
        else:
            l = random.randrange(n)
            r = random.randint(l + 1, n)
            ok = ok and st.query(l, r) == min(a[l:r])
print(ok)   # True`;
const lazy = String.raw`import random

class RangeAddSum:
    def __init__(self, a):
        self.n = len(a)
        self.sum = [0] * (4 * self.n)
        self.lazy = [0] * (4 * self.n)         # pending "add v to everything below" tags
        self._build(1, 0, self.n - 1, a)

    def _build(self, x, l, r, a):
        if l == r:
            self.sum[x] = a[l]
            return
        m = (l + r) // 2
        self._build(2 * x, l, m, a)
        self._build(2 * x + 1, m + 1, r, a)
        self.sum[x] = self.sum[2 * x] + self.sum[2 * x + 1]

    def _push(self, x, l, r):                   # hand the pending tag down to both children
        if self.lazy[x]:
            m = (l + r) // 2
            for child, cl, cr in ((2 * x, l, m), (2 * x + 1, m + 1, r)):
                self.sum[child] += self.lazy[x] * (cr - cl + 1)
                self.lazy[child] += self.lazy[x]
            self.lazy[x] = 0

    def add(self, ql, qr, v, x=1, l=0, r=None):
        if r is None:
            r = self.n - 1
        if qr < l or r < ql:
            return
        if ql <= l and r <= qr:                 # whole node inside: tag it and stop
            self.sum[x] += v * (r - l + 1)
            self.lazy[x] += v
            return
        self._push(x, l, r)
        m = (l + r) // 2
        self.add(ql, qr, v, 2 * x, l, m)
        self.add(ql, qr, v, 2 * x + 1, m + 1, r)
        self.sum[x] = self.sum[2 * x] + self.sum[2 * x + 1]

    def query(self, ql, qr, x=1, l=0, r=None):
        if r is None:
            r = self.n - 1
        if qr < l or r < ql:
            return 0
        if ql <= l and r <= qr:
            return self.sum[x]
        self._push(x, l, r)
        m = (l + r) // 2
        return self.query(ql, qr, 2 * x, l, m) + self.query(ql, qr, 2 * x + 1, m + 1, r)

st = RangeAddSum([1, 2, 3, 4, 5])
st.add(1, 3, 10)
print(st.query(0, 4))   # 45
print(st.query(2, 2))   # 13

random.seed(2)
ok = True
for _ in range(200):
    n = random.randint(1, 12)
    a = [random.randint(-9, 9) for _ in range(n)]
    tree = RangeAddSum(a)
    for _ in range(30):
        l = random.randrange(n)
        r = random.randint(l, n - 1)
        if random.random() < 0.5:
            v = random.randint(-5, 5)
            tree.add(l, r, v)
            for i in range(l, r + 1):
                a[i] += v
        else:
            ok = ok and tree.query(l, r) == sum(a[l:r + 1])
print(ok)   # True`;
const descent = String.raw`NEG = float("-inf")

def build_max(a):
    size = 1
    while size < len(a):
        size *= 2
    t = [NEG] * (2 * size)
    for i, v in enumerate(a):
        t[size + i] = v
    for i in range(size - 1, 0, -1):
        t[i] = max(t[2 * i], t[2 * i + 1])
    return t, size

def first_at_least(t, size, x):
    if t[1] < x:
        return -1
    i = 1
    while i < size:
        i = 2 * i if t[2 * i] >= x else 2 * i + 1
    return i - size

t, size = build_max([3, 1, 4, 1, 5, 9, 2, 6])
print(first_at_least(t, size, 5))   # 4
print(first_at_least(t, size, 7))   # 5
print(first_at_least(t, size, 10))   # -1
print(first_at_least(*build_max([2, 8, 8, 1, 4]), 8))   # 1`;
const maxupd = String.raw`INF = float("inf")

class SegTree:
    def __init__(self, a, op=max, identity=-INF):
        self.n, self.op, self.identity = len(a), op, identity
        self.t = [identity] * self.n + list(a)
        for i in range(self.n - 1, 0, -1):
            self.t[i] = op(self.t[2 * i], self.t[2 * i + 1])

    def update(self, i, v):
        i += self.n
        self.t[i] = v
        while i > 1:
            i //= 2
            self.t[i] = self.op(self.t[2 * i], self.t[2 * i + 1])

    def query(self, l, r):
        res = self.identity
        l += self.n
        r += self.n
        while l < r:
            if l & 1:
                res = self.op(res, self.t[l])
                l += 1
            if r & 1:
                r -= 1
                res = self.op(res, self.t[r])
            l //= 2
            r //= 2
        return res

def tallest_so_far(heights, events):
    st = SegTree(heights)
    out = []
    for kind, x, y in events:
        if kind == "set":
            st.update(x, y)
        else:
            out.append(st.query(x, y + 1))
    return out

events = [("max", 0, 4), ("set", 2, 50), ("max", 0, 4), ("max", 3, 4), ("set", 2, 1), ("max", 1, 3)]
print(tallest_so_far([4, 9, 2, 7, 5], events))   # [9, 50, 7, 9]`;

export const segmentTree: LessonV2 = {
  topic: "segment-tree", depth: "complete", minutes: 60,
  hook: "A tree of range summaries that answers “what is the minimum, maximum or sum over this range?” and lets values change, each in about log n steps.",
  objectives: [
    "Describe a segment tree as a tree whose node stores the answer (sum, min, max, gcd, …) for a range of the array.",
    "Build one, apply a point update, and answer a range query, in an iterative bottom-up form.",
    "Explain which nodes a query takes whole, ignores or opens, and why only about 2 log n nodes are visited.",
    "Explain lazy propagation and use it for range updates with range sums.",
    "Choose between a prefix array, Fenwick tree, sparse table and segment tree.",
  ],
  prereqNote: "Trees (parents, children, recursion on halves) and Prefix Sum. Fenwick Tree is a useful warm-up but not required.",
  sections: [
    { kind: "intuition", id: "tournament", title: "A tournament bracket",
      paras: ["In a knockout tournament each match records the winner of two teams, each semi-final the winner of two matches, and the final the champion. If someone asks who the strongest team is among entries 3 to 7, you do not replay anything: you combine a few already-decided matches that together cover exactly those entries. If one team's strength changes, you only re-decide the matches along its path to the final.",
        "A segment tree is that bracket for an array. Each node stores the result (the minimum, the maximum, the sum) for the range of positions below it."] },
    { kind: "naive", id: "naive", title: "Scan the range each time",
      paras: ["For a range minimum, the direct way scans the range. A point update is trivially O(1): overwrite the value.",
        "But every query costs the length of the range, up to n. With 2 × 10⁵ queries on an array of 2 × 10⁵ values that is up to 4 × 10¹⁰ steps. Prefix sums do not help, because a minimum cannot be subtracted out, and the Fenwick tree only supports undoable operations."],
      code: naive,
      cost: "O(n) per query, so O(n × q) overall." },
    { kind: "observation", id: "observation", title: "Any range is a few ready-made blocks",
      paras: ["Cut the array in half, then each half in half, and so on down to single values. Every block gets a node storing its answer. Any range (say positions 2 to 6) can be assembled from a few of these blocks: whole blocks that fit inside the range, with no need to look at their contents.",
        "That works for every **associative** operation: sum, minimum, maximum, gcd, bitwise and/or/xor, product. Unlike a Fenwick tree, the operation does not need to be undoable. And because there are only log₂ n levels, a query uses at most about two blocks per level, and an update touches one node per level."] },
    { kind: "concept", id: "concept", title: "Anatomy of a segment tree",
      paras: ["The tree is stored in a flat array. Two layouts are common; this lesson uses the compact bottom-up one."],
      bullets: ["**Node:** stores `op` applied to every value in its range. A leaf is one array value; a parent combines its two children.", "**Bottom-up array layout:** for `n` values, leaves live at `t[n .. 2n − 1]` (value `i` at `t[n + i]`). The parent of node `i` is `i // 2`, its children are `2i` and `2i + 1`, and `t[1]` is the root (the answer for the whole array).", "**Point update:** change the leaf, then recompute each ancestor on the way up: `t[i] = op(t[2i], t[2i + 1])`. At most log₂ n recomputations.", "**Range query [l, r):** start from the leaves `l + n` and `r + n`; whenever an end is a right child (odd index), take it and step inward; then move both ends up one level. At most about 2 log₂ n nodes are combined.", "**Half-open ranges:** this code uses `[l, r)` (r excluded), which makes the loop clean. Convert an inclusive `[l, r]` to `[l, r + 1)`.", "**Identity value:** the neutral element of the operation (`inf` for min, `-inf` for max, `0` for sum). It starts the answer and fills unused slots.", "**Lazy propagation:** a technique that postpones range updates by leaving a “pending add” tag on a node, so a whole-range update costs O(log n) instead of O(n)."] },
    { kind: "viz", id: "viz-seg", title: "Answering a range-minimum query", viz: "segment-query",
      paras: ["Each node shows the minimum of its range; the range is written under it. The query asks for positions 2 to 6. Blue-green nodes (taken whole) are fully inside the range, and their stored value is used directly. Yellow nodes overlap partly and are opened. Light blue nodes lie outside and are ignored. Count how few nodes are actually combined."] },
    { kind: "viz", id: "viz-seg-update", title: "A point update touches one path", viz: "segment-update",
      paras: ["Changing one array value changes one leaf and the nodes above it, one per level: O(log n) nodes. Every other node still holds the right minimum, so nothing else is recomputed."] },
    { kind: "example", id: "example", title: "The same query by hand",
      paras: ["Array `[5, 2, 6, 1, 7, 3, 8, 4]` (positions 0 to 7), query: minimum of positions 2 to 6."],
      table: { head: ["node (range)", "relation to 2..6", "action"], rows: [["0-7", "partly overlaps", "open it"], ["0-3", "partly overlaps", "open it"], ["0-1", "outside", "ignore"], ["2-3", "inside", "take min(6, 1) = 1"], ["4-7", "partly overlaps", "open it"], ["4-5", "inside", "take min(7, 3) = 3"], ["6-7", "partly overlaps", "open it"], ["6-6", "inside", "take 8"], ["7-7", "outside", "ignore"]] },
      steps: [{ title: "Combine the taken pieces", body: "The answer is min(1, 3, 8) = 1, built from three stored values instead of scanning five elements." }, { title: "Why it stays fast", body: "At each level at most two nodes are only partly covered (the ones at the two ends of the range). Everything else is either fully inside or fully outside, so the work per level is constant." }] },
    { kind: "code", id: "code-seg", title: "A segment tree for any associative operation",
      paras: ["One class handles minimum, maximum, sum or gcd: pass the operation and its identity."],
      pseudocode: "build: copy values into the leaves; for i from n − 1 down to 1: t[i] = op(t[2i], t[2i + 1])\nupdate(i, v): set the leaf; walk up recomputing each parent\nquery(l, r): move two ends up the tree, taking a node whenever an end is a right child",
      code: seg,
      walkthrough: ["`self.t[i] = op(self.t[2 * i], self.t[2 * i + 1])` is the only combining rule: every ancestor is the combination of its two children.", "In `query`, the checks `l & 1` and `r & 1` ask “is this end a right child?”. A right child on the left edge must be taken now and the edge moved right (`l += 1`); an exclusive right end that is odd means the node just before it belongs to the range (`r -= 1`).", "`query(2, 7)` is the minimum of positions 2 to 6 (half-open), as in the animation: 1. After `update(3, 9)` the minimum becomes 3.", "With `op = lambda x, y: x + y` and identity 0 the same class sums: total 36. An empty range `query(3, 3)` returns the identity, 0.", "This compact version needs a **commutative** operation (order does not matter) such as min, max, sum or gcd. For non-commutative operations keep separate left and right accumulators."] },
    { kind: "code", id: "code-check", title: "Check it against brute force",
      paras: ["A data structure with index arithmetic is easy to get subtly wrong. The same class below is checked on 300 random arrays with 25 random updates and queries each against the obvious `min(a[l:r])`."],
      code: check,
      walkthrough: ["Random array sizes from 1 to 13 include **non-powers of two**, which is where bottom-up segment trees often break.", "Each step either updates a random position or queries a random half-open range, and compares with a plain slice minimum.", "Printing `True` means all comparisons agreed. Doing this before relying on a structure in a contest is cheap insurance."] },
    { kind: "code", id: "code-lazy", title: "Range updates with lazy propagation",
      paras: ["Now suppose an update adds a value to **every** element of a range and queries ask for range sums. Updating each element would be O(n). Instead, when a node's range lies completely inside the update, add to its sum and leave a **lazy tag** (“this much is still owed to my children”) rather than descending. The tag is pushed down only when a later operation needs to look inside."],
      code: lazy,
      walkthrough: ["`add` on a fully covered node does `sum += v × length` and `lazy += v`, then **stops**. That is what keeps range updates at O(log n).", "`_push` hands the pending tag to both children (updating their sums and tags) and clears it. It must be called before descending, in both `add` and `query`; forgetting it is the classic bug.", "After the children are updated, the parent's sum is recomputed from them.", "The example adds 10 to positions 1 to 3 of `[1, 2, 3, 4, 5]`: the total becomes 15 + 30 = 45 and position 2 becomes 13. The final loop checks 200 random arrays with random range adds and range sums against a plain list."] },
    { kind: "code", id: "code-descent", title: "Descending the tree: first position at least x",
      paras: ["A segment tree can also *search*. With a maximum tree, “the first position whose value is at least x” is found by walking down from the root: go left if the left child's maximum is at least x, otherwise right. This needs the size padded to a power of two so the layout is a perfect tree."],
      code: descent,
      walkthrough: ["`t[1] < x` means even the overall maximum is too small: return -1.", "Each step compares the left child's maximum with `x`. If it is large enough, the answer is somewhere inside it (and it is the *first*, since it is left of everything else); otherwise go right.", "After `log₂ size` steps `i` is a leaf; `i − size` is the array position. In `[3, 1, 4, 1, 5, 9, 2, 6]` the first value at least 5 is at position 4 and at least 7 is at position 5.", "The last call shows ties: in `[2, 8, 8, 1, 4]` the first 8 is at position 1."] },
    { kind: "complexity", id: "complexity", title: "Costs and choosing a structure",
      rows: [
        { what: "Build", time: "O(n)", space: "O(n) (about 2n cells)", why: "Each internal node is computed once from its children." },
        { what: "Point update", time: "O(log n)", space: "O(1)", why: "One node recomputed per level on the way to the root." },
        { what: "Range query", time: "O(log n)", space: "O(1)", why: "At most about two nodes per level are combined." },
        { what: "Range update with lazy propagation", time: "O(log n)", space: "O(n) extra for tags", why: "A fully covered node is tagged and not opened." },
        { what: "Descent search (first position at least x)", time: "O(log n)", space: "O(1)", why: "One child chosen per level." },
        { what: "Naive scan", time: "O(n) per query", space: "O(1)", why: "Visits every element of the range." }],
      paras: ["**Which structure?** Static data and a sum: prefix sums (O(1)). Static data and min or max: sparse table (O(1)). Changing data and an undoable operation (sum, xor): Fenwick tree (short and fast). Changing data with min, max or gcd, range updates, or searching inside: segment tree."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "n is not a power of two", handle: "The compact bottom-up layout still works for commutative operations (the random test above covers it). The top-down descent needs padding to a power of two." }, { case: "Half-open versus inclusive ranges", handle: "Decide once. Here queries are `[l, r)`; convert an inclusive `[l, r]` to `(l, r + 1)`." }, { case: "Empty range", handle: "`query(l, l)` returns the identity element (0 for sum, infinity for min)." }, { case: "Wrong identity", handle: "Using 0 as the identity for min would wrongly cap every answer at 0. Use `inf` for min, `-inf` for max, 0 for sum." }, { case: "Lazy tags not pushed", handle: "Push the tag down before descending into children in both updates and queries, or answers go stale." }, { case: "Non-commutative operations", handle: "Concatenation or matrix product need ordered left and right accumulators in the bottom-up query." }, { case: "Recursion depth", handle: "A segment tree is only log n deep, so recursive versions are safe even for n = 10⁶." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Using the wrong identity element.", fix: "It must leave any value unchanged under `op`: `inf` for min, `-inf` for max, 0 for sum and xor, 1 for product." }, { mistake: "Mixing inclusive and half-open ranges.", fix: "Pick one convention for the whole class and convert at the boundary." }, { mistake: "Forgetting to recompute parents after an update.", fix: "Walk up to the root, recomputing `t[i] = op(t[2i], t[2i + 1])` each step." }, { mistake: "Forgetting `_push` before descending in a lazy tree.", fix: "Whenever you open a node that may have a pending tag, push the tag to its children first." }, { mistake: "Allocating too little for a recursive top-down tree.", fix: "Recursive trees on n values need about `4n` cells, not `2n`." }, { mistake: "Using a segment tree when a simpler tool suffices.", fix: "Sums without updates: prefix sums. Min/max without updates: sparse table." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a segment-tree problem",
      signals: ["**Range queries** (min, max, sum, gcd, count) **mixed with updates** to single positions.", "“Add a value to every element from l to r, then ask for a sum or maximum over a range”: **range update**, so lazy propagation.", "The operation is **min, max or gcd**, which cannot be subtracted out, so Fenwick trees do not apply.", "“Find the first position at or after l whose value is at least x”: **descent** on a max tree.", "n and q around 10⁵ to 2 × 10⁵ and an O(n) scan per operation would be too slow."],
      notThis: ["The array never changes: prefix sums (sum) or a sparse table (min, max, gcd) are simpler and faster.", "Only sums and point updates: a Fenwick tree is half the code.", "Offline problems that can be answered by sorting queries (for example with a stack or Union-Find) may not need a tree at all."] },
    { kind: "worked", id: "worked-max", title: "Tallest building in a changing skyline",
      problem: "Buildings stand in a row with given heights. Process events in order: `set i h` changes the height of building i to h; `max l r` asks for the tallest building among positions l to r (inclusive). Print the answer to each `max` event.",
      approach: ["The data changes, and the question is a **maximum**, which a Fenwick tree cannot answer. A segment tree with `op = max` and identity `-inf` fits.", "A `set` becomes `update(i, h)`.", "An inclusive `max l r` becomes `query(l, r + 1)` in the half-open convention."],
      code: maxupd,
      takeaway: "The same class from the lesson became a different tool by changing two arguments (`op` and `identity`). After setting position 2 to 50 the tallest is 50, and after setting it back to 1 the range 1 to 3 has maximum 9." },
    { kind: "worked", id: "worked-descent", title: "First building at least this tall",
      problem: "Given heights and a threshold x, find the leftmost building whose height is at least x, in O(log n) per query (without scanning).",
      approach: ["Build a maximum tree padded to a power of two.", "If the root's maximum is below x, nobody qualifies.", "Otherwise walk down: if the left child's maximum is at least x, the leftmost qualifying building is in it; otherwise it is in the right child.", "The leaf reached is the answer."],
      code: descent,
      takeaway: "A segment tree is a search structure as well as a query structure: the stored maxima tell you, at every node, which half can contain the answer. It is the same “discard half” idea as binary search, performed on a tree." },
  ],
  cheatSheet: [{ label: "Layout", value: "leaves at t[n..2n−1]; parent i//2; children 2i, 2i+1" }, { label: "Update", value: "set leaf; while i > 1: i //= 2; t[i] = op(t[2i], t[2i+1])" }, { label: "Query [l, r)", value: "l += n; r += n; while l < r: take t[l] if l odd; take t[r−1] if r odd; l //= 2; r //= 2" }, { label: "Identities", value: "min: inf · max: −inf · sum/xor: 0 · product: 1" }, { label: "Cost", value: "build O(n) · update, query O(log n) · lazy range update O(log n)" }, { label: "Lazy", value: "tag a fully covered node; push tags down before opening it" }],
  summary: ["A segment tree stores the answer for every block of a recursive halving of the array, so any range is a few ready-made blocks.", "It supports any associative operation (min, max, sum, gcd), unlike a Fenwick tree, with O(log n) updates and queries.", "The compact bottom-up version needs only a flat array of 2n cells and a few lines of code.", "Lazy propagation postpones range updates with pending tags, giving O(log n) range add and range sum.", "Pick the simplest tool that fits: prefix sums, sparse table, Fenwick tree, then segment tree."],
  checks: [
    { kind: "concept", q: "What does each node of a segment tree store?", options: ["The index of the largest element", "The combined answer (sum, min, max, …) for the range of positions below it", "A copy of the whole array", "The number of children"], answer: 1, why: "Each node summarises its block, and parents combine their two children, so any range can be assembled from a few blocks." },
    { kind: "complexity", q: "What is the cost of one range query on a segment tree of n values?", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], answer: 1, why: "At most about two nodes per level are combined, and there are log₂ n levels." },
    { kind: "trace", q: "For `[5, 2, 6, 1, 7, 3, 8, 4]`, what is the minimum over positions 2 to 6?", options: ["1", "2", "3", "6"], answer: 0, why: "The values are 6, 1, 7, 3, 8, and the smallest is 1." },
    { kind: "concept", q: "Why can a segment tree answer range minimum while a Fenwick tree cannot?", options: ["It is faster", "It combines blocks directly, so it needs no way to undo an operation", "It uses more memory", "Fenwick trees only store positive numbers"], answer: 1, why: "A Fenwick range is prefix(r) − prefix(l − 1), which needs subtraction. A segment tree combines whole blocks, so min, max and gcd work." },
    { kind: "recognize", q: "“Add 5 to every element from l to r, then report the sum of a range” suggests:", options: ["A prefix-sum array", "A segment tree with lazy propagation", "A sparse table", "A stack"], answer: 1, why: "Range updates plus range queries are the job of lazy propagation, which postpones the updates on whole nodes." },
    { kind: "concept", q: "What goes wrong in a lazy segment tree if you forget to push the tag down before opening a node?", options: ["Nothing", "The children keep stale values, so later answers are wrong", "It becomes slower but stays correct", "The tree crashes immediately"], answer: 1, why: "The pending addition is stored only on the parent. Opening the children without pushing it means they do not know about the update." },
    { kind: "trace", q: "Iterative segment tree for a = [1, 2, 3, 4] built with sums. What does the range query [1, 3) return (sum of a[1] and a[2])?", options: ["5", "6", "4", "9"], answer: 0, why: "a[1] + a[2] = 2 + 3 = 5." },
    { kind: "trace", q: "Same tree. Set a[0] = 10 (a point update), then query the whole range [0, 4). What is printed?", options: ["19", "10", "20", "16"], answer: 0, why: "The update changes one leaf and its ancestors; the total becomes 10 + 2 + 3 + 4 = 19." },
    { kind: "trace", q: "Range-minimum segment tree over a = [5, 2, 8, 1, 9]: what is the minimum over indices [0, 3)?", options: ["2", "5", "1", "8"], answer: 0, why: "The minimum of 5, 2 and 8 is 2." },
    { kind: "trace", q: "What is the sum of a[2:5] for a = [1, 2, 3, 4, 5, 6]?", options: ["12", "9", "15", "6"], answer: 0, why: "3 + 4 + 5 = 12, the range a segment tree would answer in O(log n)." },
    { kind: "complexity", q: "Building a segment tree from n values takes how long, and a range query takes how long?", options: ["O(n) to build, O(log n) per query", "O(n\u00b2) to build, O(1) per query", "O(n log n) to build, O(n) per query", "O(log n) to build, O(1) per query"], answer: 0, why: "Each internal node is combined once; a query touches O(log n) nodes." },
    { kind: "concept", q: "What does lazy propagation add to a segment tree?", options: ["Range updates that are applied later, instead of touching every leaf now", "Sorting of the array", "Removal of duplicate values", "Storage of strings"], answer: 0, why: "Pending updates are stored at nodes and pushed down only when needed." },
    { kind: "concept", q: "Which structure handles range-minimum queries directly, with point updates?", options: ["A segment tree", "A Fenwick tree for sums only", "A hash map", "A stack"], answer: 0, why: "A segment tree can combine any associative operation, such as min." },
    { kind: "complexity", q: "What is the memory used by a segment tree over n values?", options: ["O(n)", "O(n\u00b2)", "O(log n)", "O(n log n)"], answer: 0, why: "About 2n or 4n nodes." },
    { kind: "concept", q: "Why can a segment tree answer min queries but a basic Fenwick tree cannot?", options: ["A Fenwick tree relies on subtracting values, and min cannot be undone by subtraction", "Fenwick trees are slower", "Min needs sorting", "Fenwick trees store only pairs"], answer: 0, why: "Range sums are reversible with prefix differences; min is not." },
  ],
  nextNote: "Next, **Sparse Table** gives O(1) range minimum and maximum queries when the data never changes.",
};
