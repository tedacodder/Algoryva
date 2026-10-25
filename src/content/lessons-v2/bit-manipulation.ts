import type { LessonV2 } from "../lesson-types";

const naive = String.raw`def popcount_loop(x):
    count = 0
    while x:
        count += x & 1          # look at the lowest bit
        x >>= 1                 # drop it
    return count

def popcount_string(x):
    return bin(x).count("1")

print(popcount_loop(255), popcount_string(255))   # 8 8
print(popcount_loop(1 << 40), popcount_string(1 << 40))   # 1 1`;
const ops = String.raw`x = 12
print(bin(x), x & 10, x | 10, x ^ 10)   # 0b1100 8 14 6
print(x << 1, x >> 2, 1 << 5)   # 24 3 32
print(bool(x >> 2 & 1), bool(x >> 1 & 1))   # True False
print(x | (1 << 0), x & ~(1 << 2), x ^ (1 << 3))   # 13 8 4
print(x & -x, x & (x - 1))   # 4 8
print(~5, -5 & 0xFF, bin(-5 & 0xFF))   # -6 251 0b11111011
print(x.bit_count(), bin(x).count("1"))   # 2 2
print(6 & 1 == 0, (6 & 1) == 0)   # True True
print(1 << 2 + 1, (1 << 2) + 1)   # 8 5`;
const pop = String.raw`def popcount_loop(x):
    count = 0
    while x:
        count += x & 1
        x >>= 1
    return count

def popcount_kernighan(x):
    count = 0
    while x:
        x &= x - 1              # erase the lowest set bit
        count += 1
    return count

def is_power_of_two(x):
    return x > 0 and (x & (x - 1)) == 0

print(popcount_loop(255), popcount_kernighan(255), popcount_kernighan(1 << 40))   # 8 8 1
print([n for n in range(1, 40) if is_power_of_two(n)])   # [1, 2, 4, 8, 16, 32]
print(is_power_of_two(0), is_power_of_two(-8), is_power_of_two(96))   # False False False

import random
random.seed(4)
print(all(popcount_loop(v) == popcount_kernighan(v) == v.bit_count() for v in (random.randrange(10**12) for _ in range(1000))))   # True`;
const xor = String.raw`def single_number(a):
    result = 0
    for x in a:
        result ^= x             # pairs cancel: x ^ x = 0, and 0 ^ y = y
    return result

def missing_number(a):          # a holds 0..n with one value missing
    n = len(a)
    result = n
    for i, x in enumerate(a):
        result ^= i ^ x
    return result

print(single_number([4, 1, 2, 1, 2]))   # 4
print(single_number([7]))   # 7
print(missing_number([3, 0, 1]))   # 2
print(missing_number([9, 6, 4, 2, 3, 5, 7, 0, 1]))   # 8
a, b = 5, 9
a ^= b
b ^= a
a ^= b
print(a, b)   # 9 5
print(7 ^ 7, 7 ^ 0, 5 ^ 3 ^ 5)   # 0 7 3`;
const subs = String.raw`def subsets(a):
    n = len(a)
    return [[a[i] for i in range(n) if mask >> i & 1] for mask in range(1 << n)]

def submasks(mask):
    out = []
    s = mask
    while True:
        out.append(s)
        if s == 0:
            break
        s = (s - 1) & mask
    return out

print(subsets([1, 2, 3]))   # [[], [1], [2], [1, 2], [3], [1, 3], [2, 3], [1, 2, 3]]
print(len(subsets(list(range(10)))))   # 1024
print(submasks(0b101))   # [5, 4, 1, 0]
print(len(submasks(0b1111)), sum(len(submasks(m)) for m in range(16)))   # 16 81`;
const two = String.raw`def single_two(a):
    x = 0
    for v in a:
        x ^= v                          # x = p ^ q, where p and q are the two lonely values
    low = x & -x                        # a bit where p and q differ
    p = 0
    for v in a:
        if v & low:
            p ^= v                      # this group holds exactly one of them (pairs still cancel)
    return sorted((p, x ^ p))

print(single_two([1, 2, 1, 3, 2, 5]))   # [3, 5]
print(single_two([0, 1]))   # [0, 1]
print(single_two([-1, 4, 4, 9]))   # [-1, 9]`;
const cnt = String.raw`def count_bits(n):
    dp = [0] * (n + 1)
    for i in range(1, n + 1):
        dp[i] = dp[i >> 1] + (i & 1)   # drop the lowest bit, then add it back if it was 1
    return dp

print(count_bits(5))   # [0, 1, 1, 2, 1, 2]
print(count_bits(0))   # [0]
print(count_bits(16)[-1], count_bits(15)[-1])   # 1 4
print(all(c == bin(i).count("1") for i, c in enumerate(count_bits(1000))))   # True`;

