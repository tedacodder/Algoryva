import type { LessonV2 } from "../lesson-types";

const naive = String.raw`def gcd_naive(a, b):
    best = 1
    for d in range(1, min(a, b) + 1):
        if a % d == 0 and b % d == 0:
            best = d
    return best

print(gcd_naive(48, 18))   # 6
print(gcd_naive(17, 5))   # 1`;
const gcdcode = String.raw`def gcd(a, b):
    while b:
        a, b = b, a % b
    return a

def lcm(a, b):
    return a // gcd(a, b) * b

print(gcd(48, 18), lcm(4, 6))   # 6 12
print(gcd(17, 5), gcd(0, 9), gcd(9, 0))   # 1 9 9
print(gcd(10**18, 10**12 + 6))   # 2
import math
print(math.gcd(48, 18), math.lcm(4, 6))   # 6 12`;
const primes = String.raw`def is_prime(n):
    if n < 2:
        return False
    i = 2
    while i * i <= n:
        if n % i == 0:
            return False
        i += 1
    return True

def sieve(n):
    if n < 2:
        return []
    is_p = [True] * (n + 1)
    is_p[0] = is_p[1] = False
    i = 2
    while i * i <= n:
        if is_p[i]:
            for m in range(i * i, n + 1, i):
                is_p[m] = False
        i += 1
    return [i for i, p in enumerate(is_p) if p]

print([x for x in range(2, 30) if is_prime(x)])   # [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
print(is_prime(1), is_prime(97), is_prime(10**9 + 7))   # False True True
print(sieve(30))   # [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
print(len(sieve(100)), len(sieve(10**6)))   # 25 78498
print(sieve(1), sieve(2))   # [] [2]`;
const factor = String.raw`def factorize(n):
    f = {}
    d = 2
    while d * d <= n:
        while n % d == 0:
            f[d] = f.get(d, 0) + 1
            n //= d
        d += 1
    if n > 1:
        f[n] = f.get(n, 0) + 1
    return f

print(factorize(360))   # {2: 3, 3: 2, 5: 1}
print(factorize(97))   # {97: 1}
print(factorize(1))   # {}

def count_divisors(n):
    total = 1
    for e in factorize(n).values():
        total *= e + 1
    return total

print(count_divisors(360))   # 24`;
const modular = String.raw`MOD = 10**9 + 7

a, b = 123456789123, 987654321987
print(a * b % MOD == (a % MOD) * (b % MOD) % MOD)   # True
print(-7 % 5, 7 % -5)   # 3 -3

def power_mod(base, exp, mod):
    result = 1
    base %= mod
    while exp > 0:
        if exp & 1:
            result = result * base % mod
        base = base * base % mod
        exp >>= 1
    return result

print(power_mod(2, 10, 1000), pow(2, 10, 1000))   # 24 24
print(power_mod(3, 200, 13) == pow(3, 200, 13))   # True
print(3 * pow(3, MOD - 2, MOD) % MOD)   # 1
print(pow(3, -1, 11))   # 4`;
const pairs = String.raw`def can_pair(arr, k):
    cnt = [0] * k
    for x in arr:
        cnt[x % k] += 1
    if cnt[0] % 2:
        return False
    for r in range(1, k // 2 + 1):
        if r == k - r:
            if cnt[r] % 2:
                return False
        elif cnt[r] != cnt[k - r]:
            return False
    return True

print(can_pair([1, 2, 3, 4, 5, 10, 6, 7, 8, 9], 5))   # True
print(can_pair([1, 2, 3, 4, 5, 6], 7))   # True
print(can_pair([1, 2, 3, 4, 5, 6], 10))   # False
print(can_pair([-1, 1, -2, 2, -3, 3, -4, 4], 3))   # True`;
const ugly = String.raw`from math import gcd

def lcm(a, b):
    return a // gcd(a, b) * b

def nth_ugly(n, a, b, c):
    ab, ac, bc = lcm(a, b), lcm(a, c), lcm(b, c)
    abc = lcm(ab, c)

    def count(x):
        return x // a + x // b + x // c - x // ab - x // ac - x // bc + x // abc

    lo, hi = 1, 2 * 10**9
    while lo < hi:
        mid = (lo + hi) // 2
        if count(mid) >= n:
            hi = mid
        else:
            lo = mid + 1
    return lo

print(nth_ugly(3, 2, 3, 5))   # 4
print(nth_ugly(4, 2, 3, 4))   # 6
print(nth_ugly(5, 2, 11, 13))   # 10`;

