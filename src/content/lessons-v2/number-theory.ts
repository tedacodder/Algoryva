import type { LessonV2 } from "../lesson-types";

const BUILD = String.raw`MOD = 10**9 + 7

def build(n):
    fact = [1] * (n + 1)
    for i in range(1, n + 1):
        fact[i] = fact[i - 1] * i % MOD
    inv = [1] * (n + 1)
    inv[n] = pow(fact[n], MOD - 2, MOD)          # one modular inverse (Fermat) ...
    for i in range(n, 0, -1):
        inv[i - 1] = inv[i] * i % MOD            # ... then every other one for free
    return fact, inv

fact, inv = build(10**5)

def ncr(n, r):
    if r < 0 or r > n:
        return 0
    return fact[n] * inv[r] % MOD * inv[n - r] % MOD`;
const naive = String.raw`from math import comb, factorial

p = 1000003                      # a prime
n, r = 2000, 1000
exact = comb(n, r) % p
tempting = (factorial(n) % p) // ((factorial(r) % p) * (factorial(n - r) % p) % p)
print(exact, tempting)   # 311237 0
print(exact == tempting)   # False`;
const inverse = String.raw`def ext_gcd(a, b):
    if b == 0:
        return a, 1, 0
    g, x, y = ext_gcd(b, a % b)
    return g, y, x - (a // b) * y          # a*x + b*y = g

def mod_inverse(a, m):
    g, x, _ = ext_gcd(a % m, m)
    return x % m if g == 1 else None       # an inverse exists only when gcd(a, m) = 1

print(ext_gcd(240, 46))   # (2, -9, 47)
print(mod_inverse(3, 11), mod_inverse(10, 17), mod_inverse(4, 8))   # 4 12 None
print(pow(3, -1, 11), pow(3, 11 - 2, 11))   # 4 4
print(all(a * mod_inverse(a, 101) % 101 == 1 for a in range(1, 101)))   # True`;
const ncrCode = String.raw`from math import comb

${BUILD}

print(ncr(5, 2), ncr(10, 0), ncr(10, 10), ncr(3, 5))   # 10 1 1 0
print(ncr(100000, 50000))   # 149033233
print(all(ncr(n, r) == comb(n, r) % MOD for n in range(0, 60) for r in range(0, n + 2)))   # True
print(ncr(2000, 1000) == comb(2000, 1000) % MOD)   # True`;
const pascal = String.raw`def pascal(n, m):
    t = [[0] * (n + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        t[i][0] = 1
        for j in range(1, i + 1):
            t[i][j] = (t[i - 1][j - 1] + t[i - 1][j]) % m
    return t

t = pascal(6, 10**9 + 7)
print(t[6][:7])   # [1, 6, 15, 20, 15, 6, 1]
print(sum(t[6]) == 2**6)   # True
print(pascal(10, 6)[10][3])   # 0
print(pascal(30, 10**9 + 7)[30][15])   # 155117520`;
const phi = String.raw`from math import gcd

def totients(n):
    phi = list(range(n + 1))
    for i in range(2, n + 1):
        if phi[i] == i:                        # i has not been touched, so it is prime
            for j in range(i, n + 1, i):
                phi[j] -= phi[j] // i
    return phi

phi = totients(30)
print(phi[1:13])   # [1, 1, 2, 2, 4, 2, 6, 4, 6, 4, 10, 4]
print(phi[30], phi[29])   # 8 28
print(all(phi[n] == sum(1 for k in range(1, n + 1) if gcd(k, n) == 1) for n in range(1, 31)))   # True
print(pow(3, phi[10], 10))   # 1`;
const counting = String.raw`from itertools import product
from math import comb, factorial

def stars_and_bars(n, k):                      # n identical items into k boxes
    return comb(n + k - 1, k - 1)

def stars_brute(n, k):
    return sum(1 for xs in product(range(n + 1), repeat=k) if sum(xs) == n)

def catalan(n):
    return comb(2 * n, n) // (n + 1)

def balanced(n):                               # brute force: valid bracket strings of length 2n
    count = 0
    for s in product("()", repeat=2 * n):
        depth = 0
        for ch in s:
            depth += 1 if ch == "(" else -1
            if depth < 0:
                break
        else:
            count += depth == 0
    return count

print(stars_and_bars(5, 3), stars_brute(5, 3))   # 21 21
print([catalan(i) for i in range(8)])   # [1, 1, 2, 5, 14, 42, 132, 429]
print(all(balanced(n) == catalan(n) for n in range(0, 6)))   # True
print(factorial(5) // (factorial(2) * factorial(2) * factorial(1)))   # 30`;
const paths = String.raw`${BUILD}

def paths_through(R, C, a, b):                 # right/down moves from (1,1) to (R,C), passing through (a,b)
    return ncr(a + b - 2, a - 1) * ncr(R - a + C - b, R - a) % MOD

def paths_dp(R, C, a, b):                      # independent check: count with a table
    def grid_paths(r1, c1, r2, c2):
        if r2 < r1 or c2 < c1:
            return 0
        dp = [[0] * (c2 - c1 + 1) for _ in range(r2 - r1 + 1)]
        for i in range(len(dp)):
            for j in range(len(dp[0])):
                dp[i][j] = 1 if i == 0 and j == 0 else (dp[i - 1][j] if i else 0) + (dp[i][j - 1] if j else 0)
        return dp[-1][-1]
    return grid_paths(1, 1, a, b) * grid_paths(a, b, R, C) % MOD

print(paths_through(3, 3, 2, 2))   # 4
print(paths_through(3, 7, 1, 1))   # 28
print(all(paths_through(R, C, a, b) == paths_dp(R, C, a, b) for R in range(1, 7) for C in range(1, 7) for a in range(1, R + 1) for b in range(1, C + 1)))   # True`;
const coprime = String.raw`from math import gcd

def distinct_primes(m):
    ps = []
    d = 2
    while d * d <= m:
        if m % d == 0:
            ps.append(d)
            while m % d == 0:
                m //= d
        d += 1
    if m > 1:
        ps.append(m)
    return ps

def coprime_count(n, m):                       # how many k in 1..n have gcd(k, m) = 1
    primes = distinct_primes(m)
    total = 0
    for mask in range(1 << len(primes)):
        prod, bits = 1, 0
        for i, p in enumerate(primes):
            if mask >> i & 1:
                prod *= p
                bits += 1
        total += (-1) ** bits * (n // prod)    # add or subtract multiples of this combination
    return total

print(coprime_count(30, 30))   # 8
print(coprime_count(100, 12))   # 33
print(coprime_count(10**12, 30030))   # 191808191808
print(all(coprime_count(n, m) == sum(gcd(k, m) == 1 for k in range(1, n + 1)) for n in range(0, 40) for m in range(1, 30)))   # True`;

