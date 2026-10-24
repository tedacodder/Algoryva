import type { LessonV2 } from "../lesson-types";

const naive = String.raw`def common_naive(a, b):
    out = []
    for x in a:
        if x in b:          # scans the whole list b every time
            out.append(x)
    return out

print(common_naive([1, 2, 3, 4], [3, 4, 5]))   # [3, 4]`;
const sets = String.raw`a, b = {1, 2, 3, 4}, {3, 4, 5}
print(sorted(a | b))   # [1, 2, 3, 4, 5]
print(sorted(a & b))   # [3, 4]
print(sorted(a - b))   # [1, 2]
print(sorted(a ^ b))   # [1, 2, 5]
print(3 in a, 9 in a)   # True False
print(len(set([1, 1, 2, 2, 3])))   # 3
print(sorted(set("banana")))   # ['a', 'b', 'n']
a.add(10)
a.discard(1)
a.discard(99)
print(sorted(a))   # [2, 3, 4, 10]
print(a.issubset({2, 3, 4, 10, 11}))   # True`;
const dicts = String.raw`ages = {"ana": 31, "ben": 25}
ages["cy"] = 40
print(ages["ben"], ages.get("zed"), ages.get("zed", 0))   # 25 None 0
print(len(ages), "ana" in ages, "zed" in ages)   # 3 True False
print(list(ages.items()))   # [('ana', 31), ('ben', 25), ('cy', 40)]
del ages["ben"]
print(list(ages))   # ['ana', 'cy']
ages["ana"] += 1
print(ages["ana"])   # 32
try:
    print(ages["zed"])
except KeyError:
    print("missing key")   # missing key`;
const counting = String.raw`from collections import Counter, defaultdict

print(Counter("banana"))   # Counter({'a': 3, 'n': 2, 'b': 1})
print(Counter("banana").most_common(1))   # [('a', 3)]

freq = {}
for ch in "banana":
    freq[ch] = freq.get(ch, 0) + 1
print(freq)   # {'b': 1, 'a': 3, 'n': 2}

words = ["eat", "tea", "tan", "ate", "nat", "bat"]
groups = defaultdict(list)
for w in words:
    groups["".join(sorted(w))].append(w)
print(list(groups.values()))   # [['eat', 'tea', 'ate'], ['tan', 'nat'], ['bat']]`;
const dup = String.raw`def contains_duplicate(a):
    return len(set(a)) != len(a)

print(contains_duplicate([1, 2, 3, 1]))   # True
print(contains_duplicate([1, 2, 3]))   # False
print(contains_duplicate([]))   # False`;
const uniq = String.raw`from collections import Counter

def first_unique(s):
    c = Counter(s)
    for i, ch in enumerate(s):
        if c[ch] == 1:
            return i
    return -1

print(first_unique("leetcode"))   # 0
print(first_unique("loveleetcode"))   # 2
print(first_unique("aabb"))   # -1`;