export const numerics: LessonV2 = {
  topic: "numerics", depth: "complete", minutes: 45,
  hook: "The arithmetic toolkit of contests: remainders, gcd, primes, factorisation and modular arithmetic, each turning a huge computation into a few steps.",
  objectives: [
    "Use remainders (`%`) to reason about divisibility, cycles and grouping, including with negative numbers.",
    "Compute gcd with Euclid's algorithm and lcm from it, and explain why Euclid is fast.",
    "Test primality in O(√n), list primes with the sieve of Eratosthenes, and factorise a number.",
    "Do arithmetic modulo a prime, including fast modular exponentiation and inverses.",
    "Recognise when a counting problem is really about divisibility, and combine it with binary search and inclusion–exclusion.",
  ],
  prereqNote: "Recursion I, for the idea of a problem shrinking each step. You need to be comfortable with `//`, `%` and loops from Python Basics.",
  sections: [
    { kind: "intuition", id: "clock", title: "Arithmetic on a clock",
      paras: ["If it is 10 o'clock now, what time is it in 5 hours? Not 15: it is 3. A clock only remembers the **remainder** after dividing by 12. That wrap-around arithmetic, remainders, is the engine behind divisibility tests, repeating patterns, calendars, hashing, and the “answer modulo 10⁹ + 7” that ends so many contest statements.",
        "Numbers also have a *structure*: they break into prime building blocks, and pairs of numbers share common factors. Knowing these facts lets you answer questions about numbers up to 10¹⁸ without ever looping that far."] },
    { kind: "naive", id: "naive", title: "Find the gcd by trying every divisor",
      paras: ["The greatest common divisor of a and b is the largest number dividing both. The direct way tests every candidate from 1 up to the smaller number and remembers the biggest that works.",
        "That is up to min(a, b) steps. For numbers around 10¹⁸ it would take longer than the age of the universe, yet Euclid's method, below, needs fewer than a hundred steps."],
      code: naive,
      cost: "O(min(a, b)) steps: far too slow for large numbers." },
    { kind: "observation", id: "observation", title: "A common divisor of a and b also divides their remainder",
      paras: ["Write a = q·b + r where r = a mod b. Any number that divides both a and b divides q·b and therefore divides a − q·b = r. Conversely, anything dividing both b and r divides a. So the pairs (a, b) and (b, r) have exactly the same common divisors, hence the same gcd.",
        "That lets us replace the pair by a *smaller* pair. Repeat until the second number is 0; then the gcd is the first. The remainder is always less than the divisor, and in two steps a is at least halved, so the loop runs about log of the numbers."] },
    { kind: "viz", id: "viz-gcd", title: "Euclid's algorithm", viz: "gcd-euclid",
      paras: ["Two numbers shrink step by step: replace (a, b) with (b, a mod b) until the second is 0. Each caption states why the gcd does not change when we do that."] },
    { kind: "concept", id: "toolkit", title: "The toolkit in one table",
      paras: ["Almost every numeric problem in a contest uses one or two of these ideas."],
      bullets: ["**Remainder:** `a % m` is always in `0..m-1` for positive `m` in Python, even for negative `a`. Two numbers are **congruent** mod m if they leave the same remainder.", "**gcd and lcm:** `gcd(a, b)` by Euclid; `lcm(a, b) = a / gcd(a, b) × b` (divide first to keep numbers small). gcd(0, x) = x.", "**Prime:** an integer greater than 1 whose only divisors are 1 and itself. Every integer greater than 1 is a **unique product of primes** (its factorisation).", "**Divisor count and sum** follow from the factorisation: if n = p₁^e₁ · p₂^e₂ ⋯, then the number of divisors is (e₁ + 1)(e₂ + 1)⋯.", "**Modular arithmetic:** `(a + b) % m`, `(a * b) % m` can be computed from the remainders of a and b. This keeps numbers small and answers within range.", "**Modular inverse:** for prime m, `a⁻¹ ≡ a^(m−2) (mod m)` (Fermat). Division modulo m becomes multiplication by the inverse.", "**Inclusion–exclusion:** to count numbers divisible by a, b or c, add the single counts, subtract the pairs, add back the triple."] },
    { kind: "example", id: "example", title: "Euclid and a factorisation, by hand",
      paras: ["First gcd(48, 18): at each step replace the pair (a, b) by (b, a mod b) until the second number is 0."],
      table: { head: ["step", "a", "b", "a mod b", "next pair"], rows: [["1", "48", "18", "12", "(18, 12)"], ["2", "18", "12", "6", "(12, 6)"], ["3", "12", "6", "0", "(6, 0)"], ["done", "6", "0", "-", "gcd = 6"]] },
      steps: [{ title: "Check the answer", body: "6 divides 48 (8 times) and 18 (3 times), and no larger number divides both. Three steps instead of testing 18 candidates." }, { title: "Factorising 360 by trial division", body: "Divide by 2 while possible: 360 → 180 → 90 → 45 (three 2s). Divide by 3: 45 → 15 → 5 (two 3s). The next divisor 4 has 4 × 4 = 16 > 5, so stop. The leftover 5 is prime. So 360 = 2³ · 3² · 5." }, { title: "Reading the factorisation", body: "Number of divisors: (3 + 1)(2 + 1)(1 + 1) = 24. The gcd of two numbers takes the *smaller* exponent of each prime; the lcm takes the *larger*." }] },
    { kind: "code", id: "code-gcd", title: "gcd and lcm",
      paras: ["Euclid's algorithm is a three-line loop."],
      pseudocode: "while b is not 0:\n    (a, b) = (b, a mod b)\nreturn a",
      code: gcdcode,
      walkthrough: ["`a, b = b, a % b` does both updates at once: the right side is evaluated first, so `a % b` uses the old values.", "`lcm` divides **first** (`a // gcd(a, b) * b`). Multiplying first (`a * b // gcd`) can create a number twice as long as needed. That does not matter in Python but overflows in C++ and Java.", "`gcd(0, 9)` and `gcd(9, 0)` are both 9: the loop handles zeros naturally. `gcd(10**18, 10**12 + 6)` takes only a few dozen iterations.", "Python's `math.gcd` and `math.lcm` do the same; use them in contests, write your own to understand them."] },
    { kind: "viz", id: "viz-sieve", title: "Finding all primes at once: the sieve", viz: "sieve",
      paras: ["To list every prime up to n, do not test each number separately. Instead cross out multiples: for each number still standing, cross out its multiples. Whatever survives is prime. Notice it starts crossing at p², because smaller multiples of p have a smaller prime factor and were already removed, and that it stops once p² exceeds n."] },
    { kind: "code", id: "code-primes", title: "Primality test and sieve",
      paras: ["To test one number, only divisors up to √n matter: if n = a·b then one of a, b is at most √n. To list all primes up to n, the sieve is far faster than testing each."],
      code: primes,
      walkthrough: ["`while i * i <= n` is the √n limit, written without floating point.", "Both functions treat 0 and 1 as not prime. `sieve` returns early for n < 2; otherwise assigning `is_p[0] = is_p[1] = False` on a too-short list would fail.", "The inner loop `range(i * i, n + 1, i)` crosses out multiples of `i` starting at `i²`.", "There are 25 primes up to 100 and 78,498 up to a million, and the sieve finishes the million in a fraction of a second."] },
    { kind: "code", id: "code-factor", title: "Factorisation and counting divisors",
      paras: ["Trial division by 2, 3, 4, … up to √n finds every prime factor. Whatever is left above 1 at the end is itself a prime."],
      code: factor,
      walkthrough: ["`while n % d == 0` pulls out **all** copies of `d` before moving on; 360 = 2³ · 3² · 5.", "Dividing `n` as we go makes the remaining number smaller, so the `d * d <= n` limit shrinks too.", "After the loop, `n > 1` means a single prime factor larger than √(original) remains (97 is its own factor).", "Divisor count: (3 + 1)(2 + 1)(1 + 1) = 24 divisors of 360. A number is a perfect square exactly when every exponent is even."] },
    { kind: "code", id: "code-mod", title: "Modular arithmetic",
      paras: ["Contest answers are often “modulo 10⁹ + 7” (a prime) because the true answer is astronomically large. The rules are simple: you can take the remainder at any stage of additions, subtractions and multiplications."],
      code: modular,
      walkthrough: ["`a * b % MOD` equals `(a % MOD) * (b % MOD) % MOD`, so reduce early and keep every number small.", "Python's `%` gives a non-negative result when the modulus is positive: `-7 % 5` is 3. (With a negative modulus the result takes the modulus's sign: `7 % -5` is -3.) In C++ `-7 % 5` is -2, so people write `((x % m) + m) % m` there.", "`power_mod` squares the base each step and multiplies in the result whenever the current bit of the exponent is 1: about log₂(exp) steps even for exponents like 10¹⁸. Python's `pow(b, e, m)` does exactly this.", "Division mod a prime uses the inverse: `pow(3, MOD - 2, MOD)` is 3⁻¹, and 3 times it is 1. Since Python 3.8, `pow(3, -1, 11)` computes an inverse directly (4, since 3 × 4 = 12 ≡ 1)."] },
    { kind: "complexity", id: "complexity", title: "Costs",
      rows: [
        { what: "gcd by Euclid", time: "O(log min(a, b))", space: "O(1)", why: "The numbers at least halve every two steps." },
        { what: "gcd by trying divisors (naive)", time: "O(min(a, b))", space: "O(1)", why: "Tests every candidate." },
        { what: "Primality test by trial division", time: "O(√n)", space: "O(1)", why: "Only divisors up to √n are needed." },
        { what: "Sieve of Eratosthenes up to n", time: "O(n log log n)", space: "O(n)", why: "Each prime p crosses out n/p numbers; the sum of n/p over primes is about n log log n." },
        { what: "Factorising one number", time: "O(√n)", space: "O(log n)", why: "Trial division up to √n; at most log₂ n prime factors." },
        { what: "Modular exponentiation", time: "O(log exp)", space: "O(1)", why: "One squaring per bit of the exponent." },
        { what: "Factorising many numbers (a smallest-prime-factor sieve)", time: "O(n log log n) once, then O(log n) each", space: "O(n)", why: "Precompute for every number its smallest prime factor, then divide repeatedly." }],
      paras: ["For n up to 10¹², O(√n) trial division is fine (10⁶ steps). For n up to 10¹⁸ it is not (10⁹ steps): that is where Miller–Rabin and Pollard's rho come in, beyond this course."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "0 and 1", handle: "1 is neither prime nor composite; gcd(x, 0) = x; 0 % m = 0. Guard `n < 2` in primality and sieve code." }, { case: "Negative numbers", handle: "Python's `%` with a positive modulus is non-negative, so remainder buckets work directly. In other languages, normalise first." }, { case: "Perfect squares in primality tests", handle: "Use `i * i <= n` (inclusive) so 25 is checked against 5 and found composite." }, { case: "Overflow in other languages", handle: "Python ints never overflow, but in C++/Java use 64-bit types, take `% MOD` after every multiplication, and compute lcm as `a / g * b`." }, { case: "Modulus is not prime", handle: "Fermat inverses need a prime modulus. For other moduli use the extended Euclidean algorithm (or `pow(a, -1, m)` when gcd(a, m) = 1)." }, { case: "Huge sieve limits", handle: "A sieve needs O(n) memory. For n around 10⁸ use a bytearray, or a segmented sieve." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Testing every number up to n for primality.", fix: "Stop at √n, or sieve once if you need many primes." }, { mistake: "Computing `a ** b % m` directly.", fix: "That builds a gigantic number first. Use `pow(a, b, m)`." }, { mistake: "Forgetting to reduce modulo m after each multiplication in loops (in C++/Java).", fix: "Reduce at every step; mod after the final answer is too late once overflow happens." }, { mistake: "Subtracting under a modulus and leaving a negative.", fix: "Use `(a - b) % m` in Python, or add `m` before the final `%` elsewhere." }, { mistake: "Treating floating-point `sqrt` or division as exact.", fix: "Use integer tools: `math.isqrt`, `//`, and `i * i <= n`." }, { mistake: "Counting divisible numbers without inclusion–exclusion.", fix: "Numbers divisible by both a and b are counted twice if you simply add `x//a + x//b`; subtract `x // lcm(a, b)`." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a numerics problem",
      signals: ["Words like **divisible**, **remainder**, **multiple**, **divisor**, **gcd**, **lcm**, **prime**, **factor**.", "“**Return the answer modulo 10⁹ + 7**”: the true answer is huge; use modular arithmetic throughout.", "The bound is **10⁹ or 10¹⁸**: you cannot loop to n, but you can loop to √n or use log n tricks.", "A **cycle or repetition**: days of the week, positions on a circle, patterns that repeat with some period: remainders.", "“Count numbers up to x divisible by …” or “find the n-th such number”: inclusion–exclusion, often with binary search.", "“How many subarrays have gcd k?”: the gcd of a growing range only changes O(log) times, because each change at least halves it."],
      notThis: ["The numbers are small and the question is about order or position rather than divisibility: arrays and sorting are the tools.", "You need exact big arithmetic beyond 64 bits in C++: use Python or a big-integer library."] },
    { kind: "worked", id: "worked-pairs", title: "Can the array be split into pairs with sums divisible by k?",
      problem: "Given an even-length array and a positive integer k, decide whether the elements can be split into pairs so that every pair's sum is divisible by k.",
      approach: ["Only remainders matter: a pair (x, y) has a sum divisible by k exactly when `x % k` and `y % k` add up to 0 or to k.", "Count how many elements leave each remainder 0 to k − 1.", "Remainder 0 pairs with remainder 0, so that count must be even. If k is even, remainder k/2 pairs with itself, so that count must be even too.", "Otherwise remainder r pairs with remainder k − r, so their counts must be equal."],
      code: pairs,
      takeaway: "Replacing each number by its remainder collapses a problem about huge values into a tiny table of k counts. Python's non-negative `%` makes negative inputs work with no extra care (the last example)." },
    { kind: "worked", id: "worked-ugly", title: "The n-th number divisible by a, b or c",
      problem: "Return the n-th positive integer that is divisible by at least one of a, b or c (up to 2 × 10⁹).",
      approach: ["Listing numbers one by one is far too slow, but *counting* how many valid numbers are at most x is fast: `x//a + x//b + x//c`, minus the pairs counted twice, plus the triple counted back in (inclusion–exclusion with lcm).", "`count(x)` never decreases as x grows, so we can binary search for the smallest x with `count(x) >= n`.", "That x is the n-th valid number."],
      code: ugly,
      takeaway: "Two lessons combine: a counting function from number theory (inclusion–exclusion with lcm) and binary search on a monotonic predicate. About 31 iterations replace billions of steps." },
  ],
  cheatSheet: [{ label: "gcd / lcm", value: "while b: a, b = b, a % b · lcm = a // gcd × b" }, { label: "Prime test", value: "n ≥ 2 and no divisor d with d·d ≤ n" }, { label: "Sieve", value: "cross out i·i, i·i+i, … for each surviving i ≤ √n" }, { label: "Factorise", value: "divide out d from 2 while d·d ≤ n; leftover n > 1 is prime" }, { label: "Modular", value: "reduce after every + − ×; pow(b, e, m); inverse pow(a, m−2, m)" }, { label: "Count multiples ≤ x", value: "x // a; union via inclusion–exclusion with lcm" }],
  summary: ["Remainders turn huge numbers into small, repeating patterns; Python's `%` is non-negative for a positive modulus.", "Euclid's algorithm computes gcd in O(log n) because (a, b) and (b, a mod b) share the same common divisors.", "Primes: test up to √n, list with the sieve (O(n log log n)), factorise by trial division.", "Work modulo a prime with `pow(b, e, m)`, reduce after every operation, and divide with modular inverses.", "Count divisible numbers with inclusion–exclusion, and combine with binary search when you need the n-th."],
  checks: [
    { kind: "trace", q: "What is `gcd(48, 18)`, following Euclid's algorithm?", options: ["3", "6", "9", "12"], answer: 1, why: "gcd(48, 18) → gcd(18, 12) → gcd(12, 6) → gcd(6, 0) = 6." },
    { kind: "complexity", q: "How many divisors must you test to decide whether n = 10¹² is prime by trial division?", options: ["About 10⁶ (up to √n)", "About 10¹²", "About 40", "About 10⁹"], answer: 0, why: "If n has a divisor, it has one at most √n = 10⁶, so testing up to there is enough." },
    { kind: "concept", q: "Why does the sieve start crossing out multiples of p at p² instead of 2p?", options: ["It is a typo", "Smaller multiples of p have a smaller prime factor and were already crossed out", "p² is always prime", "To avoid crossing out p"], answer: 1, why: "A multiple k·p with k < p has a prime factor smaller than p, so an earlier pass has already removed it." },
    { kind: "trace", q: "How many divisors does 360 = 2³ · 3² · 5 have?", options: ["10", "12", "24", "30"], answer: 2, why: "(3 + 1)(2 + 1)(1 + 1) = 24." },
    { kind: "recognize", q: "“Count the pairs of numbers whose sum is divisible by 7” most strongly suggests:", options: ["Counting elements by remainder mod 7", "Sorting and binary search", "A sieve", "Graph traversal"], answer: 0, why: "A sum is divisible by 7 exactly when the remainders add to 0 or 7, so counts per remainder are enough." },
    { kind: "concept", q: "Why compute `pow(a, b, m)` rather than `a ** b % m` for large b?", options: ["It is shorter", "`a ** b` builds an enormous number first; `pow` with a modulus stays small and takes O(log b) steps", "`**` is not allowed with `%`", "They give different answers"], answer: 1, why: "Modular exponentiation reduces after every multiplication, so numbers never grow, and squaring makes it logarithmic in the exponent." },
    { kind: "trace", q: "What does print(pow(2, 10, 1000)) print?", options: ["24", "1024", "0", "8"], answer: 0, why: "2^10 = 1024, and 1024 mod 1000 = 24." },
    { kind: "trace", q: "What does print(7 // -2, -7 // 2) print?", options: ["-4 -4", "-3 -3", "-4 -3", "-3 -4"], answer: 0, why: "Floor division rounds toward negative infinity: 7/-2 = -3.5 floors to -4, and -7/2 = -3.5 floors to -4." },
    { kind: "trace", q: "What does print(-7 % 3) print?", options: ["2", "-1", "1", "-2"], answer: 0, why: "Python's % takes the sign of the divisor: -7 = 3 * (-3) + 2." },
    { kind: "trace", q: "What does print(round(2.5), round(3.5)) print?", options: ["2 4", "3 4", "2 3", "3 3"], answer: 0, why: "Python rounds halves to the nearest even integer (banker's rounding)." },
    { kind: "trace", q: "What are gcd and lcm of 84 and 36, as printed by print(math.gcd(84,36), 84*36//math.gcd(84,36))?", options: ["12 252", "12 3024", "6 504", "24 252"], answer: 0, why: "gcd(84,36)=12, and lcm = 84*36/12 = 252." },
    { kind: "trace", q: "How many primes are there up to 30? (sieve of Eratosthenes)", options: ["10", "9", "11", "8"], answer: 0, why: "The primes up to 30 are 2, 3, 5, 7, 11, 13, 17, 19, 23 and 29." },
    { kind: "complexity", q: "What is the running time of the Sieve of Eratosthenes up to n?", options: ["O(n log log n)", "O(n\u00b2)", "O(n)", "O(log n)"], answer: 0, why: "The marking work sums to n times (1/2 + 1/3 + 1/5 + ...), which grows like log log n." },
    { kind: "concept", q: "Why reduce each factor modulo m before multiplying, when computing (a * b) % m?", options: ["Intermediate values stay small, so the product never grows larger than the calculation needs", "Modulo does not work on products", "Python cannot multiply large numbers", "It gives a different final answer"], answer: 0, why: "Reducing first gives the same answer and keeps numbers small, which matters in languages with fixed-width integers." },
    { kind: "trace", q: "What is 10**18 * 10**18 % 7 in Python?", options: ["1", "0", "4", "6"], answer: 0, why: "10**6 is 1 mod 7, so 10**18 is 1 mod 7 and the product is 1 mod 7." },
  ],
  nextNote: "Next, **Topological Sort** orders tasks that depend on one another, using the BFS and DFS you already know.",
};
