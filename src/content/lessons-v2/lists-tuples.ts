import type { LessonV2 } from "../lesson-types";

const naive = String.raw`score1 = 72
score2 = 90
score3 = 85
best = score1
if score2 > best:
    best = score2
if score3 > best:
    best = score3
print(best)   # 90`;
const ops = String.raw`a = [3, 1, 2]
a.append(5)
a.extend([7, 8])
a.insert(0, 9)
print(a)   # [9, 3, 1, 2, 5, 7, 8]
print(a.pop(), a.pop(0))   # 8 9
print(a)   # [3, 1, 2, 5, 7]
a.remove(2)
print(a)   # [3, 1, 5, 7]
print(a.index(5), a.count(1), 7 in a)   # 2 1 True
a.sort(reverse=True)
print(a)   # [7, 5, 3, 1]
print(sorted(a), a)   # [1, 3, 5, 7] [7, 5, 3, 1]
print(a + [0], a * 2)   # [7, 5, 3, 1, 0] [7, 5, 3, 1, 7, 5, 3, 1]`;
const alias = String.raw`a = [1, 2, 3]
b = a
c = a[:]
a.append(4)
print(a, b, c)   # [1, 2, 3, 4] [1, 2, 3, 4] [1, 2, 3]
nested = [[0] * 2 for _ in range(2)]
shallow = nested[:]
shallow[0][0] = 9
print(nested)   # [[9, 0], [0, 0]]`;
const comp = String.raw`squares = [x * x for x in range(1, 6)]
print(squares)   # [1, 4, 9, 16, 25]
evens = [x for x in range(10) if x % 2 == 0]
print(evens)   # [0, 2, 4, 6, 8]
pairs = [(i, j) for i in range(2) for j in range(2)]
print(pairs)   # [(0, 0), (0, 1), (1, 0), (1, 1)]
first, *rest = [1, 2, 3, 4]
print(first, rest)   # 1 [2, 3, 4]
grid = [[1, 2, 3], [4, 5, 6]]
print([row[1] for row in grid])   # [2, 5]
print([x for row in grid for x in row])   # [1, 2, 3, 4, 5, 6]`;
const tup = String.raw`point = (3, 4)
x, y = point
print(x, y)   # 3 4
print(point[0], len(point))   # 3 2
single = (7,)
print(type(single).__name__, type((7)).__name__)   # tuple int

def min_max(a):
    return min(a), max(a)

lo, hi = min_max([4, 9, 2])
print(lo, hi)   # 2 9
seen = {(0, 1): "a"}
print(seen[(0, 1)])   # a
a, b = 1, 2
a, b = b, a
print(a, b)   # 2 1
try:
    point[0] = 9
except TypeError:
    print("tuples cannot change")   # tuples cannot change`;
const runner = String.raw`def runner_up(scores):
    top = max(scores)
    return max(x for x in scores if x != top)

print(runner_up([2, 3, 6, 6, 5]))   # 5
print(runner_up([4, 4, 1]))   # 1`;
const sums = String.raw`def sums(m):
    rows = [sum(r) for r in m]
    cols = [sum(c) for c in zip(*m)]
    return rows, cols

print(sums([[1, 2, 3], [4, 5, 6]]))   # ([6, 15], [5, 7, 9])`;

