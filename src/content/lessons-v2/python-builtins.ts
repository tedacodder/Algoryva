import type { LessonV2 } from "../lesson-types";

const naive = String.raw`def my_max_with_index(a):
    best, where = a[0], 0
    for i in range(1, len(a)):
        if a[i] > best:
            best, where = a[i], i
    return best, where

names = ["ana", "ben", "cy"]
scores = [90, 85, 72]
i = 0
pairs = []
while i < len(names):
    pairs.append((names[i], scores[i]))
    i += 1

print(my_max_with_index([4, 9, 2, 9]))   # (9, 1)
print(pairs)   # [('ana', 90), ('ben', 85), ('cy', 72)]`;
const builtins = String.raw`a = [4, 9, 2, 7]
print(len(a), sum(a), min(a), max(a))   # 4 22 2 9
print(sorted(a), list(reversed(a)))   # [2, 4, 7, 9] [7, 2, 9, 4]
print(max(a, key=lambda x: -x))   # 2
print(list(enumerate(["a", "b"], start=1)))   # [(1, 'a'), (2, 'b')]
print(list(zip([1, 2, 3], "ab")))   # [(1, 'a'), (2, 'b')]
print(dict(zip(["x", "y"], [10, 20])))   # {'x': 10, 'y': 20}
print(list(map(str, [1, 2, 3])))   # ['1', '2', '3']
print(list(filter(lambda x: x > 3, a)))   # [4, 9, 7]
print(any(x > 8 for x in a), all(x > 1 for x in a))   # True True
print(divmod(17, 5), abs(-3), pow(2, 10, 1000))   # (3, 2) 3 24
print(round(2.675, 2), round(7.5), round(8.5))   # 2.67 8 8
print(min([], default=-1))   # -1`;
const iters = String.raw`it = iter([10, 20, 30])
print(next(it), next(it))   # 10 20
print(list(it))   # [30]
print(list(it))   # []

def countdown(n):
    while n > 0:
        yield n
        n -= 1

print(list(countdown(3)))   # [3, 2, 1]
total = sum(x * x for x in range(1, 1001))
print(total)   # 333833500
gen = (x * 2 for x in range(3))
print(next(gen), next(gen), next(gen))   # 0 2 4
print(next(gen, "done"))   # done`;
const classes = String.raw`class Stack:
    def __init__(self):
        self.items = []

    def push(self, x):
        self.items.append(x)

    def pop(self):
        return self.items.pop()

    def __len__(self):
        return len(self.items)

    def __repr__(self):
        return f"Stack({self.items})"

s = Stack()
s.push(1)
s.push(2)
print(s)   # Stack([1, 2])
print(s.pop(), len(s))   # 2 1
print(bool(len(s)))   # True`;
const anagram = String.raw`from collections import Counter

def min_steps_anagram(s, t):
    diff = Counter(s) - Counter(t)
    return sum(diff.values())

print(min_steps_anagram("bab", "aba"))   # 1
print(min_steps_anagram("leetcode", "practice"))   # 5
print(min_steps_anagram("anagram", "mangaar"))   # 0`;
const major = String.raw`from collections import Counter

def majority(a):
    return Counter(a).most_common(1)[0][0]

print(majority([3, 2, 3]))   # 3
print(majority([2, 2, 1, 1, 1, 2, 2]))   # 2`;

