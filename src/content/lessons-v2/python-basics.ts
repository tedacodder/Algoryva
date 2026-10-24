import type { LessonV2 } from "../lesson-types";

const naive = String.raw`print(1 * 1, 2 * 2, 3 * 3, 4 * 4, 5 * 5)   # 1 4 9 16 25`;
const ops = String.raw`a, b = 7, 2
print(a + b, a - b, a * b)   # 9 5 14
print(a / b)   # 3.5
print(a // b, a % b)   # 3 1
print(a ** b)   # 49
print(-7 // 2, -7 % 2)   # -4 1
print(type(a).__name__, type(a / b).__name__, type("hi").__name__, type(True).__name__)   # int float str bool
print(0.1 + 0.2 == 0.3)   # False
print(abs(0.1 + 0.2 - 0.3) < 1e-9)   # True
print(2 ** 100)   # 1267650600228229401496703205376`;
const flow = String.raw`def classify(x):
    if x < 0:
        return "negative"
    elif x == 0:
        return "zero"
    else:
        return "positive"

print(classify(-5), classify(0), classify(3))   # negative zero positive

total = 0
for i in range(1, 6):
    total += i
print(total)   # 15

n, digits = 12345, 0
while n > 0:
    n //= 10
    digits += 1
print(digits)   # 5

for x in range(50, 100):
    if x % 7 == 0:
        print(x)   # 56
        break`;
const funcs = String.raw`def area(w, h=1):
    return w * h

print(area(3, 4), area(5))   # 12 5

s = "competitive"
print(len(s), s[0], s[-1], s[2:5])   # 11 c e mpe
print(s.upper(), s.count("t"))   # COMPETITIVE 2
print(s.find("pet"), s.find("xyz"))   # 3 -1
name, score = "Ana", 91.5
print(f"{name} scored {score:.1f}")   # Ana scored 91.5
print("a,b,c".split(","))   # ['a', 'b', 'c']
print("-".join(["x", "y", "z"]))   # x-y-z

line = "3 5 8"      # in a contest: line = input()
nums = list(map(int, line.split()))
print(nums, sum(nums))   # [3, 5, 8] 16`;
const pal = String.raw`def is_palindrome_number(x):
    if x < 0:
        return False
    original, rev = x, 0
    while x > 0:
        rev = rev * 10 + x % 10
        x //= 10
    return original == rev

print(is_palindrome_number(121))   # True
print(is_palindrome_number(-121))   # False
print(is_palindrome_number(10))   # False`;
const summ = String.raw`def summarize(line):
    nums = list(map(int, line.split()))
    evens = 0
    for x in nums:
        if x % 2 == 0:
            evens += 1
    return len(nums), sum(nums), max(nums), evens

print(summarize("3 8 5 12"))   # (4, 28, 12, 2)
print(summarize("7"))   # (1, 7, 7, 0)`;