export const setsDicts: LessonV2 = {
  topic: "sets-dicts", depth: "complete", minutes: 40,
  hook: "Containers that answer “is this in here?” and “what goes with this key?” in constant time, by jumping straight to where the answer lives.",
  objectives: [
    "Explain what a set and a dictionary store, and when each is the right container.",
    "Describe, in plain terms, how a hash table finds an item without searching, and what a collision is.",
    "Use set operations (union, intersection, difference) and dictionary methods (`get`, `items`, counting, grouping).",
    "Count items with a dictionary, `Counter` or `defaultdict`.",
    "State the cost of the operations (average O(1)) and the rules about hashable keys.",
  ],
  prereqNote: "Python Basics. Lists & Tuples help, because tuples are the usual compound keys.",
  sections: [
    { kind: "intuition", id: "coat-check", title: "A coat check",
      paras: ["At a coat check you hand over your coat and get a numbered ticket. Later you hand over the ticket and the attendant walks **straight to the right hook**, without looking through every coat. That is the whole idea of a hash table.",
        "A **set** is a coat check that only remembers *whether* something is checked in. A **dictionary** also remembers *what belongs with it*: a key (the ticket) leading to a value (the coat)."] },
    { kind: "naive", id: "naive", title: "Searching a list every time",
      paras: ["Task: given two lists, find the values that appear in both. The first idea is to take each item of the first list and ask whether it is in the second list.",
        "Asking `x in b` on a list **scans it from the start** until it finds x or runs out. Doing that for every item of `a` means up to len(a) × len(b) comparisons: for two lists of 100,000 items, about 10 billion."],
      code: naive,
      cost: "O(n × m): every lookup in a list costs O(m)." },
    { kind: "concept", id: "concept", title: "Sets and dictionaries",
      paras: ["Both are built on the same trick (hashing), so they share the same rules and speed."],
      bullets: ["**Set** `{1, 2, 3}`: a collection of **distinct** items with no order. Adding a duplicate does nothing. Built for “is x in here?”.", "**Dictionary** `{\"ana\": 31}`: maps each **key** to a **value**. Keys are distinct; values can repeat. Built for “what goes with this key?”. Since Python 3.7 it remembers insertion order.", "**Hashable:** keys and set members must be hashable, meaning immutable-like: numbers, strings, tuples of those. Lists, sets and dictionaries are **not** hashable.", "**Set algebra:** `|` union, `&` intersection, `-` difference, `^` items in exactly one set.", "**Speed:** adding, removing and testing membership are O(1) on average, compared with O(n) for a list."] },
    { kind: "observation", id: "observation", title: "Compute the address from the key",
      paras: ["A list finds an item by *position*; you must already know where it is. A hash table computes a position **from the item itself**: a *hash function* turns the key into a number, and that number (reduced to the table's size) says which **bucket** to look in. Insert and look-up use the same calculation, so they land in the same place.",
        "Different keys sometimes land in the same bucket: a **collision**. The table copes by keeping a short list in the bucket and checking its few entries. If the hash function spreads keys well, buckets stay short, so a look-up touches only a handful of items regardless of how many are stored."] },
    { kind: "viz", id: "viz-hash", title: "A toy hash table", viz: "hash-buckets",
      paras: ["Five buckets. The toy hash adds the letter codes of the key and takes the remainder mod 5. Watch each key go to its bucket, see one collision, then see two look-ups: one that finds its key after a short scan, and one that proves a key is absent. Python's real hash is far better mixed, but the mechanism is the same."] },
    { kind: "example", id: "example", title: "The toy table by hand",
      paras: ["The hash of a key is the sum of its letter codes mod 5."],
      table: { head: ["key", "letter codes sum", "mod 5", "bucket"], rows: [["cat", "99 + 97 + 116 = 312", "2", "2"], ["dog", "100 + 111 + 103 = 314", "4", "4"], ["owl", "111 + 119 + 108 = 338", "3", "3"], ["hen", "104 + 101 + 110 = 315", "0", "0"], ["ant", "97 + 110 + 116 = 323", "3", "3 (collides with owl)"]] },
      steps: [{ title: "Look up “ant”", body: "Hash to bucket 3. The bucket holds owl, then ant: two comparisons, found." }, { title: "Look up “cow”", body: "Hash to bucket 4. It holds only dog, which is not cow, so cow is absent after one comparison. We never touched the other buckets." }] },
    { kind: "code", id: "code-sets", title: "Sets in code",
      paras: ["Sets shine for removing duplicates, testing membership, and comparing groups."],
      code: sets,
      walkthrough: ["`set([1, 1, 2, 2, 3])` collapses duplicates, so its length is 3. `set(\"banana\")` makes a set of the letters.", "We wrap results in `sorted(...)` because a set has **no guaranteed order**: never rely on the order you see when printing one.", "`discard` removes an item if present and silently does nothing otherwise; `remove` raises KeyError if the item is missing.", "`a | b`, `a & b`, `a - b` and `a ^ b` are the four set operations, each running in time proportional to the sets' sizes."] },
    { kind: "code", id: "code-dicts", title: "Dictionaries in code",
      paras: ["A dictionary maps keys to values. `d[key]` reads a value (and raises KeyError if the key is missing); `d.get(key, default)` is the safe version."],
      code: dicts,
      walkthrough: ["`ages.get(\"zed\")` gives `None` and `ages.get(\"zed\", 0)` gives 0: neither raises an error for a missing key.", "`\"ana\" in ages` tests **keys**, in O(1). `ages.items()` yields `(key, value)` pairs, which you can loop over with `for name, age in ages.items():`.", "Assigning to a new key adds it; assigning to an existing key replaces its value; `ages[\"ana\"] += 1` updates in place.", "Reading a missing key with brackets raises KeyError, which the `try`/`except` here catches."] },
    { kind: "code", id: "code-count", title: "Counting and grouping",
      paras: ["The two most common dictionary jobs: counting how often each item appears, and grouping items under a shared key."],
      code: counting,
      walkthrough: ["`Counter` is a dictionary specialised for counting; `most_common(1)` returns the single most frequent item with its count.", "The hand-written loop does the same: `freq.get(ch, 0) + 1` is the current count, or 0 if the character is new.", "`defaultdict(list)` creates an empty list automatically the first time a key is used, so `groups[key].append(w)` needs no existence check.", "Sorting the letters of a word gives the same key for all anagrams, so words that are anagrams of each other end up in the same group."] },
    { kind: "complexity", id: "complexity", title: "Why average O(1), and what could go wrong",
      rows: [
        { what: "add, remove, `x in s` for set or dict", time: "O(1) average", space: "O(n)", why: "Hash the key, jump to its bucket, and compare a few entries." },
        { what: "worst case of those operations", time: "O(n)", space: "-", why: "If many keys collided into one bucket, look-ups would scan a long list. Python randomises string hashing, but integers hash to themselves, and some contest tests are built to make integer keys collide. A common defence is to XOR every key with one random constant." },
        { what: "`x in some_list`", time: "O(n)", space: "O(1)", why: "A list has to scan." },
        { what: "Iterate over a set or dict", time: "O(n)", space: "O(1)", why: "Visit each stored entry once." },
        { what: "Building a set or dict from n items", time: "O(n) average", space: "O(n)", why: "n inserts at O(1) each." },
        { what: "Set union / intersection of sizes n and m", time: "O(n + m)", space: "O(n + m)", why: "Each element is hashed and tested once." }],
      paras: ["The trade-off is memory: a hash table uses more space than a list for the same items, and it gives up order (for sets) in exchange for speed."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Unhashable key", handle: "`{[1, 2]: 3}` raises TypeError. Use a tuple `(1, 2)` or convert to a string." }, { case: "Missing key", handle: "`d[k]` raises KeyError. Use `d.get(k, default)` or check `k in d` first." }, { case: "Changing a dictionary while looping over it", handle: "Adding or removing keys during iteration raises RuntimeError. Loop over `list(d)` or build a new dictionary." }, { case: "Empty set", handle: "`{}` is an empty **dictionary**, not an empty set. Write `set()`." }, { case: "Order of a set", handle: "Not guaranteed. Sort when you need a stable order for output." }, { case: "Equal numbers of different types", handle: "`1`, `1.0` and `True` hash equally, so they are the same key. Be careful when mixing types." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Testing membership in a list inside a loop.", fix: "Convert the list to a set once (`s = set(a)`) and test `x in s`." }, { mistake: "Writing `{}` and expecting a set.", fix: "`{}` is a dictionary. Use `set()` for an empty set." }, { mistake: "Reading a missing key with brackets.", fix: "Use `.get(k, default)` or `defaultdict`/`Counter`." }, { mistake: "Relying on a set's printed order.", fix: "Use `sorted(s)` when order matters." }, { mistake: "Using a list as a key.", fix: "Convert it to a tuple first." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a set or dictionary problem",
      signals: ["The problem asks “**have I seen this before?**”, “is there a duplicate?”, “which items are in both?”: a set.", "You must **count how many times** each thing occurs: `Counter` or a dictionary.", "You need to **look something up by name or key** repeatedly: a dictionary.", "You need to **group** items by a shared property (anagrams, same length, same remainder): a dictionary of lists.", "An O(n²) nested loop only exists to search for a partner value: a dictionary or set replaces the inner loop (the Two Sum idea)."],
      notThis: ["You need items in sorted order or ranked by position: sort a list instead.", "You need the smallest item repeatedly: a heap.", "The keys are small integers in a known range (say 0 to 10⁶): a plain list used as a counter array is faster and simpler."] },
    { kind: "worked", id: "worked-dup", title: "Does the list contain a duplicate?",
      problem: "Return True if any value appears at least twice in a list.",
      approach: ["Comparing every pair would be O(n²).", "A set holds only distinct values, so if the list has duplicates the set is **shorter** than the list.", "Compare the two lengths: one pass to build the set, O(n)."],
      code: dup,
      takeaway: "Turning a list into a set and comparing sizes is the shortest duplicate test. The lesson to remember is the pattern: *a set removes repeats, so any length difference exposes them*." },
    { kind: "worked", id: "worked-unique", title: "First unique character",
      problem: "Given a string, return the index of the first character that appears exactly once, or -1 if there is none.",
      approach: ["First pass: count every character with a `Counter`.", "Second pass: walk the string in order and return the first index whose count is 1.", "Two passes, O(n) time, and the second pass keeps the original order, which a dictionary alone would not tell you."],
      code: uniq,
      takeaway: "Counting first and then scanning in original order is a very common two-pass pattern. In `loveleetcode` the letters `l`, `o` and `e` repeat; `v` at index 2 is the first one that does not." },
  ],
  cheatSheet: [{ label: "Set", value: "distinct, unordered · add, discard, in · | & - ^" }, { label: "Dict", value: "d[k] (KeyError) · d.get(k, default) · d.items()" }, { label: "Cost", value: "add, remove, in: O(1) average" }, { label: "Counting", value: "Counter(x) · d[k] = d.get(k, 0) + 1" }, { label: "Grouping", value: "defaultdict(list); groups[key].append(item)" }, { label: "Careful", value: "{} is a dict · keys must be hashable · set order is not stable" }],
  summary: ["A set stores distinct items; a dictionary maps keys to values. Both look things up by hashing, in O(1) on average.", "A hash function turns a key into a bucket number; a collision just means a bucket holds a short list.", "Keys and set members must be hashable: numbers, strings, tuples, but not lists.", "Use sets for membership and duplicates, `Counter`/dicts for counting, `defaultdict(list)` for grouping.", "Replacing a list scan with a set or dictionary lookup often turns O(n²) into O(n)."],
  checks: [
    { kind: "complexity", q: "What is the average cost of `x in s` when `s` is a set of n items?", options: ["O(1)", "O(log n)", "O(n)", "O(n²)"], answer: 0, why: "The key is hashed and its bucket is checked directly, so the cost does not grow with n on average." },
    { kind: "concept", q: "Which of these can **not** be a dictionary key?", options: ["(1, 2)", "\"ana\"", "[1, 2]", "42"], answer: 2, why: "Lists are mutable and therefore unhashable. A tuple with the same items is fine." },
    { kind: "trace", q: "What does `sorted({1, 2, 3, 4} & {3, 4, 5})` give?", options: ["[3, 4]", "[1, 2, 3, 4, 5]", "[1, 2]", "[5]"], answer: 0, why: "`&` is intersection: the items in both sets, 3 and 4." },
    { kind: "concept", q: "What is `{}` in Python?", options: ["An empty set", "An empty dictionary", "An empty list", "An error"], answer: 1, why: "An empty set must be written `set()`; `{}` creates an empty dictionary." },
    { kind: "recognize", q: "“Group a list of words so that anagrams end up together” is best handled with:", options: ["A dictionary keyed by the sorted letters of each word", "Binary search", "A nested loop comparing every pair", "A linked list"], answer: 0, why: "All anagrams share the same sorted-letters key, so a dictionary of lists groups them in one pass." },
    { kind: "concept", q: "In a hash table, what is a collision?", options: ["A crash", "Two different keys mapping to the same bucket", "A key that is missing", "A duplicate value"], answer: 1, why: "Different keys can hash to the same bucket. The table keeps both in a short list and compares entries within the bucket." },
    { kind: "trace", q: "Is `{1, 2, 2, 3} == {3, 2, 1}`?", options: ["True", "False", "It raises an error", "It prints {1, 2, 3}"], answer: 0, why: "Sets ignore duplicates and order, so both hold exactly 1, 2 and 3." },
    { kind: "trace", q: "With `d = {'a': 1}`, what does `d.get('b', 0)` return?", options: ["0", "None", "1", "It raises a KeyError"], answer: 0, why: ".get returns the default when the key is missing, instead of raising an error." },
    { kind: "trace", q: "What is `len({'a': 1, 'a': 2})`?", options: ["1", "2", "0", "It raises an error"], answer: 0, why: "A repeated key keeps only its last value, so the dictionary has one entry." },
    { kind: "concept", q: "What is the type of `{}` in Python?", options: ["dict", "set", "tuple", "list"], answer: 0, why: "Empty braces make an empty dictionary. An empty set needs set()." },
  ],
  nextNote: "Next, **Built-ins, Classes & Iterators** collects the standard tools that save you from writing these loops by hand.",
};
