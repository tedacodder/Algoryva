import type { LessonV2 } from "../lesson-types";

const PI = String.raw`def prefix_function(s):
    pi = [0] * len(s)
    k = 0
    for i in range(1, len(s)):
        while k > 0 and s[i] != s[k]:
            k = pi[k - 1]               # fall back to the next shorter border
        if s[i] == s[k]:
            k += 1
        pi[i] = k
    return pi`;
const naive = String.raw`def find_all_naive(text, pat):
    n, m = len(text), len(pat)
    hits, comparisons = [], 0
    for i in range(n - m + 1):
        j = 0
        while j < m:
            comparisons += 1
            if text[i + j] != pat[j]:
                break
            j += 1
        if j == m:
            hits.append(i)
    return hits, comparisons

print(find_all_naive("abcabcabd", "abcabd"))   # ([3], 14)
print(find_all_naive("a" * 1000, "a" * 500 + "b"))   # ([], 250500)`;
const pfCode = String.raw`${PI}

print(prefix_function("abacaba"))   # [0, 0, 1, 0, 1, 2, 3]
print(prefix_function("aabaaab"))   # [0, 1, 0, 1, 2, 2, 3]
print(prefix_function("aaaa"))   # [0, 1, 2, 3]
print(prefix_function("abcd"))   # [0, 0, 0, 0]`;
const kmp = String.raw`${PI}

def kmp_search(text, pat):
    pi = prefix_function(pat)
    hits, k = [], 0
    for i, ch in enumerate(text):
        while k > 0 and ch != pat[k]:
            k = pi[k - 1]               # slide the pattern; i never moves back
        if ch == pat[k]:
            k += 1
        if k == len(pat):
            hits.append(i - k + 1)
            k = pi[k - 1]               # keep going: matches may overlap
    return hits

print(kmp_search("abcabcabd", "abcabd"))   # [3]
print(kmp_search("aaaaa", "aa"))   # [0, 1, 2, 3]
print(kmp_search("abc", "d"))   # []
print(kmp_search("ababababab", "abab"))   # [0, 2, 4, 6]

import random
random.seed(8)
ok = True
for _ in range(500):
    text = "".join(random.choice("ab") for _ in range(random.randint(0, 14)))
    pat = "".join(random.choice("ab") for _ in range(random.randint(1, 4)))
    brute = [i for i in range(len(text) - len(pat) + 1) if text[i:i + len(pat)] == pat]
    ok = ok and kmp_search(text, pat) == brute
print(ok)   # True`;
const zf = String.raw`def z_function(s):
    n = len(s)
    z = [0] * n
    l = r = 0                            # [l, r) is the rightmost match of a prefix seen so far
    for i in range(1, n):
        if i < r:
            z[i] = min(r - i, z[i - l])  # reuse what we already know
        while i + z[i] < n and s[z[i]] == s[i + z[i]]:
            z[i] += 1
        if i + z[i] > r:
            l, r = i, i + z[i]
    return z

def z_search(text, pat):
    s = pat + "#" + text                 # "#" must not occur in either string
    z = z_function(s)
    return [i - len(pat) - 1 for i, v in enumerate(z) if v == len(pat)]

print(z_function("aabcaabxaaaz"))   # [0, 1, 0, 0, 3, 1, 0, 0, 2, 2, 1, 0]
print(z_search("abcabcabd", "abcabd"))   # [3]
print(z_search("aaaaa", "aa"))   # [0, 1, 2, 3]`;
const rh = String.raw`def poly_hash(s, base=131, mod=(1 << 61) - 1):
    h = 0
    for ch in s:
        h = (h * base + ord(ch)) % mod
    return h

def rolling_find(text, pat, base=131, mod=(1 << 61) - 1):
    n, m = len(text), len(pat)
    if m > n:
        return []
    power = pow(base, m - 1, mod)
    hp = poly_hash(pat, base, mod)
    h = poly_hash(text[:m], base, mod)
    hits = []
    for i in range(n - m + 1):
        if h == hp and text[i:i + m] == pat:     # verify, in case two strings share a hash
            hits.append(i)
        if i + m < n:
            h = ((h - ord(text[i]) * power) * base + ord(text[i + m])) % mod
    return hits

print(sum(map(ord, "ab")) == sum(map(ord, "ba")), poly_hash("ab") == poly_hash("ba"))   # True False
print(rolling_find("abcabcabd", "abcabd"))   # [3]
print(rolling_find("aaaaa", "aa"))   # [0, 1, 2, 3]
print(rolling_find("ab", "abc"))   # []

import random
random.seed(1)
ok = True
for _ in range(500):
    text = "".join(random.choice("ab") for _ in range(random.randint(0, 14)))
    pat = "".join(random.choice("ab") for _ in range(random.randint(1, 4)))
    brute = [i for i in range(len(text) - len(pat) + 1) if text[i:i + len(pat)] == pat]
    ok = ok and rolling_find(text, pat) == brute
print(ok)   # True`;
const trie = String.raw`class Trie:
    def __init__(self):
        self.children = {}
        self.end = False
        self.count = 0                   # how many inserted words pass through this node

    def insert(self, word):
        node = self
        node.count += 1                  # the root is passed through by every word
        for ch in word:
            node = node.children.setdefault(ch, Trie())
            node.count += 1
        node.end = True

    def _walk(self, s):
        node = self
        for ch in s:
            node = node.children.get(ch)
            if node is None:
                return None
        return node

    def search(self, word):
        node = self._walk(word)
        return node is not None and node.end

    def starts_with(self, prefix):
        return self._walk(prefix) is not None

    def count_prefix(self, prefix):
        node = self._walk(prefix)
        return node.count if node else 0

t = Trie()
for w in ["car", "cat", "cart", "do"]:
    t.insert(w)
print(t.search("cat"), t.search("ca"), t.search("cow"))   # True False False
print(t.starts_with("ca"), t.starts_with("cow"))   # True False
print(t.count_prefix("ca"), t.count_prefix("car"), t.count_prefix("d"), t.count_prefix("z"))   # 3 2 1 0`;
const period = String.raw`${PI}

def smallest_period(s):
    p = len(s) - prefix_function(s)[-1]
    return p if len(s) % p == 0 else len(s)

def longest_border(s):
    return prefix_function(s)[-1]

print(smallest_period("abcabcabc"))   # 3
print(smallest_period("abcabcab"))   # 8
print(smallest_period("aaaa"))   # 1
print(smallest_period("a"))   # 1
print(longest_border("ababab"), longest_border("level"), longest_border("abc"))   # 4 1 0
print(all(("xyz" * k)[:] == "xyz" * k and smallest_period("xyz" * k) == 3 for k in range(1, 6)))   # True`;
const autoc = String.raw`class Trie:
    def __init__(self):
        self.children = {}
        self.count = 0

    def insert(self, word):
        node = self
        node.count += 1                  # the root is passed through by every word
        for ch in word:
            node = node.children.setdefault(ch, Trie())
            node.count += 1

    def count_prefix(self, prefix):
        node = self
        for ch in prefix:
            node = node.children.get(ch)
            if node is None:
                return 0
        return node.count

def prefix_counts(words, queries):
    t = Trie()
    for w in words:
        t.insert(w)
    return [t.count_prefix(q) for q in queries]

words = ["apple", "app", "apt", "bat", "bath", "apple"]
print(prefix_counts(words, ["ap", "app", "apple", "ba", "bath", "c", ""]))   # [4, 3, 2, 2, 1, 0, 6]
print(prefix_counts(words, ["ap", "app", "apple", "ba", "bath", "c", ""]) == [sum(w.startswith(q) for w in words) for q in ["ap", "app", "apple", "ba", "bath", "c", ""]])   # True`;