export const numberTheory: LessonV2 = {
  topic: "number-theory", depth: "complete", minutes: 60,
  hook: "Count arrangements and choices when the answer is astronomically large: modular inverses, binomial coefficients, totients and inclusion–exclusion.",
  objectives: [
    "Explain why division does not work modulo a prime and what a modular inverse is, and compute one with Fermat's theorem or extended Euclid.",
    "Precompute factorials and inverse factorials to answer C(n, r) mod p in O(1) per query.",
    "Build Pascal's triangle for any modulus, and use the identity C(n, r) = C(n−1, r−1) + C(n−1, r).",
    "Compute Euler's totient and use inclusion–exclusion to count numbers with a divisibility property.",
    "Recognise counting problems (paths, arrangements, distributions, balanced brackets) and map them to a formula.",
  ],
  prereqNote: "Numerics is essential: remainders, gcd, primes and modular exponentiation. Bit Manipulation is not needed, except the inclusion–exclusion masks, which use the same idea.",
  sections: [
    { kind: "intuition", id: "arrangements", title: "How many ways? (and the answer will not fit in any variable)",
      paras: ["How many ways can you pick 3 friends from 10 for a trip? 120. How many ways can you pick 50,000 from 100,000? A number with about 30,000 digits. Contest problems ask for such counts **modulo 10⁹ + 7**: you are only asked for the remainder, which fits comfortably in a variable.",
        "The catch: counting formulas contain **division** (n! divided by r! and (n − r)!), and division does not survive taking remainders the way addition and multiplication do. This lesson fixes that with modular inverses, then builds the standard toolkit of counting."] },
    { kind: "naive", id: "naive", title: "Take remainders, then divide",
      paras: ["The formula is C(n, r) = n! / (r! · (n − r)!). Since the numbers are huge, a natural idea is to reduce each factorial modulo p first and then divide.",
        "That is wrong. Remainders respect `+`, `−` and `×`, but not `/`. For n = 2000, r = 1000 and the prime p = 1,000,003, the true answer is 311,237, while “reduce, then divide” gives 0. Computing exact big integers with `math.comb` works for one query, but a factorial of 10⁵ has about 456,000 digits, so thousands of queries are far too slow."],
      code: naive,
      cost: "Wrong as written, and exact big integers cost far too much for many queries." },
    { kind: "observation", id: "observation", title: "Dividing by b means multiplying by b's inverse",
      paras: ["Modulo a prime p, every non-zero number b has a **modular inverse** b⁻¹ with b · b⁻¹ ≡ 1. Then “divide by b” becomes “multiply by b⁻¹”, which does respect remainders. By Fermat's little theorem, b⁻¹ ≡ b^(p−2) (mod p), computable in O(log p) with fast exponentiation.",
        "For many queries compute the factorials once, take **one** inverse (of n!), and walk down to get the inverse of every smaller factorial for free using `inv[i−1] = inv[i] · i`. Then each C(n, r) is two multiplications."] },
    { kind: "concept", id: "concept", title: "The toolkit",
      paras: ["Number theory gives you the arithmetic; combinatorics gives you the counting rules."],
      bullets: ["**Modular inverse:** `a⁻¹ mod m` exists exactly when `gcd(a, m) = 1`. For a prime modulus use Fermat (`pow(a, p − 2, p)`); for any modulus use extended Euclid or `pow(a, -1, m)` (Python 3.8+).", "**Extended Euclid:** finds `x, y` with `a·x + b·y = gcd(a, b)`; when the gcd is 1, `x mod m` is the inverse of `a` modulo `m`.", "**Euler's totient φ(n):** how many numbers from 1 to n are coprime to n. Euler's theorem: `a^φ(m) ≡ 1 (mod m)` when `gcd(a, m) = 1`.", "**Product and sum rules:** independent choices multiply; alternatives add.", "**Permutations and combinations:** arrangements of r out of n are `n!/(n−r)!`; choices (order ignored) are `C(n, r) = n!/(r!(n−r)!)`. Arrangements with repeated items: `n! / (k₁! k₂! …)`.", "**Pascal's rule:** `C(n, r) = C(n−1, r−1) + C(n−1, r)`. It needs no division, so it works for **any** modulus, in O(n²).", "**Stars and bars:** distributing n identical items into k boxes (boxes may be empty) can be done in `C(n + k − 1, k − 1)` ways.", "**Inclusion–exclusion:** to count elements with *at least one* of several properties, add singles, subtract pairs, add triples, and so on.", "**Catalan numbers:** `C(2n, n)/(n + 1)` counts balanced bracket strings of length 2n (and many similar structures): 1, 1, 2, 5, 14, 42, …"] },
    { kind: "viz", id: "viz-pascal", title: "Pascal's triangle", viz: "pascal-triangle",
      paras: ["Cell (n, r) is C(n, r). Every inner cell is the sum of the two cells above it (the two yellow cells): either the first item is chosen, or it is not. Notice the symmetry C(n, r) = C(n, n − r) and that each row adds up to 2ⁿ, the number of subsets of n items."] },
    { kind: "example", id: "example", title: "C(5, 2) three ways",
      paras: ["Choosing 2 items out of 5, by the formula, by Pascal's rule, and with inverses modulo 7."],
      table: { head: ["method", "working", "result"], rows: [["formula", "5! / (2! · 3!) = 120 / (2 · 6)", "10"], ["Pascal's rule", "C(4, 1) + C(4, 2) = 4 + 6", "10"], ["modulo 7, with inverses", "5! = 120 ≡ 1; 2! = 2 has inverse 4; 3! = 6 has inverse 6; 1 · 4 · 6 = 24 ≡ 3", "3 (and 10 mod 7 = 3)"]] },
      steps: [{ title: "Why the inverses are 4 and 6", body: "Modulo 7: 2 · 4 = 8 ≡ 1, and 6 · 6 = 36 ≡ 1. So dividing by 2 means multiplying by 4, and dividing by 6 means multiplying by 6." }, { title: "A word of caution about small primes", body: "This is only valid because 5 < 7. If n ≥ p, the factorial n! is divisible by p and has no inverse: the method breaks (see edge cases)." }] },
    { kind: "code", id: "code-inverse", title: "Modular inverses",
      paras: ["Extended Euclid returns the gcd together with the coefficients of a combination that produces it."],
      pseudocode: "ext_gcd(a, b):\n    if b == 0: return (a, 1, 0)\n    (g, x, y) = ext_gcd(b, a mod b)\n    return (g, y, x − (a // b) · y)",
      code: inverse,
      walkthrough: ["`ext_gcd(240, 46)` returns `(2, -9, 47)`: indeed `240·(−9) + 46·47 = 2`.", "`mod_inverse(3, 11)` is 4 because `3 · 4 = 12 ≡ 1`. `mod_inverse(10, 17)` is 12 (`120 = 7·17 + 1`). `mod_inverse(4, 8)` is `None`: 4 and 8 share the factor 4, so no inverse exists.", "Python's built-in `pow(a, -1, m)` does the same, and for a prime modulus Fermat's `pow(a, m − 2, m)` agrees (the third line).", "The last line verifies that every non-zero residue modulo the prime 101 has an inverse that really multiplies to 1."] },
    { kind: "code", id: "code-ncr", title: "C(n, r) mod p in O(1) per query",
      paras: ["Precompute factorials and inverse factorials once, then every query is two multiplications."],
      code: ncrCode,
      walkthrough: ["`fact[i]` is `i! mod p`. `inv[i]` is the inverse of `i!`. Only **one** call to `pow(..., MOD - 2, MOD)` is made, for the largest factorial.", "`inv[i - 1] = inv[i] * i % MOD` works because `(i − 1)! = i! / i`, so its inverse is the inverse of `i!` times `i`.", "`ncr` returns 0 when `r < 0` or `r > n` (you cannot choose more than you have), and every multiplication is reduced by `% MOD` to keep numbers small.", "The checks compare the table against exact `math.comb` for all small n (including `r = n + 1`, which must give 0) and for n = 2000, r = 1000, where the “reduce then divide” idea failed. `ncr(100000, 50000)` is 149,033,233."] },
    { kind: "code", id: "code-pascal", title: "Pascal's triangle for any modulus",
      paras: ["If the modulus is not prime (or n is small and you want no inverses), build the triangle directly with Pascal's rule: only additions."],
      code: pascal,
      walkthrough: ["`t[i][j] = (t[i-1][j-1] + t[i-1][j]) % m` is Pascal's rule. Cells beyond the row length stay 0, which is exactly what `C(i−1, i) = 0` requires.", "It works for **any** modulus `m`, such as 6: `C(10, 3) = 120 ≡ 0 (mod 6)`. No division is ever needed.", "The cost is O(n²) time and memory, so it suits n up to a few thousand, not 10⁶.", "`sum(t[6]) == 2**6` confirms the row-sum identity, and `C(30, 15) = 155,117,520` is below the modulus so it prints exactly."] },
    { kind: "code", id: "code-phi", title: "Euler's totient with a sieve",
      paras: ["φ(n) counts the numbers from 1 to n that are coprime to n. A sieve computes φ for every number up to n: for each prime p, multiply every multiple of p by (1 − 1/p), which is `phi[j] -= phi[j] // p`."],
      code: phi,
      walkthrough: ["`phi = list(range(n + 1))` starts every φ(j) at j. When `phi[i] == i` the number has not been changed by any smaller prime, so `i` is prime.", "For each prime `i`, `phi[j] -= phi[j] // i` removes the fraction `1/i` of the remaining coprime candidates for every multiple `j`.", "φ(12) = 4 (the numbers 1, 5, 7, 11), φ(29) = 28 because 29 is prime, and φ(30) = 8.", "The brute-force comparison confirms all 30 values. The last line illustrates Euler's theorem: φ(10) = 4 and `3⁴ = 81 ≡ 1 (mod 10)`."] },
    { kind: "code", id: "code-counting", title: "Counting rules, checked by brute force",
      paras: ["Stars and bars, Catalan numbers and arrangements with repeats, each checked against direct enumeration on small inputs."],
      code: counting,
      walkthrough: ["`stars_and_bars(5, 3)` is `C(7, 2) = 21`: the number of ways to split 5 identical items between 3 boxes. The brute force over all triples that add up to 5 agrees.", "The Catalan numbers 1, 1, 2, 5, 14, 42, 132, 429 count balanced bracket strings: the check enumerates every string of `(` and `)` for n up to 5 and confirms the formula.", "The last line counts arrangements of the letters in “aabbc”: `5! / (2! · 2! · 1!) = 30`.", "These three formulas, with `C(n, r)`, cover most counting problems in contests."] },
    { kind: "complexity", id: "complexity", title: "Costs",
      rows: [
        { what: "Fast modular exponentiation (one inverse by Fermat)", time: "O(log p)", space: "O(1)", why: "Square-and-multiply on the exponent p − 2." },
        { what: "Extended Euclid / `pow(a, -1, m)`", time: "O(log m)", space: "O(log m) recursion", why: "Same number of steps as ordinary Euclid." },
        { what: "Factorial and inverse-factorial tables up to N", time: "O(N + log p)", space: "O(N)", why: "Two linear passes and a single modular exponentiation." },
        { what: "One query C(n, r) mod p after the tables", time: "O(1)", space: "O(1)", why: "Two multiplications and two reductions." },
        { what: "Pascal's triangle up to n", time: "O(n²)", space: "O(n²)", why: "One addition per cell; works for any modulus." },
        { what: "Totients for 1..n with a sieve", time: "O(n log log n)", space: "O(n)", why: "Each prime updates its multiples, like the sieve of Eratosthenes." },
        { what: "Inclusion–exclusion over k distinct primes", time: "O(2^k)", space: "O(k)", why: "One term for each subset of the primes; k ≤ 11 for numbers up to 10¹²." }],
      paras: ["The theme: pay a one-time cost (tables, inverses, factorisation) so that each query is nearly free."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "r < 0 or r > n", handle: "C(n, r) = 0. Return 0 explicitly rather than indexing a table out of range." }, { case: "r = 0 or r = n", handle: "C(n, r) = 1. The table formula handles it because `fact[0] = inv[0] = 1`." }, { case: "n ≥ p (n at least the prime modulus)", handle: "n! is divisible by p, so it has no inverse and the factorial method fails. Use Lucas's theorem, or keep n below p (10⁹ + 7 is bigger than any table you can build)." }, { case: "The modulus is not prime", handle: "Fermat inverses do not apply. Use extended Euclid (only works if gcd = 1), Pascal's triangle, or factor the modulus and combine results." }, { case: "Table too small", handle: "Build tables up to the **largest n** in any query, not an arbitrary 10⁵." }, { case: "Negative values", handle: "Python's `%` gives a non-negative result; in C++ use `((x % m) + m) % m` after a subtraction." }, { case: "Overflow in other languages", handle: "Products of two residues below 10⁹ + 7 need 64-bit integers; reduce after every multiplication." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Reducing factorials mod p and then using `/` or `//`.", fix: "Multiply by the modular inverse instead." }, { mistake: "Computing one `pow(..., p - 2, p)` per query for every factorial.", fix: "Take one inverse for the largest factorial and derive the rest in one backward pass." }, { mistake: "Forgetting `% MOD` after each multiplication.", fix: "Reduce after every product; in other languages an unreduced product overflows." }, { mistake: "Using Fermat's inverse with a composite modulus.", fix: "It only works for a prime modulus. Use extended Euclid or Pascal's triangle otherwise." }, { mistake: "Treating the 0 case as having an inverse.", fix: "No inverse exists for a multiple of the modulus; check before inverting." }, { mistake: "Mixing up arrangements and combinations.", fix: "If order matters use `n!/(n−r)!`; if it does not use `C(n, r)`." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a counting problem",
      signals: ["“Count the ways … **modulo 10⁹ + 7**” (the answer is too large to print exactly).", "“Choose k of n”, “the number of subsets of size k”, “committees”, “teams”: **C(n, k)** with tables.", "“Number of **paths** on a grid moving only right and down”: `C(R + C, R)`, possibly split at a required cell.", "“Distribute n identical items among k people”: **stars and bars**.", "“Arrange letters, some of them equal”: multinomial `n!/(k₁!k₂!…)`.", "“Count numbers up to n that are (not) divisible by any of these primes”: **inclusion–exclusion**, or totients for coprimality.", "“Balanced brackets”, “binary trees with n nodes”, “non-crossing pairings”: **Catalan numbers**."],
      notThis: ["Counts with complicated constraints that change step by step: dynamic programming (counting DP) is usually the tool.", "The answer is needed **exactly** and is small: Python's `math.comb` is enough.", "n is larger than the modulus: Lucas's theorem is needed."] },
    { kind: "worked", id: "worked-paths", title: "Paths through a required cell",
      problem: "A robot starts at the top-left cell (1, 1) of an R × C grid and may move only right or down. How many different routes reach the bottom-right cell (R, C) while passing through the cell (a, b)? Print the count modulo 10⁹ + 7.",
      approach: ["A route from (1, 1) to (a, b) has `a − 1` down moves and `b − 1` right moves in some order: `C(a + b − 2, a − 1)` ways.", "From (a, b) to (R, C) it is `C((R − a) + (C − b), R − a)`.", "Passing through (a, b) means one route of each kind, so **multiply** the two counts (the product rule).", "Check the formula with an independent table-based count on small grids."],
      code: paths,
      takeaway: "Paths on a grid are arrangements of identical moves, hence binomial coefficients. “Pass through a point” becomes a product of two independent counts. The final line compares the formula with a plain DP over every small grid and every required cell: True." },
    { kind: "worked", id: "worked-coprime", title: "Numbers coprime to m, by inclusion–exclusion",
      problem: "Count the integers k with 1 ≤ k ≤ n that are coprime to m, where n and m can be as large as 10¹².",
      approach: ["Looping over all k is impossible for n = 10¹². Instead count the *bad* numbers, those sharing a prime factor with m.", "Factorise m into its distinct primes (at most 11 of them for m ≤ 10¹²).", "A number is bad if it is divisible by at least one of those primes. Inclusion–exclusion: add the multiples of each prime, subtract the multiples of each pair (the product), add triples, and so on. Each term is `n // product`.", "The answer is `n` minus the bad count; the signed sum over all subsets of primes (including the empty subset, which contributes `+n`) gives it directly."],
      code: coprime,
      takeaway: "At most 2¹¹ = 2,048 terms replace 10¹² iterations. For n = 100 and m = 12 the formula is 100 − 50 − 33 + 16 = 33, and the brute-force comparison at the end confirms it on every small case. When n happens to be a multiple of m the answer simplifies to n · φ(m) / m, which is how totients are connected to this count." },
  ],
  cheatSheet: [{ label: "Inverse", value: "a⁻¹ mod p = pow(a, p − 2, p) · any m: pow(a, −1, m) if gcd = 1" }, { label: "C(n, r) mod p", value: "fact[n] · inv[r] · inv[n − r] with one pow() for the tables" }, { label: "Pascal's rule", value: "C(n, r) = C(n−1, r−1) + C(n−1, r): any modulus, O(n²)" }, { label: "Stars and bars", value: "n items, k boxes: C(n + k − 1, k − 1)" }, { label: "Catalan", value: "C(2n, n) / (n + 1)" }, { label: "Inclusion–exclusion", value: "sum over subsets of primes of (−1)^|S| · n // product(S)" }],
  summary: ["Remainders respect +, − and ×, but not division: divide by multiplying with a modular inverse.", "Fermat gives `a⁻¹ = a^(p−2)` for a prime modulus; extended Euclid or `pow(a, -1, m)` works whenever gcd(a, m) = 1.", "Precompute factorials and inverse factorials with a single modular exponentiation to answer C(n, r) mod p in O(1).", "Pascal's rule needs no division and works for any modulus; totients and inclusion–exclusion count by divisibility.", "Map counting problems onto formulas: paths and subsets (binomials), distributions (stars and bars), brackets (Catalan)."],
  checks: [
    { kind: "concept", q: "Why can you not compute C(n, r) mod p by reducing each factorial mod p and then dividing normally?", options: ["Factorials are too large for Python", "Remainders respect +, − and × but not division, so you must multiply by a modular inverse", "p is always even", "The answer would always be 0"], answer: 1, why: "A remainder of a quotient is not the quotient of remainders. Dividing mod a prime means multiplying by the inverse." },
    { kind: "trace", q: "What is the modular inverse of 3 modulo 11?", options: ["3", "4", "7", "8"], answer: 1, why: "3 · 4 = 12 ≡ 1 (mod 11), so the inverse is 4." },
    { kind: "trace", q: "How many ways are there to split 5 identical sweets among 3 children (a child may get none)?", options: ["10", "15", "21", "243"], answer: 2, why: "Stars and bars: C(5 + 3 − 1, 3 − 1) = C(7, 2) = 21." },
    { kind: "complexity", q: "After precomputing factorial tables, what does one C(n, r) mod p query cost?", options: ["O(1)", "O(log p)", "O(n)", "O(r)"], answer: 0, why: "It is two multiplications and reductions using stored values." },
    { kind: "recognize", q: "“Count the monotone grid paths from the top-left to the bottom-right modulo 10⁹ + 7” suggests:", options: ["Dijkstra", "A binomial coefficient C(R + C − 2, R − 1)-style count with factorial tables", "Sorting", "Union-Find"], answer: 1, why: "Each path is an arrangement of identical right and down moves, counted by a binomial coefficient." },
    { kind: "concept", q: "When does the factorial-based method for C(n, r) mod p fail?", options: ["When r is 0", "When n is at least the prime p, because n! is divisible by p and has no inverse", "When n is even", "When r is greater than 100"], answer: 1, why: "A factorial containing the factor p is 0 modulo p, which has no inverse, so Lucas's theorem is needed in that case." },
    { kind: "trace", q: "What does print(pow(3, 200, 13)) print?", options: ["9", "3", "1", "12"], answer: 0, why: "3^3 = 27 is 1 mod 13, so 3^200 = 3^(200 mod 3) = 3^2 = 9 mod 13." },
    { kind: "trace", q: "What is the modular inverse of 3 modulo 7, as printed by print(pow(3, -1, 7))?", options: ["5", "4", "2", "6"], answer: 0, why: "3 * 5 = 15 = 1 mod 7." },
    { kind: "trace", q: "How many positive divisors does 36 have?", options: ["9", "6", "12", "8"], answer: 0, why: "36 = 2^2 * 3^2 has (2+1)(2+1) = 9 divisors." },
    { kind: "trace", q: "What does math.comb(10, 3) return? (Import math first.)", options: ["120", "720", "30", "1000"], answer: 0, why: "Choosing 3 of 10 is 10*9*8 / (3*2*1) = 120." },
    { kind: "concept", q: "What does Fermat's little theorem say for a prime p and a not divisible by p?", options: ["a^(p-1) is 1 mod p", "a^(p-1) is 0 mod p", "a^p is always a", "p - 1 is always prime"], answer: 0, why: "It is the basis for modular inverses and primality tests." },
    { kind: "complexity", q: "What is the running time of fast modular exponentiation with exponent e?", options: ["O(log e)", "O(e)", "O(e\u00b2)", "O(1)"], answer: 0, why: "Each squaring halves the exponent." },
    { kind: "trace", q: "What is the sum of the divisors of 12 (sigma of 12)?", options: ["28", "16", "12", "24"], answer: 0, why: "1 + 2 + 3 + 4 + 6 + 12 = 28." },
    { kind: "concept", q: "Why are binomial coefficients modulo a prime computed with inverse factorials?", options: ["Division modulo p is multiplication by the modular inverse", "Factorials are always zero", "Binomials need floating point", "Addition is faster"], answer: 0, why: "Dividing by n! mod p means multiplying by its inverse." },
    { kind: "trace", q: "What is gcd(1071, 462)?", options: ["21", "42", "7", "3"], answer: 0, why: "The Euclidean algorithm reaches 21." },
  ],
  nextNote: "Next, **Advanced DP** (bitmask, digit and tree DP) is planned; counting formulas like these often replace or speed up a DP.",
};