export const bitManipulation: LessonV2 = {
  topic: "bit-manipulation", depth: "complete", minutes: 45,
  hook: "Treat a number as a row of on/off switches: a handful of one-line tricks replace loops, store sets in a single integer, and enumerate every subset.",
  objectives: [
    "Read and write numbers in binary, and use `&`, `|`, `^`, `~`, `<<` and `>>` correctly (including operator precedence).",
    "Test, set, clear and toggle a single bit, and isolate or erase the lowest set bit.",
    "Count set bits, test powers of two, and use XOR's cancelling property to find a lonely or missing number.",
    "Use a bitmask to represent a subset, and enumerate all subsets and submasks.",
    "Know how Python's unlimited and negative integers behave, and when a problem is a bit-manipulation problem.",
  ],
  prereqNote: "Numerics (remainders and powers of two) and a feel for binary numbers. Fenwick Tree uses one trick from this lesson (`x & -x`).",
  sections: [
    { kind: "intuition", id: "switches", title: "A row of light switches",
      paras: ["Picture eight light switches in a row. Each is on or off, and which are on can be read as a number: switch k carries the value 2^k when it is on. With switches 2 and 3 on you have 4 + 8 = 12. That is exactly binary: 12 is 1100.",
        "Operations on the whole row at once are very fast: flip a single switch, check one, switch off the lowest one that is on, combine two rows. Because a computer stores integers this way, these operations are single machine instructions, and clever use of them turns loops into one-liners."] },
    { kind: "naive", id: "naive", title: "Counting set bits one at a time",
      paras: ["How many switches are on in a number? The direct way looks at the lowest bit, drops it, and repeats until nothing is left. Or convert to a text string of 0s and 1s and count the `\"1\"` characters.",
        "Both work, and are fine for one number. But the loop does one step for every bit position, ones and zeros alike (32 or 64 steps), and the string version builds a whole string. If you must do it for millions of numbers, or for a number with a single bit set among many zeros, that is wasted work. The tricks below do one step per **set** bit, and often no loop at all."],
      code: naive,
      cost: "One step per bit position (about 32 to 64 per number), regardless of how many bits are actually set." },
    { kind: "observation", id: "observation", title: "One operation works on every bit at once",
      paras: ["`a & b`, `a | b` and `a ^ b` combine two numbers bit by bit, all positions in a single step. A mask with exactly one bit set (`1 << k`) lets you address one switch: combine it with `|` to turn it on, with `& ~mask` to turn it off, with `^` to flip it, with `&` to test it.",
        "Two arithmetic facts about the lowest set bit give most of the famous tricks: subtracting 1 from a number flips its lowest set bit to 0 and all the zeros below it to 1; negating a number (`-x`) keeps the lowest set bit and flips everything above it. So `x & (x - 1)` erases the lowest set bit, and `x & -x` keeps only the lowest set bit."] },
    { kind: "concept", id: "concept", title: "The operators and the idioms",
      paras: ["Memorise these. They appear everywhere."],
      bullets: ["**AND** `a & b`: 1 only where both are 1 (use for testing and masking). **OR** `a | b`: 1 where either is 1 (use for setting). **XOR** `a ^ b`: 1 where they differ (use for flipping and cancelling). **NOT** `~a`: flips every bit; in Python `~a == -a - 1`.", "**Shifts:** `a << k` multiplies by 2^k; `a >> k` divides by 2^k rounding down. `1 << k` is the mask with only bit k set.", "**Test bit k:** `(x >> k) & 1`. **Set:** `x | (1 << k)`. **Clear:** `x & ~(1 << k)`. **Toggle:** `x ^ (1 << k)`.", "**Lowest set bit:** `x & -x`. **Erase it:** `x & (x - 1)`. **Power of two:** `x > 0 and (x & (x - 1)) == 0`.", "**XOR laws:** `x ^ x = 0`, `x ^ 0 = x`, and XOR is commutative and associative, so in a long XOR any value appearing twice cancels out.", "**Subset as a mask:** with n ≤ about 20 items, bit i of an integer says whether item i is chosen; `range(1 << n)` visits all 2^n subsets.", "**Precedence:** in Python, `+ -` bind tighter than `<< >>`, which bind tighter than `&`, then `^`, then `|`, and all of these bind tighter than comparisons. So `x & 1 == 0` works as `(x & 1) == 0`, but `1 << k + 1` is `1 << (k + 1)`. In C, C++, Java and JavaScript comparisons bind **tighter** than `&`, `^` and `|`, so there `x & 1 == 0` is parsed as `x & (1 == 0)`: a silent bug in C, C++ and JavaScript, and a compile error in Java. Parenthesise bit expressions so they read the same in every language.", "**Python specifics:** integers have unlimited length and negative numbers behave as if padded with infinite 1s. To see a negative value as 8 bits, mask it: `-5 & 0xFF == 251`. `int.bit_count()` counts set bits (Python 3.10+)."] },
    { kind: "viz", id: "viz-bits", title: "Bits in motion", viz: "bit-ops",
      paras: ["The top row is `a = 12` written lowest bit first, so the number under each box is the **bit position** (position 0 is the 1s place, position 3 is the 8s place). Step through AND, OR, XOR, shifts, single-bit edits, and the two lowest-bit tricks. Highlighted boxes are the 1s in each result."] },
    { kind: "example", id: "example", title: "12 and 10 by hand",
      paras: ["Write both numbers in binary with the lowest bit on the right, as usual."],
      table: { head: ["expression", "binary", "decimal"], rows: [["a = 12", "1100", "12"], ["b = 10", "1010", "10"], ["a & b", "1000", "8"], ["a | b", "1110", "14"], ["a ^ b", "0110", "6"], ["a << 1", "11000", "24"], ["a >> 2", "0011", "3"], ["a & -a  (lowest set bit)", "0100", "4"], ["a & (a - 1)  (erase it)", "1000", "8"]] },
      steps: [{ title: "Why a & −a is the lowest set bit", body: "12 is 00001100. Negating gives 11110100 (flip all bits, add 1). They agree only at bit 2, the lowest set bit, so ANDing leaves 00000100 = 4." }, { title: "Why a & (a − 1) erases it", body: "12 − 1 = 11 is 00001011: the lowest set bit became 0 and the zeros below it became 1. ANDing with 12 clears that bit, leaving 00001000 = 8." }] },
    { kind: "code", id: "code-ops", title: "The operators, run",
      paras: ["Predict each output before reading the comment, especially the last line."],
      code: ops,
      walkthrough: ["`12 & 10 = 8`, `12 | 10 = 14`, `12 ^ 10 = 6` match the table. `12 << 1 = 24` and `12 >> 2 = 3`.", "`x >> 2 & 1` tests bit 2 (which is set in 12) and `x >> 1 & 1` tests bit 1 (which is not). Setting bit 0 gives 13, clearing bit 2 gives 8, toggling bit 3 gives 4.", "`~5` is −6 because `~a == −a − 1`. To view −5 as an 8-bit pattern, mask it: `-5 & 0xFF` is 251, which is `0b11111011`.", "The last two lines are about precedence. In Python `6 & 1 == 0` is already `(6 & 1) == 0`, which is True, because `&` binds tighter than `==` (in C-family languages it would not). And `1 << 2 + 1` is 8, not 5: addition binds tighter than a shift, so it means `1 << (2 + 1)`. Parentheses make the intent obvious."] },
    { kind: "code", id: "code-pop", title: "Counting bits and powers of two",
      paras: ["Kernighan's trick counts set bits with one step per **set** bit: erase the lowest set bit until nothing is left."],
      pseudocode: "count = 0\nwhile x is not 0:\n    x = x with its lowest set bit erased   (x & (x − 1))\n    count += 1",
      code: pop,
      walkthrough: ["`popcount_kernighan(1 << 40)` takes one step (a single set bit) where the plain loop takes 41.", "`is_power_of_two`: a power of two has exactly one set bit, so erasing it leaves 0. The `x > 0` guard excludes 0 (which would pass `(x & (x - 1)) == 0`) and negatives.", "The last line checks 1,000 random numbers up to 10¹² against three methods, including the built-in `bit_count()`: all agree.", "The extra parentheses in `(x & (x - 1)) == 0` are optional in Python (bitwise `&` binds tighter than `==`), but they are required in C, C++, Java and JavaScript, where `==` binds tighter. Writing them makes the line mean the same thing everywhere."] },
    { kind: "code", id: "code-xor", title: "XOR: cancelling, swapping, finding what is missing",
      paras: ["Because `x ^ x = 0` and XOR is order-independent, XOR-ing a whole list makes every value that appears twice vanish. What survives is the value that appears an odd number of times."],
      code: xor,
      walkthrough: ["`single_number([4, 1, 2, 1, 2])`: the pairs of 1s and 2s cancel, leaving 4. One pass, O(1) extra memory, no dictionary.", "`missing_number`: XOR together every index `0..n` and every value present. Every number that is both an index and a value cancels; the missing one has no partner. Here 8 is missing from the nine values.", "Swapping with three XORs works (`a ^= b; b ^= a; a ^= b`) but in Python `a, b = b, a` is clearer: the XOR swap is a curiosity, not a recommendation.", "`5 ^ 3 ^ 5` is 3: the 5s cancel even though they are not adjacent."] },
    { kind: "code", id: "code-subs", title: "A set in one integer: all subsets and submasks",
      paras: ["With a few items, a whole subset fits in one integer. Looping `mask` from 0 to 2ⁿ − 1 visits every subset exactly once. A neat related trick enumerates only the **submasks** of a given mask."],
      code: subs,
      walkthrough: ["`mask >> i & 1` asks whether item i is in the subset; the comprehension builds the subset for each mask. For three items the order is `[]`, `[1]`, `[2]`, `[1, 2]`, `[3]`, …: the mask counts upward like a binary counter.", "There are 2ⁿ subsets, so 1,024 for 10 items. This is feasible up to about n = 20 (a million masks) and hopeless beyond that.", "`submasks(0b101)`: `s = (s − 1) & mask` steps through the subsets of the set bits in decreasing order: 5, 4, 1, 0.", "Summing the submask counts over all masks of 4 bits gives 3⁴ = 81: each item is “not in mask”, “in mask but not in submask”, or “in both”. That is why looping over every mask and all its submasks costs 3ⁿ, not 4ⁿ."] },
    { kind: "complexity", id: "complexity", title: "Costs",
      rows: [
        { what: "A single bitwise operation", time: "O(1)", space: "O(1)", why: "One machine instruction for word-sized integers. (Python's big integers cost O(length).)" },
        { what: "Test, set, clear, toggle one bit", time: "O(1)", space: "O(1)", why: "A shift and one bitwise operation." },
        { what: "popcount by looping every bit", time: "O(bits)", space: "O(1)", why: "One step per bit position." },
        { what: "popcount with Kernighan's trick", time: "O(set bits)", space: "O(1)", why: "Each step erases one set bit." },
        { what: "XOR over a list of n values", time: "O(n)", space: "O(1)", why: "One pass, one accumulator." },
        { what: "Enumerate all subsets of n items", time: "O(n × 2ⁿ)", space: "O(n)", why: "2ⁿ masks, up to n bits each to read." },
        { what: "All submasks of all masks (n bits)", time: "O(3ⁿ)", space: "O(1)", why: "Each item has three states relative to (mask, submask)." }],
      paras: ["Bit tricks make constant factors small, but they do not change the shape of an algorithm: a subset enumeration is still exponential. They shine when they replace a loop (popcount, lowest bit), a dictionary (XOR cancelling), or an array of booleans (a mask)."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Negative numbers in Python", handle: "They behave as infinite two's complement. `x >> 1` rounds toward negative infinity. Mask (`& 0xFFFFFFFF`) when you need a fixed width." }, { case: "x = 0", handle: "`x & (x - 1)` is `0 & -1 = 0`; `is_power_of_two` needs the `x > 0` guard; popcount of 0 is 0; `x & -x` is 0." }, { case: "Shifting by a negative or huge amount", handle: "A negative shift count raises ValueError. `1 << 1000` is fine in Python (big integer) but overflows in C++ and Java: use 64-bit and keep k below 63." }, { case: "Fixed-width languages", handle: "In C++/Java use `1LL << k` for bit 40, beware signed overflow on `1 << 31`, and use unsigned types when shifting right." }, { case: "Operator precedence", handle: "In Python `x & 1 == 0` works, and `1 << k + 1` means `1 << (k + 1)`. In C, C++, Java and JavaScript `==` binds tighter than `&`, so `x & 1 == 0` is a bug (or a compile error in Java) there. Parenthesise every mixed expression." }, { case: "More than ~20 items in a subset mask", handle: "2ⁿ masks are too many. A mask is still fine as a *set representation* (up to 63 items in one integer), just not for enumeration." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Relying on operator precedence you have not checked, such as `1 << k + 1` (which is `1 << (k + 1)`, not `(1 << k) + 1`) or `x & 1 == 0` in C++.", fix: "Parenthesise mixed bit and arithmetic expressions; precedence also differs between Python and the C family." }, { mistake: "Using `^` for exponentiation (`2 ^ 5`).", fix: "`^` is XOR: `2 ^ 5 = 7`. Use `**` for powers or `1 << k` for powers of two." }, { mistake: "Forgetting that `~x` is negative.", fix: "`~x == -x - 1`. To clear a bit use `x & ~mask` (which is fine), but do not print `~x` expecting a flipped 8-bit value." }, { mistake: "`is_power_of_two` without `x > 0`.", fix: "0 passes `(x & (x - 1)) == 0`. Add the guard." }, { mistake: "Overflow in 32-bit languages.", fix: "`1 << 31` is negative in a signed 32-bit int. Use 64-bit (`1LL << k`) for bit positions up to 62." }, { mistake: "Enumerating subsets when n is large.", fix: "2ⁿ grows fast. Above n ≈ 20, look for a DP or a different idea." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a bit-manipulation problem",
      signals: ["“Every value appears **twice except one**” (or three times except one): **XOR** (or bit counts per position).", "“Find the **missing** or **duplicate** number” with values in a tight range, in O(1) space: XOR.", "**n ≤ 20 items** and you must consider subsets: a **bitmask** per subset, or bitmask DP.", "Powers of two, parity, “is this a power of 4?”, “flip all bits”, “count 1 bits”, “lowest set bit”.", "**Toggling** states of many switches or flags, or storing a small set of booleans compactly.", "Problems on **XOR of ranges** or maximising an XOR (often using properties of XOR and binary tries)."],
      notThis: ["You only need ordinary arithmetic and n is large: bit tricks will not help.", "n is above about 20 and the answer needs every subset: no mask enumeration can run in time.", "Readability matters more than a constant factor: `x % 2 == 0` is clearer than `(x & 1) == 0` when speed is irrelevant."] },
    { kind: "worked", id: "worked-two", title: "Two lonely numbers",
      problem: "In a list every value appears exactly twice, except two different values that appear once each. Find those two in O(n) time and O(1) extra space.",
      approach: ["XOR the whole list: pairs cancel, leaving `p ^ q` where p and q are the two lonely values. Since p ≠ q, this is not 0, so some bit is 1 in it: that bit is one where p and q **differ**.", "Pick that bit with `x & -x` (the lowest set bit of the XOR).", "Split the numbers into two groups: those with that bit set, and those without. p and q land in **different** groups, and every pair stays together in one group.", "XOR each group separately: the pairs cancel, leaving p in one and q in the other."],
      code: two,
      takeaway: "The lowest-set-bit trick turns “two unknowns” into two independent “one unknown” problems. Note the case with a negative number works too, because Python's `&` treats it as infinite two's complement." },
    { kind: "worked", id: "worked-count", title: "Bit counts for every number up to n",
      problem: "Return a list `res` where `res[i]` is the number of 1 bits in `i`, for every i from 0 to n, in O(n) total.",
      approach: ["Calling popcount on every number would cost O(n log n).", "Use a recurrence: the bits of `i` are the bits of `i >> 1` (drop the last bit) plus the last bit itself, `i & 1`.", "So `res[i] = res[i >> 1] + (i & 1)`, and `res[i >> 1]` is already known because `i >> 1 < i`."],
      code: cnt,
      takeaway: "This is dynamic programming on bits: the answer for i is built from the answer for a smaller number. The check on the last line compares all 1,001 values with `bin(i).count(\"1\")`. (Subset DP generalises this idea: states are bitmasks.)" },
  ],
  cheatSheet: [{ label: "Test / set / clear / toggle bit k", value: "(x >> k) & 1 · x | (1 << k) · x & ~(1 << k) · x ^ (1 << k)" }, { label: "Lowest set bit; erase it", value: "x & -x · x & (x − 1)" }, { label: "Power of two", value: "x > 0 and (x & (x − 1)) == 0" }, { label: "Popcount", value: "x.bit_count() (3.10+) or loop x &= x − 1" }, { label: "XOR laws", value: "x ^ x = 0 · x ^ 0 = x · order does not matter" }, { label: "Subsets", value: "for mask in range(1 << n): bit i of mask = item i chosen" }],
  summary: ["A number is a row of switches: bitwise operators act on every switch at once.", "A mask `1 << k` tests, sets, clears and toggles one bit; `x & -x` isolates and `x & (x − 1)` erases the lowest set bit.", "XOR cancels equal values, finding a lonely or missing number in O(n) time and O(1) space.", "A bitmask is a compact set; looping over all masks enumerates all subsets, practical up to about 20 items.", "Parenthesise mixed bit expressions, because precedence differs from the C family (in Python `1 << k + 1` is `1 << (k + 1)`), and remember Python integers are unlimited with infinite two's complement for negatives."],
  checks: [
    { kind: "trace", q: "What is `12 ^ 10` (XOR)?", options: ["2", "6", "8", "14"], answer: 1, why: "12 = 1100 and 10 = 1010 differ at bits 1 and 2, giving 0110 = 6." },
    { kind: "concept", q: "What does `x & (x - 1)` do?", options: ["Keeps only the lowest set bit", "Erases the lowest set bit", "Flips every bit", "Doubles x"], answer: 1, why: "Subtracting 1 turns the lowest set bit into 0 and the zeros below it into 1s, so ANDing with x clears exactly that bit." },
    { kind: "trace", q: "What does `1 << 2 + 1` evaluate to in Python?", options: ["3", "5", "8", "It raises an error"], answer: 2, why: "Addition binds tighter than a shift, so it is `1 << (2 + 1)` = 8. The expression `(1 << 2) + 1` would be 5." },
    { kind: "recognize", q: "“Every number in the list appears twice except one; find it in O(1) extra memory” suggests:", options: ["Sorting then scanning", "XOR of all the values", "A dictionary of counts", "Binary search"], answer: 1, why: "XOR cancels pairs, so the single value remains, using no extra memory." },
    { kind: "complexity", q: "How many masks does enumerating all subsets of 20 items visit?", options: ["20", "400", "About a million (2²⁰)", "About 2 × 10¹⁸"], answer: 2, why: "Each of the 20 items is in or out, giving 2²⁰ = 1,048,576 masks." },
    { kind: "concept", q: "Why does `is_power_of_two` need the `x > 0` guard?", options: ["Powers of two are positive, and 0 would wrongly pass `(x & (x - 1)) == 0`", "To avoid overflow", "Python requires it", "Negative numbers are powers of two"], answer: 0, why: "0 & −1 is 0, so zero would be reported as a power of two without the guard." },
    { kind: "trace", q: "What does print(5 ^ 3) print?", options: ["6", "8", "2", "7"], answer: 0, why: "101 XOR 011 = 110, which is 6." },
    { kind: "trace", q: "How many set bits does 13 have? (print(bin(13).count('1')))", options: ["3", "2", "4", "1"], answer: 0, why: "13 is 1101 in binary, with three ones." },
    { kind: "trace", q: "What does print(12 & 11) print?", options: ["8", "4", "12", "3"], answer: 0, why: "1100 AND 1011 = 1000, which is 8." },
    { kind: "trace", q: "What is the lowest set bit of 12, as printed by print(12 & -12)?", options: ["4", "8", "12", "1"], answer: 0, why: "12 is 1100; its lowest set bit is 100, which is 4." },
    { kind: "trace", q: "In [4, 1, 2, 1, 2], every value appears twice except one. What does XOR of all values print?", options: ["4", "1", "2", "0"], answer: 0, why: "Pairs cancel under XOR, leaving the single value 4." },
    { kind: "concept", q: "What does x & (x - 1) do?", options: ["It clears the lowest set bit of x", "It doubles x", "It takes the square root", "It sorts the bits"], answer: 0, why: "Subtracting 1 flips the lowest set bit and the zeros after it, so the AND removes it." },
    { kind: "trace", q: "What does print(1 << 10) print?", options: ["1024", "10", "100", "512"], answer: 0, why: "Shifting 1 left by 10 places gives 2^10 = 1024." },
    { kind: "complexity", q: "Counting set bits by repeatedly clearing the lowest bit takes how long?", options: ["O(number of set bits)", "O(n\u00b2)", "O(1) always", "O(log n) only with a hash map"], answer: 0, why: "Each step removes one set bit." },
    { kind: "concept", q: "What is x XOR x for any value x?", options: ["0", "x", "1", "undefined"], answer: 0, why: "Every bit cancels with itself." },
  ],
  nextNote: "Bit tricks are the key to **bitmask DP**, covered in the planned Advanced DP topic.",
};
