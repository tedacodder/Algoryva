import type { LessonV2 } from "../lesson-types";

const fastinput = String.raw`import io
import sys

sys.stdin = io.StringIO("3\n5 8 2\nhello world\n")   # simulates what a contest feeds your program
input = sys.stdin.readline

n = int(input())
nums = list(map(int, input().split()))
text = input().strip()
print(n, nums)   # 3 [5, 8, 2]
print(text.split())   # ['hello', 'world']

sys.stdin = io.StringIO("2 7 1 8\n")
data = sys.stdin.read().split()
print(list(map(int, data)))   # [2, 7, 1, 8]`;
const asserts = String.raw`def is_palindrome(s):
    cleaned = [c.lower() for c in s if c.isalnum()]
    return cleaned == cleaned[::-1]

assert is_palindrome("")                      # empty
assert is_palindrome("a")                     # single character
assert is_palindrome("A man, a plan, a canal: Panama")
assert not is_palindrome("race a car")
assert is_palindrome("12321")
print("all tests passed")   # all tests passed`;
const buggy = String.raw`def count_below_buggy(a, t):
    c = 0
    for i in range(len(a) - 1):          # BUG: the last index is never visited
        if a[i] < t:
            c += 1
    return c

def count_below(a, t):
    c = 0
    for x in a:
        if x < t:
            c += 1
    return c

print(count_below_buggy([5, 1, 9], 6))   # 2
print(count_below([5, 1, 9], 6))   # 2
print(count_below_buggy([1, 2, 3], 10))   # 2
print(count_below([1, 2, 3], 10))   # 3`;
const stress = String.raw`import random

def max_subarray_fast(a):
    best = cur = a[0]
    for x in a[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    return best

def max_subarray_brute(a):
    return max(sum(a[i:j]) for i in range(len(a)) for j in range(i + 1, len(a) + 1))

random.seed(7)
for _ in range(500):
    a = [random.randint(-9, 9) for _ in range(random.randint(1, 8))]
    assert max_subarray_fast(a) == max_subarray_brute(a), a
print("500 random tests agree")   # 500 random tests agree
print(max_subarray_fast([-2, 1, -3, 4, -1, 2, 1, -5, 4]))   # 6`;