export const stringAlgorithms: LessonV2 = {
  topic: "string-algorithms", depth: "complete", minutes: 65,
  hook: "Find a pattern in a text in one pass without ever re-reading characters, compare substrings in constant time, and store a dictionary of words by shared prefixes.",
  objectives: [
    "Explain why naive substring search is O(n × m) and where the repeated work comes from.",
    "Compute the prefix function (borders) and use it to run KMP search in O(n + m).",
    "Compute the Z-function and use it for pattern search.",
    "Use a polynomial rolling hash to compare substrings, and say when a hash match must be verified.",
    "Build a trie, and use it for membership, prefix queries and prefix counts.",
  ],
  prereqNote: "Arrays (indexing and slicing) and Sets & Dictionaries (hashing). Comfort with `for` and `while` loops over indices.",
  sections: [
    { kind: "intuition", id: "book", title: "Finding a phrase in a book without re-reading",
      paras: ["You are looking for the phrase “abcabd” in a long text and you have matched “abcab” when the next letter turns out to be wrong. A careless search goes back to the second letter of the text and starts over, re-reading characters it has already seen. But you *know* what those characters were: you matched them! The pattern's own shape tells you how much of what you matched can still be part of a new match, and where to carry on.",
        "String algorithms are about not forgetting what you have already learned: KMP and the Z-function reuse matched characters, hashing summarises a substring in one number, and a trie shares the common beginning of many words."] },
    { kind: "naive", id: "naive", title: "Try every starting position",
      paras: ["The direct way places the pattern at every position of the text and compares character by character until a mismatch.",
        "The comparison counter shows the cost: 14 comparisons for a 9-character text. But for a text of 1,000 letters `a` and a pattern of 500 `a`s followed by a `b`, every one of the 500 starting positions matches 500 letters before failing on the last one: **250,500 comparisons**, almost all of them re-reading characters already seen."],
      code: naive,
      cost: "O(n × m): n starting positions, up to m comparisons each. About 10¹⁰ for n = m/2 = 10⁵." },
    { kind: "observation", id: "observation", title: "A mismatch after j matched characters teaches you what to do next",
      paras: ["Suppose the first j characters of the pattern matched the text, then a mismatch occurs. Those j text characters equal `pattern[0..j-1]`. A new match could only start at a position where a **suffix** of that matched part equals a **prefix** of the pattern. The longest such overlap (a **border**) is exactly what tells you the next best alignment, and it depends only on the pattern, not on the text.",
        "Precompute the border length for every prefix of the pattern (the **prefix function**). Then on a mismatch you slide the pattern right so that the border lines up, without moving the text pointer backwards. Each text character is looked at O(1) times in total."] },
    { kind: "concept", id: "concept", title: "The four tools",
      paras: ["Each solves a slightly different problem. Learn what each is *for*."],
      bullets: ["**Prefix function (π) and KMP:** `π[i]` = the length of the longest **proper** prefix of `s[0..i]` that is also a suffix of it (a *border*). KMP search uses π to match a pattern in O(n + m). π also gives periods and borders of a string.", "**Z-function:** `z[i]` = the length of the longest common prefix of `s` and the suffix starting at `i`. Same power as π (they can be converted into each other), often easier to reason about for “how far does the prefix match here?”.", "**Rolling hash (Rabin–Karp):** treat a string as a number in some base, modulo a large number, so a substring has a hash that can be updated in O(1) when the window slides. Compares substrings fast, but two different strings can share a hash (a **collision**), so a match is usually verified.", "**Trie (prefix tree):** a tree with one edge per letter; words with the same beginning share a path. Supports insert, exact search and prefix queries in time proportional to the **word length**, not the number of words.", "**Border:** a proper prefix that is also a suffix (for “abacaba” the borders have lengths 3 and 1). A string of length n has period `n − (longest border)` (and repeats exactly when that divides n)."] },
    { kind: "viz", id: "viz-prefix", title: "Building the prefix function", viz: "kmp-prefix",
      paras: ["The top row is the pattern, the second row the prefix function as it is filled in. The pointer `j` is the current border length: if the next character extends it, `j` grows; if not, we fall back to a shorter border (`j = π[j − 1]`) and try again. Watch how falling back reuses earlier answers instead of restarting."] },
    { kind: "viz", id: "viz-search", title: "KMP search: the text pointer never moves back", viz: "kmp-search",
      paras: ["The top row is the text; the second row shows the pattern placed at its current alignment. Green text boxes are matched so far. At the mismatch the pattern **slides right** (its offset changes) while the text pointer stays put. Compare this with the naive method, which would restart one position after the previous start."] },
    { kind: "example", id: "example", title: "The prefix function by hand",
      paras: ["Pattern `abacaba` (positions 0 to 6). π[i] is the longest border of the prefix ending at i."],
      table: { head: ["i", "prefix s[0..i]", "longest proper border", "π[i]"], rows: [["0", "a", "none", "0"], ["1", "ab", "none", "0"], ["2", "aba", "a", "1"], ["3", "abac", "none", "0"], ["4", "abaca", "a", "1"], ["5", "abacab", "ab", "2"], ["6", "abacaba", "aba", "3"]] },
      steps: [{ title: "How i = 5 and 6 are found fast", body: "At i = 4 the border was 1 (“a”). At i = 5 the next letter 'b' equals s[1], so the border grows to 2 (“ab”). At i = 6 the letter 'a' equals s[2], so it grows to 3 (“aba”). No re-comparison of earlier letters was needed." }, { title: "A fall-back", body: "At i = 3 the letter 'c' does not match s[1] = 'b', so we fall back to j = π[0] = 0, and 'c' does not match s[0] = 'a' either: the border is 0." }] },
    { kind: "code", id: "code-pi", title: "The prefix function in code",
      paras: ["The loop keeps `k`, the length of the current border. When the next character fails to extend it, `k` falls back through shorter and shorter borders."],
      pseudocode: "pi[0] = 0; k = 0\nfor i from 1 to n − 1:\n    while k > 0 and s[i] != s[k]: k = pi[k − 1]\n    if s[i] == s[k]: k += 1\n    pi[i] = k",
      code: pfCode,
      walkthrough: ["`k = pi[k - 1]` jumps to the longest border of the border: the best shorter candidate, which is already known because it is at an earlier index.", "Although the `while` loop may run several times at one `i`, `k` goes up by at most 1 per `i` and every fall-back lowers it, so the total work across the whole string is O(n).", "`prefix_function(\"aaaa\")` is `[0, 1, 2, 3]` (every prefix has a border one shorter) and a string of all different letters has all zeros.", "`prefix_function(\"abacaba\")` reproduces the table above."] },
    { kind: "code", id: "code-kmp", title: "KMP search, checked against brute force",
      paras: ["Searching is the same loop run over the **text**, using π of the pattern. When all m characters have matched, record the match and fall back to the pattern's own longest border so overlapping matches are found."],
      code: kmp,
      walkthrough: ["`k` is how many pattern characters are matched. On a mismatch the `while` slides the pattern (`k = pi[k - 1]`) without touching `i`.", "After a full match (`k == len(pat)`), set `k = pi[k - 1]` instead of 0. That lets the next match overlap this one: `kmp_search(\"aaaaa\", \"aa\")` finds positions 0, 1, 2 and 3.", "Total time is O(n + m): O(m) to build π and O(n) for the scan (the same amortised argument as for π).", "The snippet ends by comparing KMP with a brute-force slice comparison on 500 random strings over {a, b}, a good habit for string code, whose bugs hide in edge cases. It prints True."] },
    { kind: "code", id: "code-z", title: "The Z-function",
      paras: ["`z[i]` is how far the prefix of `s` matches the text starting at `i`. The trick is to keep a window `[l, r)` where a prefix match was last found: positions inside it are copies of earlier positions, so part of their answer is already known."],
      code: zf,
      walkthrough: ["Inside the window (`i < r`), `s[i..r)` equals `s[i−l..r−l)`, so `z[i]` is at least `min(r − i, z[i − l])`, which is why the first line of the loop is a free starting value.", "The `while` loop only extends beyond `r`, and each character beyond `r` is examined once, so the total work is O(n).", "To search, build `pattern + \"#\" + text` and look for positions where `z` equals the pattern length. The separator must not occur in either string, otherwise a match could cross the boundary. The match index in the text is `i − len(pat) − 1`.", "On `\"aabcaabxaaaz\"` the values are `[0, 1, 0, 0, 3, 1, 0, 0, 2, 2, 1, 0]` (z[0] is set to 0 by convention)."] },
    { kind: "code", id: "code-hash", title: "A rolling hash",
      paras: ["Treat a string as a number: `hash(s) = s[0]·b^(m−1) + … + s[m−1]` modulo a large prime. Sliding the window one place is arithmetic: remove the leading character's contribution, shift everything up one base power, add the new character. That is O(1) per slide, so every window's hash costs O(n) in total."],
      code: rh,
      walkthrough: ["A weak hash such as the **sum of character codes** gives the same value for `\"ab\"` and `\"ba\"` (first output). The polynomial hash separates them because position matters (multiplying by the base each step).", "`power = base^(m−1) mod p` is the weight of the character that is about to leave the window; subtracting `ord(text[i]) * power` removes it.", "A hash match is only a **strong hint**: two different strings can collide. The code confirms with a real comparison (`text[i:i + m] == pat`). With a 61-bit modulus accidental collisions are astronomically unlikely, but contest problems can contain inputs built against known bases and moduli, so pick a random base in practice.", "The last lines compare it with brute force on 500 random strings (True) and show `rolling_find(\"ab\", \"abc\")` returning `[]` when the pattern is longer than the text."] },
    { kind: "viz", id: "viz-trie", title: "A trie of words", viz: "trie-build",
      paras: ["Words are inserted letter by letter, following existing nodes where possible and creating new ones where not. Notice that `car`, `cart` and `cat` share the start `ca`. Green nodes mark where a word ends. The look-ups at the end show the difference between a stored word (`cat`), a mere prefix (`ca`) and a missing word (`cow`)."] },
    { kind: "code", id: "code-trie", title: "A trie class",
      paras: ["Each node holds a dictionary from letter to child, a flag marking the end of a word, and a counter of words passing through."],
      code: trie,
      walkthrough: ["`insert` walks down, creating children as needed (`setdefault`), counts how many words pass through each node, and marks the final node as a word end.", "`search` requires the path to exist **and** the last node to be a word end: `\"ca\"` is on a path but is not stored. `starts_with` only needs the path.", "`count_prefix(\"ca\")` is 3 because `car`, `cat` and `cart` all pass through `ca`. Inserting the same word twice would count it twice.", "Every operation costs O(length of the word): independent of how many words are stored."] },
    { kind: "complexity", id: "complexity", title: "Costs",
      rows: [
        { what: "Naive substring search", time: "O(n × m)", space: "O(1)", why: "Up to m comparisons at each of n starting positions." },
        { what: "KMP (prefix function + scan)", time: "O(n + m)", space: "O(m)", why: "The pattern pointer's total fall-backs are bounded by its total increases." },
        { what: "Z-function (and search via pattern#text)", time: "O(n + m)", space: "O(n + m)", why: "Each character beyond the window is examined once." },
        { what: "Rolling hash search", time: "O(n + m) expected", space: "O(1) extra", why: "One O(1) hash update per window, plus a verification only on hash matches." },
        { what: "Trie insert / search / prefix query", time: "O(length of the word)", space: "O(total characters)", why: "One step per letter; storage is one node per distinct prefix." },
        { what: "Trie memory in Python", time: "-", space: "large constant", why: "A dictionary per node is heavy; for a small alphabet use arrays of 26 children, or a sorted list with binary search." }],
      paras: ["All four turn an O(n × m) re-reading problem into a single pass. Choose by the question: *where does a pattern occur?* → KMP or Z; *are these two substrings equal?* (many times) → hashing; *which stored words start with this?* → trie."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Empty pattern", handle: "It matches everywhere or nowhere depending on the statement. The code here assumes a non-empty pattern (`pat[k]` would fail on an empty one). Handle it before calling." }, { case: "Pattern longer than the text", handle: "No match. KMP returns `[]` naturally; the rolling-hash version returns early." }, { case: "Overlapping matches", handle: "After a full match fall back with `k = pi[k - 1]`, not `k = 0`, or you will miss matches like `aa` in `aaaaa`." }, { case: "All characters equal", handle: "π is `[0, 1, 2, …]`. The naive search is at its worst here, while KMP stays linear." }, { case: "Separator in the Z-search string", handle: "Use a character that appears in neither string, or a match could straddle the join." }, { case: "Hash collisions and adversarial tests", handle: "Use a large modulus (such as 2⁶¹ − 1), a random base, and verify matches (or use two moduli)." }, { case: "Case, spaces and Unicode", handle: "Strings compare by code point. Normalise case if the statement asks for case-insensitive matching." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Resetting to `k = 0` after a full match in KMP.", fix: "Use `k = pi[k - 1]` so overlapping matches are found." }, { mistake: "Using the sum of character codes (or any order-blind value) as a hash.", fix: "Use a polynomial hash so position matters." }, { mistake: "Trusting a hash match without checking, with a small modulus.", fix: "Verify the substring or use a 61-bit modulus (or two moduli) and a random base." }, { mistake: "Confusing a border with a suffix equal to the whole string.", fix: "A border is a **proper** prefix (shorter than the string) that is also a suffix." }, { mistake: "Treating a trie `search` as a prefix check.", fix: "`search` needs the end-of-word flag; `starts_with` does not." }, { mistake: "Slicing in a hot loop (`text[i:i + m]` for every i).", fix: "Each slice costs O(m); compare only when hashes match, or use KMP." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a string-algorithm problem",
      signals: ["“**Find all occurrences** of a pattern in a text” with lengths up to 10⁵ or 10⁶: KMP or Z (or hashing).", "“**Border**, **period**, **repeated substring**, shortest string that builds this one by repetition”: the prefix function.", "“Compare **many substrings** for equality” or “count distinct substrings of a given length”: **hashing**.", "“How many dictionary words start with this prefix?”, **autocomplete**, longest common prefix of many words: a **trie**.", "Words sharing beginnings, a dictionary with lookups by prefix, word games (boggle, word search with pruning): trie plus backtracking.", "“Longest prefix that is also a suffix”: π of the last position."],
      notThis: ["The pattern and text are tiny: `str.find` or `in` is simpler and fast enough.", "You need all substrings sorted or all suffix relationships: suffix arrays or suffix automata (beyond this lesson).", "The strings contain structure like palindromes: Manacher's algorithm and palindromic trees exist for that."] },
    { kind: "worked", id: "worked-period", title: "The shortest repeating unit of a string",
      problem: "Given a string s, find the length of the shortest string t such that s is t repeated whole times. (If s is not a repetition of anything shorter, the answer is the length of s.)",
      approach: ["Compute the prefix function. Its last value is the longest border of the whole string.", "If the border has length b, then `s` has a period of `p = n − b` (shifting by p lines the string up with itself).", "The string is made of **whole** repeats exactly when p divides n. Otherwise the shortest repeating unit is the whole string."],
      code: period,
      takeaway: "One linear pass answers a question that otherwise needs trying every divisor and comparing. For `\"abcabcab\"` the longest border is `abcab` (5), giving period 3, which does not divide 8, so the answer is 8. The last line confirms the period is 3 for `xyz` repeated 1 to 5 times." },
    { kind: "worked", id: "worked-prefix", title: "Count the words with a given prefix",
      problem: "Given a list of words (duplicates allowed) and a list of queries, for each query print how many of the words start with it (the empty query matches every word).",
      approach: ["Checking every word for every query is O(words × queries × length).", "Insert all words into a trie, and keep at every node the number of words that pass through it.", "A query walks down its letters. If a letter is missing, the answer is 0; otherwise it is the count stored at the last node."],
      code: autoc,
      takeaway: "The trie answers each query in O(length of the query), however many words there are. The empty query returns the total (6, including the duplicated `apple`), and the final line cross-checks the whole table with `startswith`." },
  ],
  cheatSheet: [{ label: "Prefix function", value: "π[i] = longest proper border of s[0..i]; while k > 0 and s[i] != s[k]: k = π[k−1]" }, { label: "KMP search", value: "same loop over the text; on k == m record a match, then k = π[m−1]" }, { label: "Z-function", value: "z[i] = common prefix of s and s[i:]; search via pattern + '#' + text" }, { label: "Rolling hash", value: "h = (h − c_old·b^(m−1))·b + c_new (mod p); verify matches" }, { label: "Trie", value: "children dict + end flag + pass-through count; ops cost O(word length)" }, { label: "Cost", value: "KMP, Z: O(n + m) · hash: O(n + m) expected · naive: O(n·m)" }],
  summary: ["Naive search re-reads characters after every mismatch, costing O(n × m).", "The prefix function stores the longest border of every prefix; KMP uses it to slide the pattern while the text pointer only moves forward: O(n + m).", "The Z-function gives the same power and can search via `pattern + separator + text`.", "A polynomial rolling hash updates a window's hash in O(1); equal hashes should be verified, and the base chosen randomly.", "A trie shares common prefixes, giving insert, search and prefix queries in time proportional to the word length."],
  checks: [
    { kind: "complexity", q: "Why is KMP O(n + m) rather than O(n × m)?", options: ["It skips every other character", "The text pointer never moves back, and the pattern pointer's fall-backs are bounded by its increases", "It uses a hash table", "It sorts the pattern first"], answer: 1, why: "Each text character is processed once, and every fall-back of the pattern pointer is paid for by an earlier increase." },
    { kind: "trace", q: "What is the prefix function of `\"aabaaab\"`?", options: ["[0, 1, 0, 1, 2, 2, 3]", "[0, 1, 2, 3, 4, 5, 6]", "[0, 0, 1, 0, 1, 2, 3]", "[0, 1, 0, 1, 2, 3, 4]"], answer: 0, why: "The borders of the successive prefixes a, aa, aab, aaba, aabaa, aabaaa, aabaaab have lengths 0, 1, 0, 1, 2, 2, 3." },
    { kind: "concept", q: "After KMP finds a full match, why set `k = pi[k - 1]` instead of `k = 0`?", options: ["It is faster only", "So matches that overlap the current one are not missed", "To avoid an index error", "It makes the match unique"], answer: 1, why: "The longest border of the whole pattern is how much of this match can also be the start of the next one." },
    { kind: "concept", q: "Why is the sum of character codes a poor string hash?", options: ["It is too slow", "It ignores order, so `\"ab\"` and `\"ba\"` collide", "It uses too much memory", "Python forbids it"], answer: 1, why: "Any anagram has the same sum. A polynomial hash multiplies by a base each step, so position matters." },
    { kind: "recognize", q: "“Answer many queries of the form: how many dictionary words start with this prefix?” suggests:", options: ["KMP", "A trie with pass-through counts", "A sparse table", "Dijkstra"], answer: 1, why: "A trie shares prefixes, so a query walks one path and reads a stored count." },
    { kind: "trace", q: "What is the shortest repeating unit length of `\"abcabcabc\"`, using the longest border?", options: ["1", "3", "6", "9"], answer: 1, why: "The longest border is `abcabc` (6), so the period is 9 − 6 = 3, and 3 divides 9." },
    { kind: "trace", q: "KMP prefix function for s = 'aabaaab'. What is printed?", options: ["[0, 1, 0, 1, 2, 2, 3]", "[0, 1, 0, 1, 2, 3, 3]", "[0, 0, 1, 1, 2, 2, 3]", "[0, 1, 0, 0, 1, 2, 3]"], answer: 0, why: "Each entry is the longest proper prefix that is also a suffix of the prefix ending there." },
    { kind: "trace", q: "Count overlapping occurrences of 'aba' in 'ababa'. What is printed?", options: ["2", "1", "3", "0"], answer: 0, why: "The matches start at positions 0 and 2, and they overlap." },
    { kind: "trace", q: "How many distinct non-empty substrings does 'aa' have?", options: ["2", "1", "3", "4"], answer: 0, why: "They are 'a' and 'aa'." },
    { kind: "trace", q: "A trie gets the words 'cat' and 'car'. Counting every node including the root, how many nodes are there?", options: ["5", "4", "6", "7"], answer: 0, why: "Root, c, a, t and r are the five nodes." },
    { kind: "concept", q: "What does the KMP prefix function store for each position?", options: ["The length of the longest proper prefix that is also a suffix of that prefix", "The count of each letter", "The sorted string", "A hash of the whole text"], answer: 0, why: "It tells how far the pattern can be reused after a mismatch." },
    { kind: "complexity", q: "What is the running time of KMP to search a pattern of length m in a text of length n?", options: ["O(n + m)", "O(n \u00b7 m)", "O(n log m)", "O(m\u00b2)"], answer: 0, why: "The text pointer only moves forward, and the pattern pointer falls back at most as often as it advances." },
    { kind: "concept", q: "Why must a rolling-hash match be verified?", options: ["Different strings can have the same hash (a collision)", "Hashes are always exact", "Hashing cannot run on strings", "Hashing sorts the text"], answer: 0, why: "Equal hashes are necessary but not sufficient for equal strings." },
    { kind: "trace", q: "Longest palindromic substring of 'babad' (length only). What is printed?", options: ["3", "2", "5", "1"], answer: 0, why: "'bab' and 'aba' are both palindromes of length 3." },
    { kind: "concept", q: "Which structure is best for many prefix searches over a dictionary of words?", options: ["A trie", "A sorted list only", "A heap", "A queue"], answer: 0, why: "Each prefix is a path from the root, so searches cost the prefix length." },
  ],
  nextNote: "These tools combine with others in this course: hashing from Sets & Dictionaries, tries as trees, and KMP's borders as a dynamic-programming idea. **Number Theory & Combinatorics** is planned next.",
};