export const pythonBuiltins: LessonV2 = {
  topic: "python-builtins", depth: "complete", minutes: 40,
  hook: "The standard toolbox (built-in functions, iterators and a first look at classes) that replaces dozens of hand-written loops.",
  objectives: [
    "Use `len`, `sum`, `min`, `max`, `sorted`, `reversed`, `enumerate`, `zip`, `map`, `filter`, `any` and `all` fluently.",
    "Explain what an iterator is, why it can be used only once, and what a generator saves.",
    "Write a small class with `__init__`, methods, `__len__` and `__repr__`.",
    "Use `Counter` from the standard library for counting problems.",
    "Choose a built-in over a hand-written loop and know what it costs.",
  ],
  prereqNote: "Lists & Tuples and Sets & Dictionaries: the built-ins operate on those containers.",
  sections: [
    { kind: "intuition", id: "toolbox", title: "A well-stocked toolbox",
      paras: ["You can drive a nail with a rock, but a hammer is faster, safer and every carpenter recognises it. Python ships with a toolbox of small, well-tested functions for jobs you meet constantly: adding things up, finding the biggest, sorting, pairing lists together.",
        "Using them makes code shorter, **less likely to contain off-by-one errors**, and easier for others (and you, next week) to read."] },
    { kind: "naive", id: "naive", title: "Writing every loop by hand",
      paras: ["Without the toolbox, even small jobs become index juggling: finding the largest item *and where it is*, or pairing two lists, each needs a counter, a bound check and an update.",
        "Every one of those lines is a chance for an off-by-one error (`range(1, len(a))` or `len(a) - 1`?). The built-ins do the same work with the loop already written and tested."],
      code: naive,
      cost: "Same speed, but more code, more places for index bugs, and harder to read." },
    { kind: "concept", id: "concept", title: "The built-ins worth knowing",
      paras: ["Most work on any **iterable**: anything you can loop over (lists, tuples, strings, sets, dictionaries, `range`, files)."],
      bullets: ["**Aggregates:** `len`, `sum`, `min`, `max`. `max(a, key=f)` picks the item with the largest `f(item)`; `min([], default=-1)` avoids an error on empty input.", "**Ordering:** `sorted(a, key=..., reverse=...)` returns a new list; `reversed(a)` walks backwards (wrap in `list(...)` to see it).", "**Pairing and numbering:** `enumerate(a, start=1)` gives `(index, item)`; `zip(a, b)` gives pairs and stops at the shorter one.", "**Transform and test:** `map(f, a)` applies `f`; `filter(f, a)` keeps items where `f` is true; `any(...)` and `all(...)` ask “is at least one / every item true?”.", "**Numbers:** `abs`, `divmod(a, b)` (quotient and remainder together), `pow(a, b, m)` (modular power), `round`.", "**Iterator vs list:** `map`, `filter`, `zip`, `enumerate` and `reversed` return **lazy iterators**; wrap in `list(...)` to materialise them."] },
    { kind: "viz", id: "viz-zip", title: "zip: walking two lists in step", viz: "zip-pairs",
      paras: ["`zip` pairs the items at the same position and hands them out one pair at a time. Step through and watch the highlighted pair move along both lists together. Because `zip` stops at the shorter list, unequal lengths never cause an error."] },
    { kind: "example", id: "example", title: "Choosing the right tool",
      paras: ["Each row is a task you would otherwise write a loop for."],
      table: { head: ["task", "one-liner", "replaces"], rows: [["total of a list", "sum(a)", "an accumulator loop"], ["position and item", "for i, x in enumerate(a)", "`range(len(a))` plus `a[i]`"], ["pair two lists", "zip(names, scores)", "an index loop over both"], ["longest word", "max(words, key=len)", "tracking best and best length"], ["any negative?", "any(x < 0 for x in a)", "a flag variable and a `break`"], ["count of each item", "Counter(a)", "a dictionary-and-`get` loop"]] },
      steps: [{ title: "A pattern in the right column", body: "Every “replaces” entry is a loop with a small piece of state. The built-in packages that state so you cannot get it wrong." }, { title: "`key=` is the powerful parameter", body: "`sorted`, `min` and `max` all accept `key=f`. The function `f` says *what to compare by*, so `max(words, key=len)` returns the longest word, not the alphabetically last." }] },
    { kind: "code", id: "code-builtins", title: "The built-ins in action",
      paras: ["Predict each result before reading the comment. Notice how often the answer needs `list(...)` to display."],
      code: builtins,
      walkthrough: ["`max(a, key=lambda x: -x)` compares by the negative value, so the item whose negative is largest wins: the **smallest** item, 2. A `lambda` is a tiny anonymous function.", "`zip([1, 2, 3], \"ab\")` stops after two pairs because `\"ab\"` is shorter. `dict(zip(keys, values))` is the idiom for building a dictionary from two lists.", "`divmod(17, 5)` returns `(3, 2)`: quotient and remainder in one call. `pow(2, 10, 1000)` is `2**10 % 1000`, computed efficiently, which matters for huge exponents.", "`round(7.5)` and `round(8.5)` both give 8: Python rounds exact halves to the **nearest even** number (banker's rounding). `round(2.675, 2)` gives 2.67 because 2.675 is stored as slightly less than itself.", "`min([], default=-1)` returns the default instead of raising ValueError on an empty list."] },
    { kind: "code", id: "code-iters", title: "Iterators and generators",
      paras: ["An **iterator** hands out items one at a time with `next()`, remembering where it is. A **generator** is an iterator you write with `yield`, or with an expression in parentheses. Neither builds the whole sequence in memory."],
      code: iters,
      walkthrough: ["After two `next(it)` calls, `list(it)` only gets what is left (`[30]`), and a **second** `list(it)` is empty: an iterator is **used up** once consumed. Keep a list if you need to loop twice.", "`yield` pauses the function and hands a value out; on the next request it resumes just after the `yield`. `countdown(3)` produces 3, 2, 1 without ever building a list.", "`sum(x * x for x in range(1, 1001))` squares and adds one number at a time, so memory use is constant: contrast with `sum([x * x for x in ...])`, which builds the full list first.", "`next(gen, \"done\")` returns the default instead of raising StopIteration when the generator is finished."] },
    { kind: "code", id: "code-class", title: "A first class",
      paras: ["A **class** bundles data with the functions that work on it. `__init__` runs when you create an object; methods take `self` (the object itself) as their first parameter. Special “dunder” methods let your class work with built-ins: `__len__` powers `len(obj)`, `__repr__` controls how it prints."],
      code: classes,
      walkthrough: ["`Stack()` creates an object and runs `__init__`, which gives it its own empty list in `self.items`.", "`push` and `pop` are methods; `s.push(1)` is the same as `Stack.push(s, 1)`, which is why `self` comes first.", "`__repr__` makes `print(s)` show `Stack([1, 2])` instead of a cryptic memory address.", "Because `__len__` exists, `len(s)` works, and `bool(len(s))` is truthy while the stack is non-empty. In contests you rarely need classes, but they appear in linked-list and tree problems (`ListNode`, `TreeNode`)."] },
    { kind: "complexity", id: "complexity", title: "What the built-ins cost",
      rows: [
        { what: "`len`", time: "O(1)", space: "O(1)", why: "Containers store their size." },
        { what: "`sum`, `min`, `max`, `any`, `all`", time: "O(n)", space: "O(1)", why: "They scan the items once. `any`/`all` stop early when the answer is decided." },
        { what: "`sorted`", time: "O(n log n)", space: "O(n)", why: "A comparison sort on a new list." },
        { what: "`enumerate`, `zip`, `map`, `filter`, `reversed`", time: "O(1) to create, O(n) to consume", space: "O(1)", why: "They are lazy: nothing happens until you iterate." },
        { what: "`list(zip(a, b))` and other materialisation", time: "O(n)", space: "O(n)", why: "Building the list copies every pair." },
        { what: "Generator expression vs list comprehension", time: "same", space: "O(1) vs O(n)", why: "A generator produces one item at a time; a list holds them all." },
        { what: "`Counter(a)`", time: "O(n)", space: "O(distinct)", why: "One pass of dictionary updates." }] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "`min` / `max` of an empty sequence", handle: "Raises ValueError. Pass `default=...` or check emptiness first." }, { case: "`zip` with lists of different lengths", handle: "It silently stops at the shorter one. Use `itertools.zip_longest` if you need every item." }, { case: "Using an iterator twice", handle: "The second pass sees nothing. Convert to a list first if you need two passes." }, { case: "`map`/`filter` results printed directly", handle: "`print(map(...))` shows an object, not the values. Wrap in `list(...)`." }, { case: "`round` on halves", handle: "Python rounds to the nearest even number, so `round(2.5)` is 2. Do not use it to “round half up”." }, { case: "Dictionary or set passed to `sorted`", handle: "You get a sorted list of the keys (or items), not a sorted dictionary." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Looping with `range(len(a))` when you only need the items.", fix: "Write `for x in a`. Use `enumerate` when you need the index too." }, { mistake: "Printing a `map`, `zip` or `filter` and wondering what the output means.", fix: "They are lazy. Wrap in `list(...)`." }, { mistake: "Consuming an iterator and then reusing it.", fix: "Store the results in a list if you need them again." }, { mistake: "Writing `max(a)` when you wanted the *index* of the maximum.", fix: "Use `max(range(len(a)), key=lambda i: a[i])`, or `a.index(max(a))`." }, { mistake: "Forgetting `self` in a method definition or call.", fix: "Methods are `def name(self, ...)`; call them as `obj.name(...)`." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a built-in opportunity",
      signals: ["You are about to write a loop whose only job is to **add up, count, find the biggest or smallest, or check a condition**.", "You need to **walk two lists together**, or number items while looping: `zip` and `enumerate`.", "A problem asks you to **count occurrences or compare multisets** of letters or numbers: `Counter`.", "You need the **smallest, largest or best item by some measure**: `min`/`max`/`sorted` with `key=`.", "You are processing a **huge stream** and cannot afford a full list in memory: a generator expression."],
      notThis: ["You need random access or repeated passes over the same data: keep a list, not an iterator.", "The built-in would hide a cost you must control, such as `sorted` inside a loop: write the algorithm explicitly."] },
    { kind: "worked", id: "worked-anagram", title: "Fewest changes to make two strings anagrams",
      problem: "Strings `s` and `t` have equal length. In one step you may replace any character of `t` with any other. Return the minimum number of steps to make `t` an anagram of `s`.",
      approach: ["Two strings are anagrams when each letter appears equally often in both.", "Count the letters in each string. `Counter(s) - Counter(t)` keeps only the letters `s` has **more** of than `t`.", "Each surplus letter in `s` must be matched by one replacement in `t`, so the answer is the total of those surpluses."],
      code: anagram,
      takeaway: "Counter subtraction is a built-in way to ask “what does s have that t lacks?”. One line replaces two dictionaries and a comparison loop. The third call returns 0 because the strings are already anagrams." },
    { kind: "worked", id: "worked-majority", title: "The majority element",
      problem: "A list has a value that appears more than half the time. Return that value.",
      approach: ["Count how often each value appears with `Counter`.", "`most_common(1)` returns a list holding the single most frequent `(value, count)` pair.", "Take the value from the first pair: `[0][0]`."],
      code: major,
      takeaway: "`Counter(a).most_common(1)[0][0]` reads inside out: count, take the top one, take its pair, take its value. It is O(n) time and O(distinct values) memory. (A trick called Boyer–Moore voting does it in O(1) memory, a good follow-up once the basics feel natural.)" },
  ],
  cheatSheet: [{ label: "Aggregates", value: "len · sum · min · max (key=, default=)" }, { label: "Ordering", value: "sorted(a, key=f, reverse=True) · reversed(a)" }, { label: "Pairing", value: "enumerate(a, start=1) · zip(a, b) (stops at shorter)" }, { label: "Lazy", value: "map, filter, zip, enumerate, reversed → wrap in list()" }, { label: "Tests", value: "any(...) · all(...)" }, { label: "Counting", value: "Counter(a) · most_common(k) · Counter(a) - Counter(b)" }],
  summary: ["Python's built-ins replace common loops with shorter, tested code: `sum`, `min`, `max`, `sorted`, `enumerate`, `zip`, `any`, `all`.", "`key=` on `sorted`, `min` and `max` says what to compare by.", "`map`, `filter`, `zip` and `enumerate` are lazy iterators: wrap in `list(...)` to see them, and note they are used up once consumed.", "A generator produces values one at a time and keeps memory flat.", "Classes bundle data and methods; dunder methods like `__len__` and `__repr__` connect them to built-ins."],
  checks: [
    { kind: "trace", q: "What does `list(zip([1, 2, 3], \"ab\"))` return?", options: ["[(1, 'a'), (2, 'b'), (3, None)]", "[(1, 'a'), (2, 'b')]", "[(1, 'a')]", "An error"], answer: 1, why: "`zip` stops when the shorter input runs out, so there are only two pairs." },
    { kind: "concept", q: "What happens if you call `list(it)` twice on the same iterator?", options: ["Both give the same list", "The second call gives an empty list, because the iterator was consumed", "The second call raises an error", "It restarts automatically"], answer: 1, why: "An iterator remembers its position and cannot rewind. Once used up it yields nothing." },
    { kind: "trace", q: "`max([\"pear\", \"fig\", \"banana\"], key=len)` returns:", options: ["\"pear\"", "\"fig\"", "\"banana\"", "\"pear\" (alphabetically last)"], answer: 2, why: "`key=len` compares by length, and \"banana\" is the longest." },
    { kind: "complexity", q: "Why is `sum(x * x for x in range(1000000))` friendlier to memory than `sum([x * x for x in range(1000000)])`?", options: ["It is not", "The generator makes one value at a time instead of building a million-item list", "It uses a faster algorithm", "Lists cannot be summed"], answer: 1, why: "The generator expression is lazy, so memory stays constant, while the list comprehension holds all values at once." },
    { kind: "recognize", q: "“Count how many of each letter appear in a string” suggests:", options: ["`Counter(s)`", "`sorted(s)`", "`zip(s, s)`", "`reversed(s)`"], answer: 0, why: "`Counter` is the built-in tool for counting occurrences." },
    { kind: "trace", q: "What does `round(8.5)` return in Python?", options: ["9", "8", "8.5", "10"], answer: 1, why: "Python rounds exact halves to the nearest even number, so 8.5 becomes 8 (and 7.5 becomes 8)." },
    { kind: "trace", q: "What does `sorted([3, 1, 2], reverse=True)` return?", options: ["[3, 2, 1]", "[1, 2, 3]", "[2, 1, 3]", "[3, 1, 2]"], answer: 0, why: "sorted returns a new list; reverse=True sorts from largest to smallest." },
    { kind: "trace", q: "What does `list(zip([1, 2], 'ab'))` give?", options: ["[(1, 'a'), (2, 'b')]", "[1, 2, 'a', 'b']", "[(1, 2), ('a', 'b')]", "It raises an error"], answer: 0, why: "zip pairs items from each iterable, stopping at the shorter one." },
    { kind: "trace", q: "What does `list(map(str, [1, 2]))` give?", options: ["['1', '2']", "[1, 2]", "['a', 'b']", "['12']"], answer: 0, why: "map applies str to each number, turning 1 and 2 into text." },
    { kind: "concept", q: "What does an `__init__` method do?", options: ["Runs when an object is created, to set its starting values", "Deletes an object", "Converts an object into text", "Makes a class iterable"], answer: 0, why: "__init__ is the constructor: Python calls it when you create an instance of the class." },
  ],
  nextNote: "Next, **Best Coding Practices** covers the habits (naming, testing, fast input) that keep contest code correct.",
};