export const codingPractices: LessonV2 = {
  topic: "coding-practices", depth: "complete", minutes: 35,
  hook: "The small habits (clear names, reading input correctly, testing edge cases, comparing against a slow answer) that separate a solution that works from one that almost does.",
  objectives: [
    "Write readable code: meaningful names, small functions, comments that explain why.",
    "Read contest input quickly and correctly, and print output in the exact format asked.",
    "Test a solution with a checklist of edge cases before submitting.",
    "Find a bug by reproducing it on the smallest failing input and tracing the variables.",
    "Compare a clever solution against a slow, obviously correct one on random inputs (stress testing).",
  ],
  prereqNote: "Python Basics: functions, loops, lists and `range`.",
  sections: [
    { kind: "intuition", id: "pilot", title: "A pilot's checklist",
      paras: ["Pilots are highly skilled and still run through a checklist before every flight, because the cost of forgetting one small thing is huge and the checklist is cheap. Good programmers do the same: not because they cannot code, but because the bugs that sink contest solutions are rarely hard ideas. They are an off-by-one, an empty input, a missing newline.",
        "These practices are your checklist. Each one takes seconds and removes a whole category of lost points."] },
    { kind: "concept", id: "habits", title: "Habits that save the most time",
      paras: ["None of these is advanced. All of them are skipped by people who then spend an hour debugging."],
      bullets: ["**Name things for what they mean.** `left`, `right`, `best_length` beat `l`, `r`, `x`. Short names are fine for loop counters (`i`, `j`), nowhere else.", "**Small functions.** One function, one job (`read_input`, `solve`, `print_answer`). You can test each piece separately.", "**Read the statement twice.** Underline the constraints (n up to?), the output format, and whether indices start at 0 or 1.", "**Write the checklist of edge cases before coding:** empty, one element, all equal, already sorted, reversed, negatives, maximum size, duplicates.", "**Test on paper with a tiny example,** then in code with `assert`.", "**Keep a slow, simple solution** (brute force) to compare against when the fast one is in doubt.", "**Comments explain *why*,** not *what*. `# i + 1: the prefix array has a leading zero` helps; `# add 1 to i` does not."] },
    { kind: "viz", id: "viz-range", title: "Off-by-one: the most common bug", viz: "range-bounds",
      paras: ["Almost every “works on the samples, fails on the tests” bug is a boundary: the first or last item missed or over-reached. Step through the `range` forms and watch which indices each one visits. The stop value is never included, and a list of 5 items has indices 0 to 4."] },
    { kind: "example", id: "example", title: "The edge-case checklist, applied",
      paras: ["For a function that takes a list of numbers, run through these inputs before you submit. For each, decide what the *right* answer is, then check your code gives it."],
      table: { head: ["input", "why it matters", "typical failure"], rows: [["[] (empty)", "loops do not run; `a[0]` and `max(a)` crash", "IndexError, ValueError"], ["[x] (one item)", "neighbour loops like `a[i + 1]` run out of range", "IndexError, wrong answer for n = 1"], ["all values equal", "strict versus non-strict comparisons", "counts of 0 or n instead of the right one"], ["already sorted / reverse sorted", "best and worst cases for many algorithms", "slow, or fails to move anything"], ["negative numbers and zero", "assumptions like “max starts at 0”", "wrong maximum when all values are negative"], ["maximum size from the constraints", "speed and overflow in other languages", "time limit exceeded"], ["duplicates", "sets, `remove`, strict comparisons", "items lost or counted twice"]] },
      steps: [{ title: "Decide the expected answer first", body: "If you run your code and *then* decide whether the output looks right, you will talk yourself into it. Write the expected result before running." }, { title: "Test the boundaries of every loop", body: "For each `range`, ask: what are the first and last values of the loop variable, and are they the first and last items I intend?" }] },
    { kind: "code", id: "code-input", title: "Reading input and writing output",
      paras: ["Contest input is plain text. Reading it correctly, and quickly enough, is the first step of every solution. The snippet below *simulates* the input with `io.StringIO`; in a real contest it comes from the keyboard or a file."],
      code: fastinput,
      walkthrough: ["`input = sys.stdin.readline` replaces the built-in `input` with a faster line reader. For a million lines this can be several times faster than the default. It keeps the trailing newline, which `int(...)` and `.split()` ignore but `.strip()` removes if you need the clean text.", "A typical first line holds a count `n`, and the next line holds `n` numbers: `list(map(int, input().split()))`.", "`sys.stdin.read().split()` reads **everything** at once into one list of words. Convert as you consume them: handy when the layout is just “a lot of numbers”.", "Match the **output format exactly**: spaces, one answer per line, upper or lower case (`YES` is not `Yes`). For many lines, collect them in a list and print once with `\"\\n\".join(...)`, which is much faster than many `print` calls."] },
    { kind: "code", id: "code-tests", title: "Tests you can run in one second",
      paras: ["An `assert` stops the program with an error if its condition is false, so a block of asserts is a test suite. Put them right after the function while you are developing."],
      code: asserts,
      walkthrough: ["The comments next to each assert say *why that case exists*: empty, single character, punctuation, a negative case, digits.", "If any assert fails, Python reports the line, so the failing case is obvious. If all pass, the final line prints.", "Write the edge cases **first**. They are where the surprising answers live (is the empty string a palindrome? Here we chose yes, and wrote it down)."] },
    { kind: "code", id: "code-debug", title: "Finding a bug on the smallest failing input",
      paras: ["When a solution is wrong, resist re-reading the whole program. Instead shrink the failing input until it is tiny, then trace it by hand. The buggy function below agrees with the correct one on the first input and disagrees on the second."],
      code: buggy,
      walkthrough: ["`range(len(a) - 1)` stops one short: the last index `len(a) - 1` is never visited. On the first test both versions return 2: the bug is hidden because the skipped last element (9) was not below 6 anyway, so skipping it changes nothing.", "The second test, where **every** element qualifies, exposes it: the buggy version misses the last one and returns 2 instead of 3.", "This is why “all equal” and “all satisfy” inputs belong on your checklist: they are the ones that make boundary mistakes visible.", "The fix also removes the index entirely (`for x in a`). Fewer indices means fewer chances for off-by-one."] },
    { kind: "code", id: "code-stress", title: "Stress testing: trust, but verify against brute force",
      paras: ["For a fast, clever solution, write also a slow version that is so simple it is obviously right. Then run both on hundreds of small random inputs and compare. Any disagreement is a bug, and the printed input is a ready-made small failing case."],
      code: stress,
      walkthrough: ["`max_subarray_brute` tries every start and end: slow (O(n³) as written) but impossible to get wrong. `max_subarray_fast` is the one-pass method.", "`random.seed(7)` makes the run repeatable, so a failure can be reproduced.", "`assert fast == brute, a` stops on the first mismatch and prints the offending list `a`.", "Small sizes (1 to 8 items, values -9 to 9) are deliberate: bugs show up on tiny inputs, and tiny inputs are easy to trace by hand.", "The last line checks one known answer: for that classic array, the best contiguous sum is 6."] },
    { kind: "complexity", id: "complexity", title: "Practical costs of these habits",
      rows: [
        { what: "`input()` vs `sys.stdin.readline` for 10⁶ lines", time: "several times faster with `readline`", space: "O(1) per line", why: "The built-in `input` does extra work per call; `readline` is a thinner wrapper." },
        { what: "`sys.stdin.read().split()`", time: "O(total characters)", space: "O(total)", why: "One big read, then one split. Fast, but holds all input in memory." },
        { what: "Many `print` calls vs one joined print", time: "joined is much faster", space: "O(total output)", why: "Each `print` call has overhead and flushes; one big string is written once." },
        { what: "Assert-based tests", time: "negligible", space: "O(1)", why: "A few extra calls. Remove or ignore them before a contest submission if they are slow." },
        { what: "Stress test (brute force on small inputs)", time: "depends on brute force", space: "small", why: "You choose small sizes, so even O(n³) brute force finishes instantly." }],
      paras: ["Correctness comes first: these habits cost seconds, and a wrong answer scores zero however fast it was."] },
    { kind: "edge", id: "edges", title: "Edge cases about the process itself",
      items: [{ case: "Indices start at 1 in the statement", handle: "Convert once when you read (`i -= 1`) and convert back when you print. Never mix conventions inside formulas." }, { case: "The last line has no trailing newline, or extra blank lines", handle: "`.split()` with no argument ignores extra whitespace. `.strip()` cleans a single line." }, { case: "Output format subtleties", handle: "Spaces between numbers versus newlines, `True` versus `true`, a trailing space. Compare your output with the sample character by character." }, { case: "Debug prints left in the code", handle: "Extra output makes a correct answer wrong. Remove or send them to `sys.stderr`." }, { case: "Recursion depth", handle: "Deep recursion can crash in Python at around 1000 calls. Use an explicit stack, or raise the limit with `sys.setrecursionlimit`, for deep inputs." }, { case: "Modifying the input list", handle: "A function that sorts its argument in place changes the caller's data. Copy first if the original is needed later." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Submitting after passing only the sample.", fix: "Samples are minimal. Run the edge-case checklist, and stress test if you have a brute force." }, { mistake: "Debugging by changing code at random.", fix: "Reproduce on the smallest failing input, then trace each variable on paper. Change one thing at a time." }, { mistake: "One-letter names for everything.", fix: "Name by meaning. You will thank yourself in the last ten minutes of a contest." }, { mistake: "Reading input with a slow method for large inputs.", fix: "Use `sys.stdin.readline` or `sys.stdin.read().split()` when n is large." }, { mistake: "Trusting an optimisation without a reference answer.", fix: "Keep the slow version and compare on random small cases." }, { mistake: "Printing in the wrong format (extra spaces, wrong case).", fix: "Copy the sample's format exactly, and compare character for character." }] },
    { kind: "recognize", id: "recognize", title: "How to know it is time to use these habits",
      signals: ["The solution **passes the samples but gets Wrong Answer**: run the edge-case checklist and find the smallest failing input.", "You wrote an **optimised or clever** solution: write a brute force and stress test it.", "The statement has **large input** (10⁵ lines or more): switch to fast input, and join your output.", "A loop's **bounds feel uncertain**: print the first and last loop variable on a tiny case.", "You catch yourself **staring at the code** for more than a few minutes: shrink the input and trace by hand instead."],
      notThis: ["Habits do not replace thinking about the problem. A wrong idea will pass every test you write from the same wrong assumption: also re-read the statement for what it actually asks.", "Stress testing does not find *time-limit* problems: also estimate the cost at the maximum n (see Complexity)."] },
    { kind: "worked", id: "worked-offbyone", title: "Spot the off-by-one",
      problem: "A function should count how many numbers in a list are smaller than `t`. It returns the right answer, 2, for `count_below_buggy([5, 1, 9], 6)`, but a teammate says it is wrong. Find the failing input and fix it.",
      approach: ["Think about which inputs are affected by the loop bound. `range(len(a) - 1)` skips the last index.", "The bug is invisible unless the last element should be counted.", "Construct the smallest input that exposes it: a list where **every** element is below `t`, such as `[1, 2, 3]` with `t = 10`.", "Fix by looping over the items directly."],
      code: buggy,
      takeaway: "Choose test inputs that make the *boundary item matter*. The first sample agreed because its last element was not supposed to be counted anyway. “All items qualify” is a cheap input that exposes many boundary bugs." },
    { kind: "worked", id: "worked-stress", title: "Stress test a clever solution",
      problem: "You wrote a one-pass solution for the maximum sum of a contiguous subarray. How can you gain confidence it is correct, without trusting your own reasoning?",
      approach: ["Write the simplest possible version that tries every subarray: slow, but easy to verify by eye.", "Generate many small random arrays (including negatives, since “all negative” is a classic trap).", "Assert that both functions agree on each; a failure prints the exact input."],
      code: stress,
      takeaway: "Five hundred random tiny tests catch most bugs in seconds. The brute force does not need to be fast, only *obviously right*. Once they agree, you can trust the fast version on large inputs." },
  ],
  cheatSheet: [{ label: "Before coding", value: "re-read constraints + output format; list edge cases" }, { label: "Edge cases", value: "empty · one item · all equal · sorted · negatives · max size · duplicates" }, { label: "Fast input", value: "input = sys.stdin.readline · or sys.stdin.read().split()" }, { label: "Fast output", value: "print(\"\\n\".join(results)) once" }, { label: "Debug", value: "smallest failing input → trace variables on paper" }, { label: "Verify", value: "brute force vs fast on 500 random small inputs" }],
  summary: ["Clear names, small functions and comments that explain why prevent bugs before they exist.", "Boundary mistakes (off-by-one) cause most “passes the sample” failures. Check the first and last value of every loop.", "Read input quickly (`sys.stdin`) and match the output format exactly.", "Test with a checklist of edge cases, and write the expected answers before running.", "Debug by shrinking the failing input; verify fast solutions with a brute-force stress test."],
  checks: [
    { kind: "concept", q: "A solution passes the sample but fails hidden tests. What is the best first step?", options: ["Rewrite it from scratch", "Run an edge-case checklist and find the smallest input that fails", "Submit again", "Add more print statements everywhere"], answer: 1, why: "Hidden tests usually probe edge cases. Finding the smallest failing input turns the bug into something you can trace by hand." },
    { kind: "trace", q: "A list has 5 items. Which `range` visits every index exactly once?", options: ["range(4)", "range(1, 5)", "range(5)", "range(6)"], answer: 2, why: "`range(5)` gives 0 to 4. `range(4)` misses the last index, `range(1, 5)` misses the first, and `range(6)` includes 5, which does not exist." },
    { kind: "recognize", q: "You have a clever O(n) solution you are not fully sure about. What is a good way to build confidence?", options: ["Trust it because it passed the sample", "Compare it against a slow, simple brute force on many random small inputs", "Run it once on the largest input", "Ask for the editorial"], answer: 1, why: "A brute force is easy to verify, and random small tests expose disagreements quickly." },
    { kind: "concept", q: "Why is `\"\\n\".join(results)` followed by one `print` better than printing inside a loop for 10⁵ lines?", options: ["It changes the output", "Each `print` call has overhead, so one big write is much faster", "`print` cannot be used in loops", "It makes the answer correct"], answer: 1, why: "Many small writes cost much more than one large write; the output text is identical." },
    { kind: "trace", q: "`count_below_buggy([1, 2, 3], 10)` returns 2 instead of 3. What is the cause?", options: ["The comparison is wrong", "`range(len(a) - 1)` never visits the last index", "The list is not sorted", "`t` is too large"], answer: 1, why: "The loop stops one index early, so `a[2]` is never examined." },
    { kind: "concept", q: "What does an `assert` do when its condition is False?", options: ["Prints a warning and continues", "Stops the program with an error showing where it failed", "Returns False", "Ignores it"], answer: 1, why: "A failed assert raises an AssertionError, so a block of asserts doubles as a quick test suite." },
    { kind: "concept", q: "Why write small functions?", options: ["They can be tested and reused on their own", "They always run faster", "They prevent every bug", "Python requires them"], answer: 0, why: "A small function can be checked with a few inputs and reused, which makes wrong answers easier to find." },
    { kind: "concept", q: "When a program gives a wrong answer, what is the best first step?", options: ["Trace a small input where you know the right answer", "Rewrite the whole program", "Raise the time limit", "Submit again without changes"], answer: 0, why: "A small input with a known answer shows exactly where the values stop matching what you expected." },
    { kind: "concept", q: "Which testing habit suits contest problems?", options: ["Run the sample input, then edge cases such as 0, 1 and the largest allowed input", "Only run the largest input", "Skip the samples to save time", "Test once, then stop"], answer: 0, why: "Samples check the basic reading; edge and large inputs catch the mistakes the samples miss." },
    { kind: "trace", q: "After `def f(x=[]):` appends 1 to x and returns it, what does the second call `f()` return?", options: ["[1]", "[1, 1]", "[]", "It raises an error"], answer: 1, why: "The default list is created once and shared between calls, so the second call sees the first call's item." },
    { kind: "concept", q: "What is the main risk of a bare `except:` in a contest solution?", options: ["It hides real errors, so a wrong answer can look like a silent default instead of a crash", "It makes the program slower", "Python requires it", "It stops input from being read"], answer: 0, why: "A hidden error can turn a bug into a wrong answer that is hard to find." },
    { kind: "concept", q: "Why test n = 0 and n = 1 even though they are small?", options: ["They often expose empty-input and index bugs", "They are always the slowest case", "The judge rejects them automatically", "They never matter"], answer: 0, why: "Empty and single-element inputs break many index calculations." },
    { kind: "trace", q: "def f(a, b=None): if b is None: b = []; b.append(a); return b. What does print(f(1), f(2)) print?", options: ["[1] [2]", "[1] [1, 2]", "[1, 2] [2]", "[1, 2] [1, 2]"], answer: 0, why: "The default None creates a new list on each call, so the calls do not share state." },
    { kind: "concept", q: "For many lines of input in Python, why is sys.stdin.read() often preferred to repeated input()?", options: ["Reading all input at once avoids the overhead of one call per line", "It changes the answer", "It is required for strings", "Input is always small"], answer: 0, why: "Fewer, larger reads cut the per-line overhead, which matters with large inputs." },
    { kind: "trace", q: "What does print(7 if 0 else 8) print?", options: ["8", "7", "0", "It raises an error"], answer: 0, why: "0 is falsy, so the else value 8 is chosen." },
  ],
  nextNote: "You now have the foundation. Next, **Time & Space Complexity** teaches you to predict whether a solution will be fast enough.",
};