export const listsTuples: LessonV2 = {
  topic: "lists-tuples", depth: "complete", minutes: 35,
  hook: "Hold many values under one name, in a changeable list or a fixed tuple, and process them with one loop instead of one variable each.",
  objectives: [
    "Create lists and tuples, and say which can change and why that matters.",
    "Use indexing, slicing, and the common list methods, and know which are slow.",
    "Copy a list correctly and explain why `b = a` does not copy.",
    "Write list comprehensions and unpack lists and tuples into variables.",
    "Choose between a list and a tuple, including when a tuple is needed as a dictionary key.",
  ],
  prereqNote: "Python Basics: variables, loops and `range`.",
  sections: [
    { kind: "intuition", id: "shelf", title: "A shelf of numbered boxes, and a sealed envelope",
      paras: ["A **list** is a shelf of numbered boxes. You can look in any box by its number, swap what is inside, add a box at the end, or take one away.",
        "A **tuple** is the same shelf, but sealed once built: you can read every box and never change one. That sounds like a limitation, and it is the point. A sealed pair like a point `(3, 4)` cannot be altered by accident, and that is exactly what lets Python use it as a lookup key."] },
    { kind: "naive", id: "naive", title: "One variable per value",
      paras: ["With only single variables you would store three scores as `score1`, `score2`, `score3` and compare them with an `if` for each.",
        "It works for three scores. For three hundred you would need three hundred names and three hundred ifs, and the code cannot use a loop because you cannot say “the next variable”. A list lets you say `scores[i]` and loop over `i`."],
      code: naive,
      cost: "Code length grows with every value, and the code cannot loop over the values." },
    { kind: "concept", id: "concept", title: "Lists and tuples side by side",
      paras: ["Both are ordered sequences with indices starting at 0. They differ in one thing: whether you may change them."],
      bullets: ["**List:** written `[1, 2, 3]`. **Mutable**: you can change items, add and remove them.", "**Tuple:** written `(1, 2, 3)`. **Immutable**: once created it cannot change. Because of that it is **hashable**, so it can be a dictionary key or a set member (lists cannot).", "A tuple with one item needs a trailing comma: `(7,)`. Without it, `(7)` is just the number 7 in brackets.", "**Indexing:** `a[i]`, negative indices count from the end. **Slicing:** `a[start:stop:step]` makes a new sequence, excluding `stop`.", "**Unpacking:** `x, y = point` splits a sequence into variables; `first, *rest = a` takes the first item and collects the remainder.", "Rule of thumb: use a **list** for a collection that grows or changes, and a **tuple** for a fixed group of related values (a coordinate, an (x, y), a returned pair)."] },
    { kind: "viz", id: "viz-slice", title: "Slicing: which items does each form pick?", viz: "list-slicing",
      paras: ["Step through five slice forms on one list. The highlighted boxes are the items chosen and the row below shows the new list that results. Pay attention to the stop index (excluded), to negative starts, and to the step of -1 that reverses."] },
    { kind: "example", id: "example", title: "Slice rules on a six-item list",
      paras: ["For `a = [10, 20, 30, 40, 50, 60]` the indices are 0 to 5, or -6 to -1."],
      table: { head: ["expression", "meaning", "result"], rows: [["a[1:4]", "indices 1, 2, 3", "[20, 30, 40]"], ["a[:3]", "from the start up to index 3", "[10, 20, 30]"], ["a[-2:]", "the last two", "[50, 60]"], ["a[::2]", "every second item", "[10, 30, 50]"], ["a[::-1]", "backwards", "[60, 50, 40, 30, 20, 10]"], ["a[4:100]", "out-of-range stop is fine", "[50, 60]"]] },
      steps: [{ title: "Slices never raise errors", body: "An out-of-range slice just gives a shorter (maybe empty) list, but an out-of-range **index** like `a[6]` raises IndexError." }, { title: "Length of a slice", body: "For step 1, the length is `stop − start` (clipped to the list). `a[1:4]` has 3 items." }] },
    { kind: "code", id: "code-ops", title: "The list operations you will use daily",
      paras: ["Read this as a conversation with one list. Predict every output, especially which methods return something and which only change the list."],
      code: ops,
      walkthrough: ["`append` adds one item at the end; `extend` adds every item of another list; `insert(0, x)` puts an item at the front and shifts the rest (slow for big lists).", "`pop()` removes and returns the **last** item, `pop(0)` the first. `remove(2)` deletes the first item **equal to** 2, not the item at index 2.", "`a.sort()` changes the list in place and returns `None`. `sorted(a)` returns a new sorted list and leaves `a` alone (the output shows both).", "`+` makes a new longer list and `*` repeats a list. Neither changes `a`."] },
    { kind: "code", id: "code-alias", title: "Copies, and the aliasing trap",
      paras: ["`b = a` does not copy a list: it gives the same list a second name. Slicing (`a[:]`) makes a **shallow** copy: a new outer list, but any inner lists are still shared."],
      code: alias,
      walkthrough: ["`b = a` and `a` are one list, so appending through `a` shows up in `b`. `c = a[:]` was copied before the append, so it is unaffected.", "In `nested`, the outer list was copied but the two inner lists were not. Changing `shallow[0][0]` therefore changes `nested` too. For fully independent copies use `copy.deepcopy`.", "The comprehension `[[0] * 2 for _ in range(2)]` builds a fresh inner list each time. `[[0] * 2] * 2` would reuse the same inner list twice, and is the classic way to break a 2D grid."] },
    { kind: "code", id: "code-comp", title: "Comprehensions and unpacking",
      paras: ["A **list comprehension** builds a list from a loop in one expression: `[expression for item in collection if condition]`. Read it as “the expression, for each item, but only if the condition holds”."],
      code: comp,
      walkthrough: ["`[x * x for x in range(1, 6)]` is the loop-and-append pattern in one line.", "The `if` at the end filters; two `for` clauses make a nested loop, with the outer loop first.", "`first, *rest = ...` assigns the first item to `first` and the remaining items (as a list) to `rest`.", "`[row[1] for row in grid]` takes column 1 of a grid. The double-`for` version flattens a grid into one list."] },
    { kind: "code", id: "code-tuples", title: "Tuples in practice",
      paras: ["Tuples appear everywhere without you noticing: a function that returns two values returns a tuple, and swapping two variables uses one."],
      code: tup,
      walkthrough: ["`x, y = point` unpacks the tuple into two names. A function can return several values at once (`return min(a), max(a)`) and the caller unpacks them.", "`(7,)` is a tuple, `(7)` is the number 7. The trailing comma is what makes the tuple.", "A tuple can be a dictionary key (`seen[(0, 1)]`), which is how grid coordinates are used as keys. A list could not.", "`a, b = b, a` swaps without a temporary variable: the right side is built first, then assigned.", "Assigning to a tuple item raises TypeError, which the `try`/`except` catches and reports."] },
    { kind: "complexity", id: "complexity", title: "What list operations cost",
      rows: [
        { what: "`a[i]`, `a[i] = x`, `len(a)`", time: "O(1)", space: "O(1)", why: "Items sit side by side, so any position is reached by arithmetic." },
        { what: "`a.append(x)`, `a.pop()`", time: "O(1) amortised", space: "O(1)", why: "Only the end changes. Occasional resizing averages out." },
        { what: "`a.insert(0, x)`, `a.pop(0)`, `del a[i]`", time: "O(n)", space: "O(1)", why: "Every later item must shift one place." },
        { what: "`x in a`, `a.index(x)`, `a.count(x)`, `a.remove(x)`", time: "O(n)", space: "O(1)", why: "They scan until they find a match, or to the end." },
        { what: "Slice `a[l:r]`, copy `a[:]`", time: "O(r − l)", space: "O(r − l)", why: "A new list is built and the items are copied." },
        { what: "`a.sort()`, `sorted(a)`", time: "O(n log n)", space: "O(1) / O(n)", why: "Efficient comparison sort. `sorted` also builds a new list." },
        { what: "List comprehension over n items", time: "O(n)", space: "O(n)", why: "One pass, one new list." }] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Empty list", handle: "`a[0]`, `max(a)` and `a.pop()` raise errors. Check `if a:` first." }, { case: "Index out of range", handle: "Valid indices are `0` to `len(a) - 1` (or `-len(a)` to `-1`). Slices clip silently; indices raise IndexError." }, { case: "Changing a list while looping over it", handle: "Removing items inside `for x in a` skips elements. Loop over a copy (`for x in a[:]`) or build a new list." }, { case: "One-item tuple", handle: "Write `(7,)`, not `(7)`." }, { case: "List as a dictionary key or set member", handle: "TypeError: lists are unhashable. Convert to a tuple first." }, { case: "Sorting a list that mixes types", handle: "`[3, \"a\"]` cannot be sorted: Python will not compare a number with text." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "`b = a` and expecting an independent copy.", fix: "Use `b = a[:]` or `list(a)` (and `deepcopy` for nested lists)." }, { mistake: "Writing `a = a.sort()`.", fix: "`sort()` returns None. Call `a.sort()` alone, or write `a = sorted(a)`." }, { mistake: "Building a grid with `[[0] * c] * r`.", fix: "Use `[[0] * c for _ in range(r)]`." }, { mistake: "Using `a.pop(0)` or `a.insert(0, x)` in a big loop.", fix: "Each call is O(n). Use `collections.deque`, or restructure." }, { mistake: "Confusing `remove(x)` (by value) with `pop(i)` (by index).", fix: "Say it aloud: remove a *value*, pop at a *position*." }] },
    { kind: "recognize", id: "recognize", title: "How to spot when to use which",
      signals: ["You have **many values of the same kind** to process one by one: a list and a loop.", "The collection **grows or changes** as you work (adding results, removing finished items): a list.", "A **fixed group** such as a coordinate, a pair (value, index), or a returned result: a tuple.", "You need a **compound key** like `(row, col)` for a dictionary or a set: a tuple.", "You want to **transform or filter** a sequence in one pass: a list comprehension."],
      notThis: ["You test membership many times (`x in a`): a set is far faster.", "You add or remove at the front repeatedly: a deque is better.", "You need a value attached to each name: that is a dictionary."] },
    { kind: "worked", id: "worked-runner", title: "The runner-up score",
      problem: "Given a list of scores that may contain duplicates, return the second-highest **distinct** score. Assume at least two distinct values exist.",
      approach: ["The highest score is `max(scores)`.", "Remove every copy of the highest score by filtering: keep values not equal to it.", "The maximum of what remains is the runner-up. A single `max` over a comprehension does the filtering and finding together."],
      code: runner,
      takeaway: "Filtering with a comprehension (`x for x in scores if x != top`) is more robust than sorting and indexing: with duplicates like `[6, 6, 5]`, the second item in sorted order would still be 6." },
    { kind: "worked", id: "worked-sums", title: "Row sums and column sums of a grid",
      problem: "Given a grid (a list of equal-length rows), return the sum of each row and the sum of each column.",
      approach: ["Row sums are easy: `sum(row)` for each row.", "Columns are harder because the grid is stored by rows. `zip(*grid)` regroups the grid by columns: the first items of every row, then the second items, and so on.", "Then `sum(col)` for each regrouped column."],
      code: sums,
      takeaway: "`zip(*grid)` is the Python idiom for transposing. Knowing it saves a nested loop and a likely off-by-one." },
  ],
  cheatSheet: [{ label: "List / tuple", value: "[1, 2] changeable · (1, 2) fixed and hashable · (7,) for one item" }, { label: "Slice", value: "a[start:stop:step]; stop excluded; clips silently" }, { label: "In place vs new", value: "a.sort() → None · sorted(a) → new list" }, { label: "Copy", value: "a[:] or list(a); deepcopy for nested" }, { label: "Comprehension", value: "[expr for x in xs if cond]" }, { label: "Slow ops", value: "insert(0), pop(0), in, index, remove: all O(n)" }],
  summary: ["A list holds many values you can change; a tuple holds a fixed group that cannot change and can be a dictionary key.", "Indices start at 0, negatives count from the end, and slices exclude the stop and never raise errors.", "`b = a` aliases; copy with `a[:]` or `list(a)`, and beware shallow copies of nested lists.", "Comprehensions and unpacking turn common loops into one expression.", "Know which operations are O(n): inserting at the front, `in`, `index`, `remove`."],
  checks: [
    { kind: "trace", q: "For `a = [10, 20, 30, 40, 50, 60]`, what is `a[-2:]`?", options: ["[50]", "[50, 60]", "[40, 50]", "[60]"], answer: 1, why: "A negative start counts from the end: -2 is index 4, and with no stop the slice runs to the end." },
    { kind: "concept", q: "After `a = [1, 2]; b = a; a.append(3)`, what is `b`?", options: ["[1, 2]", "[1, 2, 3]", "[3]", "An error"], answer: 1, why: "`b = a` gives the same list a second name, so both see the append." },
    { kind: "concept", q: "What does `x = [3, 1, 2].sort()` store in `x`?", options: ["[1, 2, 3]", "[3, 1, 2]", "None", "An error"], answer: 2, why: "`list.sort()` changes the list in place and returns None." },
    { kind: "recognize", q: "Which needs a tuple rather than a list?", options: ["A growing list of results", "A (row, column) pair used as a dictionary key", "A queue of tasks", "A list of names to sort"], answer: 1, why: "Dictionary keys must be hashable, and tuples are while lists are not." },
    { kind: "complexity", q: "Which operation is O(n) on a list of n items?", options: ["`a[5]`", "`a.append(x)`", "`a.insert(0, x)`", "`len(a)`"], answer: 2, why: "Inserting at the front shifts every existing item one place." },
    { kind: "trace", q: "What does `[x for x in range(10) if x % 3 == 0]` produce?", options: ["[3, 6, 9]", "[0, 3, 6, 9]", "[0, 3, 6]", "[1, 4, 7]"], answer: 1, why: "It keeps values from 0 to 9 divisible by 3: 0, 3, 6 and 9." },
    { kind: "trace", q: "With `a = [1, 2, 3]`, then `b = a` and `b.append(4)`, what is `len(a)`?", options: ["3", "4", "1", "It raises an error"], answer: 1, why: "b and a name the same list, so the append is visible through a too: the length is 4." },
    { kind: "trace", q: "What is `type((1,)).__name__`?", options: ["int", "list", "tuple", "set"], answer: 2, why: "A trailing comma makes a tuple, even inside parentheses." },
    { kind: "trace", q: "What does `[1, 2, 3][::-1]` give?", options: ["[3, 2, 1]", "[1, 2, 3]", "[2, 1]", "[3, 2]"], answer: 0, why: "A step of -1 walks the list backwards, from the end to the start." },
    { kind: "concept", q: "Why can't a list be used as a dictionary key?", options: ["Lists can change, so their hash could change", "Lists are too large", "Lists are unordered", "Dictionary keys must be numbers"], answer: 0, why: "Dictionary keys must be hashable. A list that can change has no stable hash, so Python refuses it." },
  ],
  nextNote: "Next, **Sets & Dictionaries** give you containers that look things up by value in constant time.",
};