export const pythonBasics: LessonV2 = {
  topic: "python-basics", depth: "complete", minutes: 40,
  hook: "The handful of Python ideas (values, decisions, repetition, functions, text) that every other lesson in this course builds on.",
  objectives: [
    "Store and combine values with variables, numbers, text and booleans, and predict what each operator returns.",
    "Choose between branches with `if`/`elif`/`else`, and repeat work with `for` and `while`.",
    "Write a function with parameters and a return value, and call it.",
    "Slice and transform text, and turn a line of input into numbers.",
    "Avoid the classic early traps: integer versus true division, floating-point error, off-by-one in `range`, and `=` versus `==`.",
  ],
  prereqNote: "None. If you have never written code, run each example yourself and change a number to see what happens.",
  sections: [
    { kind: "intuition", id: "recipe", title: "A program is a recipe",
      paras: ["A recipe is a list of steps a cook follows exactly, with no common sense: “if the sauce is thick, add water; repeat until smooth”. A program is the same: a list of steps, followed literally by a computer that is very fast and has no judgement at all.",
        "Three ideas cover almost everything: **remember** things (variables), **decide** between steps (conditions), and **repeat** steps (loops). Functions let you give a group of steps a name so you can reuse it."] },
    { kind: "naive", id: "naive", title: "Doing each calculation by hand",
      paras: ["Suppose you need the squares of 1 to 5. One way is to write each calculation out.",
        "It works, but nothing about it scales: for the squares up to 500 you would write 500 expressions, and a typo in one of them hides among the rest. Loops exist so the *rule* is written once and the computer repeats it."],
      code: naive,
      cost: "Work and chance of mistakes grow with every extra item, instead of staying constant." },
    { kind: "concept", id: "values", title: "Values, variables and operators",
      paras: ["A **variable** is a name attached to a value: `x = 5` makes the name `x` refer to 5. Every value has a **type**, which decides what you can do with it."],
      bullets: ["**int:** whole numbers, of any size (Python never overflows). **float:** numbers with a decimal point, stored approximately.", "**str:** text in quotes. **bool:** `True` or `False`.", "**Arithmetic:** `+ - *`, true division `/` (always a float), floor division `//` (rounds down), remainder `%`, power `**`.", "**Comparison:** `== != < <= > >=` give a bool. **Logic:** `and`, `or`, `not`.", "`=` **assigns** a value; `==` **asks** whether two values are equal. Mixing them up is the most common beginner bug.", "**Truthiness:** `0`, `0.0`, `\"\"` (empty text), `[]` and `None` count as false in an `if`; almost everything else counts as true."] },
    { kind: "code", id: "code-ops", title: "Arithmetic and types, with the surprises",
      paras: ["Predict each output before reading the comment. Three of them surprise almost everyone: floor division with negatives, the remainder with negatives, and `0.1 + 0.2`."],
      code: ops,
      walkthrough: ["`7 / 2` is `3.5` (a float) while `7 // 2` is `3`. `%` gives what is left over: `7 % 2` is `1`. Together `a == (a // b) * b + a % b` always holds.", "`-7 // 2` is `-4`, not `-3`: floor division rounds toward **negative infinity**. And `-7 % 2` is `1`, because the remainder follows the same rule. In Python `x % n` is always between 0 and n − 1 when n is positive, which is what you want for wrapping around.", "`0.1 + 0.2 == 0.3` is `False`: floats store binary approximations. Compare floats with a tolerance (`abs(x - y) < 1e-9`), or avoid them by working with integers.", "`2 ** 100` is exact. Unlike many languages, Python integers grow as large as needed, so overflow is not a worry here (it is in C++ and Java)."] },
    { kind: "viz", id: "viz-loop", title: "A loop with a decision inside", viz: "loop-if-trace",
      paras: ["`for x in numbers:` takes the values one at a time. Inside, an `if` decides which branch to run. Step through and watch the variable `x`, the test `x % 2 == 0`, and the label that gets recorded. This pattern (loop, test, act) appears in almost every program."] },
    { kind: "example", id: "example", title: "Tracing a loop by hand",
      paras: ["The best way to understand a loop is to write a table of the variables after each pass. Take `total = 0` followed by `for i in range(1, 6): total += i`."],
      table: { head: ["pass", "i", "total before", "total after (total += i)"], rows: [["1", "1", "0", "1"], ["2", "2", "1", "3"], ["3", "3", "3", "6"], ["4", "4", "6", "10"], ["5", "5", "10", "15"]] },
      steps: [{ title: "Why i stops at 5", body: "`range(1, 6)` starts at 1 and stops **before** 6, so it produces 1, 2, 3, 4, 5. The stop value is never included. This single fact causes most off-by-one errors." }, { title: "The shape to remember", body: "Start an accumulator (`total = 0`), update it inside the loop, use it after the loop. Counting, summing, finding a maximum: all of them follow this shape." }] },
    { kind: "code", id: "code-flow", title: "Decisions and repetition",
      paras: ["`if`/`elif`/`else` runs exactly one branch. `for` repeats over a collection or a `range`; `while` repeats as long as a condition holds. `break` leaves a loop early, and `continue` skips to the next pass."],
      pseudocode: "if condition A: do this\nelif condition B: do that\nelse: do the other\n\nfor each item in a collection: do something with the item\nwhile a condition holds: do something, and change something so it eventually stops",
      code: flow,
      walkthrough: ["Indentation **is** the syntax: the indented lines belong to the `if` or loop above them. Use four spaces consistently.", "`total += i` is shorthand for `total = total + i`. Likewise `n //= 10` means `n = n // 10`: it drops the last digit, so the `while` loop above counts digits by dropping them one by one.", "A `while` loop must change something that its condition looks at; otherwise it never stops. Here `n` shrinks every pass until it reaches 0.", "`break` stops the `for` loop at the first multiple of 7 (56). Without it the loop would keep going and print 63, 70, and so on."] },
    { kind: "code", id: "code-funcs", title: "Functions, text, and reading input",
      paras: ["A **function** names a group of steps. It takes **parameters**, may have default values, and sends a result back with `return`. Text works like a list of characters: you can index it, slice it, and call methods on it."],
      code: funcs,
      walkthrough: ["`def area(w, h=1)` gives `h` a default, so `area(5)` means `area(5, 1)`. A function with no `return` gives back `None`.", "Indices start at 0 and `s[-1]` is the last character. `s[2:5]` means “from index 2 up to but not including 5”: three characters.", "`find` returns the position of the first match, or `-1` if there is none. Never treat `-1` as a real position.", "An f-string (`f\"...{value}...\"`) drops values into text, and `:.1f` formats a float with one decimal place.", "Contest input arrives as **text**. `line.split()` cuts it on spaces, and `map(int, ...)` converts each piece to a number. In a real program, `line = input()` supplies the text."] },
    { kind: "complexity", id: "complexity", title: "What the basic operations cost",
      paras: ["You do not need formal analysis yet, but build the habit of noticing how many times something runs. The Complexity lesson goes deeper."],
      rows: [
        { what: "Arithmetic, comparison, variable assignment", time: "O(1)", space: "O(1)", why: "A fixed amount of work regardless of the numbers' size (for ordinary-sized ints)." },
        { what: "A single `for` or `while` loop over n items", time: "O(n)", space: "O(1)", why: "The body runs once per item." },
        { what: "A loop inside a loop", time: "O(n²)", space: "O(1)", why: "The inner body runs n times for each of the n outer passes." },
        { what: "`len(s)`, `s[i]`", time: "O(1)", space: "O(1)", why: "Text stores its length and can jump to any position." },
        { what: "`s.find(x)`, `x in s`, `s.count(x)`", time: "O(n)", space: "O(1)", why: "They may scan the whole text." },
        { what: "Building a text with `s += ...` in a loop", time: "up to O(n²)", space: "O(n)", why: "Strings cannot change, so each `+=` can copy everything so far. Collect pieces in a list and `\"\".join(...)` once." }] },
    { kind: "edge", id: "edges", title: "Edge cases and surprises",
      items: [{ case: "Dividing by zero", handle: "`x / 0` and `x // 0` raise ZeroDivisionError. Check the divisor first if it can be 0." }, { case: "Negative numbers with // and %", handle: "`//` rounds down and `%` stays non-negative for a positive divisor. Do not assume C-style truncation." }, { case: "Float equality", handle: "Never test floats with `==`. Use a tolerance, or use integers (for example work in cents)." }, { case: "Empty text or empty input", handle: "`\"\".split()` gives an empty list, so `max(...)` of it would fail. Handle the empty case explicitly." }, { case: "Off-by-one in range", handle: "`range(n)` gives 0 to n − 1; `range(1, n + 1)` gives 1 to n. Check the first and last values on paper." }, { case: "Strings are immutable", handle: "`s[0] = \"x\"` is an error. Build a new string instead." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Writing `if x = 5:` (assignment) instead of `if x == 5:` (comparison).", fix: "Python rejects the first form, but in other languages it silently compiles. Read `==` as “is equal to”." }, { mistake: "Expecting `/` to give a whole number.", fix: "`/` always returns a float. Use `//` when you want a whole number." }, { mistake: "Forgetting to convert input text to numbers.", fix: "`\"3\" + \"5\"` is `\"35\"`, not 8. Convert with `int(...)` first." }, { mistake: "An infinite `while` loop.", fix: "Make sure something in the body moves the condition toward False. Add a temporary print to watch it." }, { mistake: "Inconsistent indentation.", fix: "Use four spaces everywhere; never mix tabs and spaces." }, { mistake: "Using a variable before giving it a value.", fix: "Initialise accumulators (`total = 0`) before the loop." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a “just implement it” problem",
      paras: ["Many contest problems, especially the first ones in a set, need no clever algorithm. They test whether you can turn a description into correct code."],
      signals: ["The statement describes **exactly what to do**, step by step: read numbers, apply a rule, print a result.", "The input is **small** (a few hundred values at most), so even a clumsy loop passes.", "The tools needed are arithmetic, `if`, a loop, and basic text handling: `//`, `%`, slicing, `split`.", "The difficulty is in **details**: formats, edge cases, off-by-one, careful reading.", "Typical names: “implementation”, “simulation”, “math”, “strings”, “brute force”."],
      notThis: ["The input is huge (10⁵ or more) and the obvious loops are nested: a smarter technique is needed (see Prefix Sum, Two Pointers, Binary Search).", "The statement asks for the best of exponentially many choices: that signals greedy, search, or DP."] },
    { kind: "worked", id: "worked-pal", title: "Is a number a palindrome?",
      problem: "Return True if an integer reads the same forwards and backwards (121 is, -121 is not because of the minus sign, 10 is not). Do it without converting to text.",
      approach: ["Negative numbers can never be palindromes: return False at once.", "Build the reversed number digit by digit. `x % 10` is the last digit; `x // 10` removes it.", "Each pass: shift the reversed number left (`rev * 10`), add the digit, and drop the digit from `x`.", "At the end compare the reversed value with the original."],
      code: pal,
      takeaway: "`%` 10 peels off the last digit and `//` 10 removes it. That pair is the standard way to process the digits of a number, and it shows `//` and `%` doing real work. (Converting with `str(x) == str(x)[::-1]` is shorter, and just as valid in a contest.)" },
    { kind: "worked", id: "worked-input", title: "Summarise a line of input",
      problem: "A line contains whitespace-separated integers. Return how many there are, their sum, their maximum and how many are even.",
      approach: ["Split the line into pieces and convert each piece to an int.", "Use an accumulator `evens` that starts at 0 and increases for every even value.", "`len`, `sum` and `max` are built in. Return everything together."],
      code: summ,
      takeaway: "Most input-processing problems follow this pipeline: split, convert, loop with an accumulator, return. The second call shows the single-element edge case: `max` works, and evens is 0 because 7 is odd." },
  ],
  cheatSheet: [{ label: "Division", value: "/ true · // floor · % remainder · ** power" }, { label: "Negatives", value: "-7 // 2 = -4 and -7 % 2 = 1" }, { label: "range", value: "range(a, b) includes a, excludes b" }, { label: "Falsy", value: "0, 0.0, \"\", [], None" }, { label: "Floats", value: "compare with abs(x − y) < 1e-9" }, { label: "Input line", value: "list(map(int, line.split()))" }],
  summary: ["A program remembers values (variables), chooses (if/elif/else) and repeats (for, while).", "Know your operators: `/` is a float, `//` rounds down, `%` is the remainder, and `=` is not `==`.", "`range(a, b)` stops before b; most off-by-one errors start there.", "Floats are approximate; Python integers are exact and unlimited.", "Functions name a group of steps; split and map(int, ...) turn text input into numbers."],
  checks: [
    { kind: "trace", q: "What does `-7 // 2` evaluate to in Python?", options: ["-3", "-4", "3", "-3.5"], answer: 1, why: "Floor division rounds toward negative infinity: -3.5 becomes -4." },
    { kind: "trace", q: "How many times does the body of `for i in range(2, 7):` run?", options: ["4", "5", "6", "7"], answer: 1, why: "It runs for 2, 3, 4, 5 and 6: the stop value 7 is excluded, so 5 passes." },
    { kind: "concept", q: "Why is `0.1 + 0.2 == 0.3` False in Python?", options: ["Python has a bug", "Floats are stored as binary approximations, so the sum is slightly off", "Addition is not exact for integers", "`==` only compares text"], answer: 1, why: "0.1 and 0.2 cannot be represented exactly in binary, so their sum is 0.30000000000000004. Compare with a tolerance." },
    { kind: "concept", q: "Which of these counts as False inside an `if`?", options: ["The text \"False\"", "The number 0", "The list [0]", "The text \"0\""], answer: 1, why: "0 is falsy. The text \"False\" and \"0\" and the list [0] are non-empty, so they are truthy." },
    { kind: "trace", q: "For `s = \"competitive\"`, what is `s[2:5]`?", options: ["\"omp\"", "\"mpe\"", "\"mpet\"", "\"pet\""], answer: 1, why: "Indices 2, 3 and 4 are m, p, e; index 5 is excluded." },
    { kind: "recognize", q: "Which statement describes a typical “implementation” problem?", options: ["The input has 10⁶ values and a nested-loop idea is too slow", "The statement says exactly what to compute and the input is small, so careful coding is the challenge", "You must choose the best of 2⁵⁰ combinations", "The answer needs a segment tree"], answer: 1, why: "Implementation problems test careful translation of a description into code, not a clever algorithm." },
    { kind: "trace", q: "What does `7 % -3` evaluate to in Python?", options: ["-2", "-1", "1", "2"], answer: 0, why: "The result takes the sign of the divisor: 7 = (-3) \u00d7 (-3) + (-2)." },
    { kind: "trace", q: "What does `print(2 ** 10, 2 ** -1)` print?", options: ["1024 0.5", "1024 0", "1000 0.5", "20 0.5"], answer: 0, why: "`**` is exponentiation; a negative exponent gives a float, so 2 ** -1 is 0.5." },
    { kind: "trace", q: "After `x = 5` and then `x += 2 * 3`, what is x?", options: ["11", "21", "8", "15"], answer: 0, why: "The multiplication happens first: 2 * 3 is 6, and 5 + 6 is 11." },
    { kind: "concept", q: "What type is the result of `int('12') + float('0.5')`?", options: ["int", "float", "str", "It raises an error"], answer: 1, why: "Adding an int and a float gives a float, so the result is 12.5." },
  ],
  nextNote: "Next, **Lists & Tuples** and **Sets & Dictionaries** introduce the containers you will use in every problem.",
};
