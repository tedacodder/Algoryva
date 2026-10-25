import type { LessonV2 } from "../lesson-types";

const naive = String.raw`def insertion_sort(a):
    a = a[:]
    steps = 0
    for i in range(1, len(a)):
        x, j = a[i], i - 1
        while j >= 0 and a[j] > x:
            a[j + 1] = a[j]
            j -= 1
            steps += 1
        a[j + 1] = x
    return a, steps

print(insertion_sort([5, 2, 4, 1, 6, 3]))   # ([1, 2, 3, 4, 5, 6], 8)
print(insertion_sort(list(range(1000, 0, -1)))[1])   # 499500`;
const merge = String.raw`def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    left, right = merge_sort(a[:mid]), merge_sort(a[mid:])
    out = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i])
            i += 1
        else:
            out.append(right[j])
            j += 1
    out.extend(left[i:])
    out.extend(right[j:])
    return out

print(merge_sort([5, 2, 4, 1, 6, 3]))   # [1, 2, 3, 4, 5, 6]
print(merge_sort([]), merge_sort([7]))   # [] [7]
print(merge_sort([3, 1, 3, 2, 1]))   # [1, 1, 2, 3, 3]`;
const quick = String.raw`import random

def quicksort(a, lo=0, hi=None):
    if hi is None:
        hi = len(a) - 1
    if lo >= hi:
        return
    p = random.randint(lo, hi)
    a[p], a[hi] = a[hi], a[p]
    pivot = a[hi]
    i = lo
    for j in range(lo, hi):
        if a[j] < pivot:
            a[i], a[j] = a[j], a[i]
            i += 1
    a[i], a[hi] = a[hi], a[i]
    quicksort(a, lo, i - 1)
    quicksort(a, i + 1, hi)

data = [5, 2, 4, 1, 6, 3, 2]
quicksort(data)
print(data)   # [1, 2, 2, 3, 4, 5, 6]
empty = []
quicksort(empty)
print(empty)   # []
random.seed(3)
big = [random.randint(0, 50) for _ in range(200)]
check = big[:]
quicksort(check)
print(check == sorted(big))   # True`;
const counting = String.raw`def counting_sort(a, max_val):
    cnt = [0] * (max_val + 1)
    for x in a:
        cnt[x] += 1
    out = []
    for v, c in enumerate(cnt):
        out.extend([v] * c)
    return out

print(counting_sort([3, 1, 4, 1, 5, 2, 0], 5))   # [0, 1, 1, 2, 3, 4, 5]

def bucket_sort(a, buckets=4):
    lo, hi = min(a), max(a)
    width = (hi - lo) / buckets or 1
    bins = [[] for _ in range(buckets)]
    for x in a:
        bins[min(int((x - lo) / width), buckets - 1)].append(x)
    out = []
    for b in bins:
        out.extend(sorted(b))
    return out

print(bucket_sort([0.9, 0.1, 0.5, 0.3, 0.7, 0.2]))   # [0.1, 0.2, 0.3, 0.5, 0.7, 0.9]`;
const cyclic = String.raw`def cyclic_sort(a):
    i = 0
    while i < len(a):
        j = a[i] - 1
        if a[i] != a[j]:
            a[i], a[j] = a[j], a[i]
        else:
            i += 1
    return a

print(cyclic_sort([3, 1, 5, 4, 2]))   # [1, 2, 3, 4, 5]
print(cyclic_sort([2, 3, 4, 1, 1]))   # [1, 2, 3, 4, 1]`;
const missing = String.raw`def first_missing_positive(a):
    n = len(a)
    i = 0
    while i < n:
        j = a[i] - 1
        if 0 <= j < n and a[i] != a[j]:
            a[i], a[j] = a[j], a[i]
        else:
            i += 1
    for i in range(n):
        if a[i] != i + 1:
            return i + 1
    return n + 1

print(first_missing_positive([3, 4, -1, 1]))   # 2
print(first_missing_positive([7, 8, 9, 11, 12]))   # 1
print(first_missing_positive([1, 2, 3]))   # 4

def find_error_nums(a):
    n = len(a)
    a = a[:]
    i = 0
    while i < n:
        j = a[i] - 1
        if a[i] != a[j]:
            a[i], a[j] = a[j], a[i]
        else:
            i += 1
    for i in range(n):
        if a[i] != i + 1:
            return [a[i], i + 1]
    return []

print(find_error_nums([1, 2, 2, 4]))   # [2, 3]
print(find_error_nums([1, 1]))   # [1, 2]`;
const inv = String.raw`def count_inversions(a):
    def sort(lst):
        if len(lst) <= 1:
            return lst, 0
        mid = len(lst) // 2
        left, x = sort(lst[:mid])
        right, y = sort(lst[mid:])
        merged, count = [], x + y
        i = j = 0
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                merged.append(left[i])
                i += 1
            else:
                merged.append(right[j])
                j += 1
                count += len(left) - i
        merged.extend(left[i:])
        merged.extend(right[j:])
        return merged, count
    return sort(a)[1]

print(count_inversions([2, 4, 1, 3, 5]))   # 3
print(count_inversions([5, 4, 3, 2, 1]))   # 10
print(count_inversions([1, 2, 3]))   # 0`;

export const sortingAdvanced: LessonV2 = {
  topic: "sorting-advanced", depth: "complete", minutes: 50,
  hook: "The sorting algorithms that actually scale: divide and conquer for O(n log n), counting tricks that beat it, and an in-place trick for arrays of 1 to n.",
  objectives: [
    "Explain why bubble, selection and insertion sort are too slow, and why merge and quick sort reach O(n log n).",
    "Write merge sort and trace a merge of two sorted halves.",
    "Write quicksort with a partition, and explain why a random pivot avoids the O(n²) worst case.",
    "Use counting sort and bucket sort when values are small integers or evenly spread.",
    "Use cyclic sort to find missing and duplicate numbers in an array of 1 to n, in O(n) time and O(1) space; use merge sort to count inversions.",
  ],
  prereqNote: "Sorting Basics (comparisons, stability, the simple sorts) and Recursion I (a function calling itself on smaller input).",
  sections: [
    { kind: "intuition", id: "exams", title: "Sorting a huge pile of exam papers",
      paras: ["Imagine 1,000 exam papers to sort by score. Inserting them one at a time into a sorted pile means searching and shifting through a growing pile, and it gets slower and slower. A much faster way: split the pile among friends, let each sort their own small pile, then **merge** two sorted piles by repeatedly taking the smaller top paper. Merging is quick because both piles are already in order.",
        "That is merge sort. Quicksort splits differently: pick one paper as a benchmark and split the rest into “lower” and “higher”, then sort each half. And if scores are whole numbers from 0 to 100, you can skip comparing entirely: just count how many papers have each score."] },
    { kind: "naive", id: "naive", title: "Insertion sort at scale",
      paras: ["Insertion sort slides each item left into place. It is simple and fast on nearly sorted data, but on reversed data every item moves past all the others.",
        "The counter below counts shifts. For the 6 items shown it is 8 (one shift per out-of-order pair, the inversion count); for 1,000 items in reverse order it is 499,500, which is n(n − 1)/2. Double the input and the work quadruples; for 10⁵ items it would be about 5 billion."],
      code: naive,
      cost: "O(n²) in the worst case: about 10¹⁰ steps for n = 10⁵." },
    { kind: "observation", id: "observation", title: "Sorted halves are cheap to combine",
      paras: ["Merging two sorted lists of total size n takes only n steps: look at the two front items, take the smaller, repeat. So if you can sort two halves, you can sort the whole in n extra steps. Sorting each half uses the same idea, recursively, so the list is halved about log₂ n times and every level costs n in total: **n log n**.",
        "Quicksort gets the same shape differently: one pass (partition) puts everything smaller than a pivot on its left and everything larger on its right, so the pivot is in its final place and the two sides are independent subproblems. If the pivot splits roughly in half each time, that is again log n levels of n work."] },
    { kind: "concept", id: "concept", title: "Vocabulary and the n log n barrier",
      paras: ["A few ideas organise the whole topic."],
      bullets: ["**Divide and conquer:** split the problem, solve the parts independently, combine. Merge sort does the work in the combine step (merging); quicksort does it in the split step (partitioning).", "**Comparison sort:** learns about the data only by asking “is this item before that one?”. Any such algorithm needs about **n log₂ n comparisons in the worst case**, because each comparison has only two outcomes and there are n! possible orders to tell apart (log₂ n! is about n log₂ n).", "**Beating the barrier:** counting, bucket and cyclic sort use extra knowledge about the values (small integers, a uniform spread, or exactly 1 to n), so they do not need comparisons.", "**Stable:** equal items keep their original order. Merge sort is stable; quicksort as written is not.", "**In place:** uses only O(1) or O(log n) extra memory beyond the input. Quicksort and cyclic sort are; merge sort needs O(n) extra."] },
    { kind: "viz", id: "viz-merge", title: "Merge sort in motion", viz: "merge-sort",
      paras: ["Blue is the left sorted half, red is the right. At each merge the pointers `i` and `j` compare front items and the smaller moves into “merged so far”. Watch the small merges at the bottom combine into bigger ones, level by level."] },
    { kind: "viz", id: "viz-partition", title: "Quicksort's partition step", viz: "quicksort-partition",
      paras: ["Quicksort picks a pivot, here the last element, and moves smaller values to its left. The pivot ends in its final position, and both sides are then sorted the same way. Watch the i pointer mark the end of the left block as j scans the rest."] },
    { kind: "example", id: "example", title: "One merge by hand",
      paras: ["Merge the sorted halves `[2, 4, 5]` and `[1, 3, 6]`."],
      table: { head: ["compare", "take", "merged so far"], rows: [["2 vs 1", "1 (right)", "[1]"], ["2 vs 3", "2 (left)", "[1, 2]"], ["4 vs 3", "3 (right)", "[1, 2, 3]"], ["4 vs 6", "4 (left)", "[1, 2, 3, 4]"], ["5 vs 6", "5 (left)", "[1, 2, 3, 4, 5]"], ["left empty", "6 (rest of right)", "[1, 2, 3, 4, 5, 6]"]] },
      steps: [{ title: "Each step takes one item", body: "Six items, six steps: the cost of a merge is the total size, never more." }, { title: "Why `<=` matters", body: "Taking from the left on ties keeps equal items in their original order, which makes merge sort **stable**." }] },
    { kind: "code", id: "code-merge", title: "Merge sort in code",
      paras: ["Split, sort each half recursively, merge."],
      pseudocode: "merge_sort(list):\n    if the list has 0 or 1 items: return it\n    split into left and right halves; sort each recursively\n    merge: repeatedly take the smaller front item; then append whatever remains",
      code: merge,
      walkthrough: ["The base case `len(a) <= 1` is already sorted. Slicing `a[:mid]` and `a[mid:]` splits into halves (copying, which is fine for learning).", "The `while` loop is the merge. Afterwards, at most one of `left[i:]` and `right[j:]` is non-empty; `extend` appends the leftover tail, which is already sorted.", "It always does about n log n work, even on sorted input, and needs O(n) extra memory for the merged lists.", "Python's built-in `sorted` uses Timsort, a merge-sort descendant that also exploits existing order."] },
    { kind: "code", id: "code-quick", title: "Quicksort with a random pivot",
      paras: ["Partition around a pivot in place. Using a **random** pivot makes the bad case (always picking the smallest or largest) astronomically unlikely, whatever the input."],
      code: quick,
      walkthrough: ["`a[p], a[hi] = a[hi], a[p]` swaps the random pivot to the end so the loop can ignore it.", "`i` marks the boundary: everything left of `i` is smaller than the pivot. Each smaller item found at `j` is swapped to the boundary. At the end the pivot is swapped into position `i`, its final place.", "Then sort the two sides, which are independent: `quicksort(a, lo, i - 1)` and `quicksort(a, i + 1, hi)`.", "It sorts in place (O(log n) extra stack on average) but is **not stable**. This simple partition handles many equal keys poorly; the fix is a three-way partition (less, equal, greater).", "The final check sorts 200 random numbers (with many repeats, since the range is only 0 to 50) and compares the result with `sorted`. Comparing against a trusted answer is the habit from the Coding Practices lesson."] },
    { kind: "code", id: "code-count", title: "Beating n log n: counting and bucket sort",
      paras: ["Comparison sorts cannot beat about n log n. If you do not compare, you can. **Counting sort** tallies how many times each small integer appears and then writes them out in order. **Bucket sort** drops values into a few ranges, sorts each small bucket, and joins them."],
      code: counting,
      walkthrough: ["`counting_sort` costs O(n + k) where k is the largest value, so it wins when values are small integers (ages, scores, digits) and loses when k is huge.", "`[v] * c` writes `v` exactly `c` times. This version sorts bare numbers; to sort records you would keep per-value lists instead.", "`bucket_sort` assumes values spread fairly evenly over their range; then each bucket is tiny and sorting them is cheap. If everything lands in one bucket, it is only as good as the sort used inside.", "The `or 1` avoids a zero width when all values are equal, and `min(..., buckets - 1)` puts the maximum into the last bucket."] },
    { kind: "viz", id: "viz-cyclic", title: "Cyclic sort: every value goes home", viz: "cyclic-sort",
      paras: ["When an array holds the numbers 1 to n, the value v belongs at index v − 1. Look at the value under pointer `i`: if its home already holds the right value, move on; otherwise swap it home. Every swap puts at least one value in its final spot, so there are at most n swaps."] },
    { kind: "code", id: "code-cyclic", title: "Cyclic sort, and what it finds",
      paras: ["Sorting 1 to n in O(n) time and O(1) space is useful on its own, and even more as a way to **spot what does not fit**: after cyclic sort, an index `i` that does not hold `i + 1` reveals a missing number (`i + 1`), and the value found there is a duplicate."],
      code: cyclic,
      walkthrough: ["`j = a[i] - 1` is the home index of the current value.", "The test `a[i] != a[j]` also prevents an **infinite loop** when duplicates exist: if the home already holds the same value, swapping would change nothing, so the pointer moves on.", "Each swap fixes one value for good and `i` advances otherwise, so the loop runs at most about 2n times: O(n).", "With a duplicate (second example) the array does **not** end up sorted. Every value from 1 to 4 reaches its home, and the spare copy of 1 is left in the slot that belongs to the missing 5. That slot, where `a[i] != i + 1`, is the clue used below."] },
    { kind: "code", id: "code-missing", title: "Missing and duplicate numbers",
      paras: ["Two classic uses: the smallest missing positive number (values can be anything), and finding the duplicate and the missing number in a list that should be 1 to n."],
      code: missing,
      walkthrough: ["For `first_missing_positive`, values outside `1..n` are ignored (`0 <= j < n` check): the answer is always in `1..n + 1`, so only those values matter.", "After placing every in-range value at its home, the first index `i` with `a[i] != i + 1` means `i + 1` is missing. If none, the answer is `n + 1`.", "`find_error_nums` copies the list first so the caller's data is not rearranged. The mismatching slot holds the duplicate, and its index plus one is the missing number: `[2, 3]` for `[1, 2, 2, 4]`.", "Both run in O(n) time and O(1) extra space (besides the copy), where sorting would cost O(n log n)."] },
    { kind: "complexity", id: "complexity", title: "Costs side by side",
      rows: [
        { what: "Merge sort", time: "O(n log n) always", space: "O(n)", why: "log₂ n levels of halving, each level merges n items in total. Stable." },
        { what: "Quicksort (random pivot)", time: "O(n log n) expected, O(n²) worst", space: "O(log n) stack", why: "Balanced partitions give log n levels; the worst case needs repeatedly terrible pivots, which random choice makes extremely unlikely. Not stable." },
        { what: "Counting sort", time: "O(n + k)", space: "O(k)", why: "One pass to count, one to write out; k is the value range." },
        { what: "Bucket sort", time: "O(n) on evenly spread data, O(n²) worst", space: "O(n)", why: "Small buckets sort cheaply; one crowded bucket does not." },
        { what: "Cyclic sort (values 1..n)", time: "O(n)", space: "O(1)", why: "At most n swaps, each placing a value permanently." },
        { what: "Insertion / selection / bubble", time: "O(n²)", space: "O(1)", why: "Compare or shift against many other items for each item." },
        { what: "Count inversions with merge sort", time: "O(n log n)", space: "O(n)", why: "While merging, each time a right item is taken, it jumps over every item still waiting on the left." }],
      paras: ["Any algorithm that sorts only by comparing items needs at least about n log₂ n comparisons in the worst case, so merge sort is optimal among comparison sorts. The non-comparison sorts beat it by using extra knowledge about the values."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Empty or one-item list", handle: "Already sorted. Base cases `len <= 1` and `lo >= hi` handle it." }, { case: "Many equal keys", handle: "Merge sort is unaffected. Simple quicksort partitions degrade; use a three-way partition if equal keys are common." }, { case: "Already sorted input", handle: "A quicksort that always picks the first or last item as pivot goes quadratic. Random pivot avoids that." }, { case: "Counting sort with huge values", handle: "Memory is O(max value). Only use it when the range is modest (say up to a few million)." }, { case: "Negative numbers in counting sort", handle: "Shift by the minimum value so indices start at 0." }, { case: "Cyclic sort with values outside 1..n", handle: "Skip them (as `first_missing_positive` does); an out-of-range index would crash." }, { case: "Recursion depth", handle: "Merge sort is only log n deep. Quicksort can be deep on bad pivots; random pivots keep it shallow." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Writing your own sort when `sorted` would do.", fix: "In contests use the built-in. Write these to learn, or when a problem needs the merge step itself (inversions, counting pairs)." }, { mistake: "Merging with `<` instead of `<=`.", fix: "Use `<=` on ties so the sort stays stable and counts of “pairs with equal values” come out right." }, { mistake: "Infinite loop in cyclic sort with duplicates.", fix: "Swap only if `a[i] != a[j]`; otherwise advance `i`." }, { mistake: "Always picking the first element as the quicksort pivot.", fix: "Pick randomly (or the median of three)." }, { mistake: "Using counting sort on a wide range.", fix: "Compare k with n log n: counting sort needs k to be comparable to n." }, { mistake: "Forgetting that merge sort copies data.", fix: "It needs O(n) extra memory; if memory is tight, quicksort or heap sort is in place." }] },
    { kind: "recognize", id: "recognize", title: "How to spot which sort to reach for",
      signals: ["You just need sorted output: use the built-in (`sorted`, `.sort()`).", "A problem asks for **inversions**, “count of smaller elements after self”, or pairs satisfying an inequality between positions: **merge sort with counting** during the merge.", "The array holds the numbers **1 to n** (or values that can be mapped there), and you must find **missing, duplicate or misplaced** values in O(1) extra space: **cyclic sort**.", "Values are **small integers** or fall in a small range: **counting sort**.", "Values are real numbers spread uniformly in a range: **bucket sort**.", "You must sort a **linked list** in O(n log n): merge sort (merging linked lists needs no extra memory)."],
      notThis: ["You only need the smallest k items: a heap is cheaper than sorting everything.", "The array is nearly sorted: insertion sort (or Python's Timsort) is already close to linear."] },
    { kind: "worked", id: "worked-inv", title: "Count inversions",
      problem: "An inversion is a pair of positions i < j with a[i] > a[j]. Count all inversions in an array in O(n log n). (Brute force over every pair is O(n²).)",
      approach: ["Run merge sort. Inversions come in three kinds: both items in the left half, both in the right half, or one in each.", "The first two are counted by the recursive calls. For the third, use the merge: both halves are sorted, so when a right item is smaller than the current left item, it is also smaller than **every item still waiting in the left half**.", "So each time a right item is taken, add the number of left items remaining: `len(left) - i`."],
      code: inv,
      takeaway: "The merge step does double duty: it sorts *and* counts, because sortedness makes “how many items are bigger than this” a subtraction instead of a loop. The same pattern solves “count of smaller numbers after self” and similar problems." },
    { kind: "worked", id: "worked-missing", title: "Find the missing number and the duplicate",
      problem: "A list should contain 1 to n once each, but one number appears twice and another is missing. Return `[duplicate, missing]` in O(n) time and O(1) extra space.",
      approach: ["Use cyclic sort: swap each value to its home index `value − 1`, skipping when its home already holds the same value.", "Afterwards every value is home except the duplicate's extra copy, which sits in the slot belonging to the missing number.", "The one index `i` where `a[i] != i + 1` gives both answers: `a[i]` is the duplicate and `i + 1` is the missing number."],
      code: missing,
      takeaway: "When the data is a permutation of 1 to n with small defects, the *position* encodes the value, so the array can serve as its own hash table: O(1) extra space where a set would need O(n)." },
  ],
  cheatSheet: [{ label: "Merge sort", value: "split, sort halves, merge by taking the smaller front; O(n log n), stable, O(n) space" }, { label: "Quicksort", value: "random pivot, partition, recurse on both sides; O(n log n) expected, in place, not stable" }, { label: "Counting sort", value: "count each value, write out in order; O(n + k)" }, { label: "Cyclic sort", value: "swap a[i] to index a[i] − 1 unless already equal; O(n), O(1) space" }, { label: "Inversions", value: "during the merge, add len(left) − i when taking from the right" }, { label: "Lower bound", value: "comparison sorts need Ω(n log n)" }],
  summary: ["Simple sorts are O(n²); merge sort and quicksort reach O(n log n) by dividing the problem.", "Merging two sorted lists costs only their total size, which is why halving repeatedly gives n log n.", "Quicksort partitions around a pivot in place; a random pivot avoids the quadratic worst case.", "Counting and bucket sort beat n log n by not comparing, when values are small or evenly spread.", "Cyclic sort handles arrays of 1 to n in O(n) time and O(1) space; merge sort can count inversions while it sorts."],
  checks: [
    { kind: "complexity", q: "Why does merge sort run in O(n log n)?", options: ["It does n comparisons in total", "It halves the list about log₂ n times and each level merges n items", "It sorts in place", "It uses a heap"], answer: 1, why: "There are about log₂ n levels of splitting, and merging all pieces on one level costs n steps." },
    { kind: "trace", q: "Merge `[2, 4, 5]` and `[1, 3, 6]`. What is the second item taken?", options: ["1", "2", "3", "4"], answer: 1, why: "First 1 is taken from the right, then 2 (left) beats 3 (right)." },
    { kind: "concept", q: "Why does a random pivot help quicksort?", options: ["It makes the sort stable", "It makes consistently bad splits extremely unlikely for any input", "It removes the need for recursion", "It makes it O(n)"], answer: 1, why: "A fixed pivot rule can be defeated by sorted or adversarial input. A random pivot gives balanced splits with high probability." },
    { kind: "recognize", q: "An array holds the numbers 1 to n with one missing and one repeated. Which technique finds both in O(n) time and O(1) space?", options: ["Merge sort", "Cyclic sort", "Counting sort with a huge range", "Binary search"], answer: 1, why: "Cyclic sort places each value at index value − 1, leaving the duplicate sitting in the missing number's slot." },
    { kind: "trace", q: "`count_inversions([2, 4, 1, 3, 5])` returns 3. Which pairs are the inversions?", options: ["(2,1), (4,1), (4,3)", "(2,4), (1,3), (3,5)", "(2,1), (4,3), (3,5)", "(4,1), (1,3), (2,5)"], answer: 0, why: "An inversion is a larger value before a smaller one: 2 before 1, 4 before 1, and 4 before 3." },
    { kind: "concept", q: "When is counting sort a poor choice?", options: ["When values are small integers", "When the largest value is enormous compared with n", "When there are duplicates", "When the list is already sorted"], answer: 1, why: "Counting sort needs memory and time proportional to the value range, so a huge range makes it slower and bigger than a comparison sort." },
    { kind: "complexity", q: "What is the running time of merge sort on n items?", options: ["O(n log n)", "O(n\u00b2)", "O(n)", "O(log n)"], answer: 0, why: "There are about log n levels of splitting, and each level does O(n) merging work." },
    { kind: "trace", q: "Lomuto partition with pivot = last element, on a = [3, 1, 2]. What is printed?\np = a[-1]; i = 0; for j in range(len(a)-1): if a[j] < p: swap a[i], a[j]; i += 1; then swap a[i], a[-1]", options: ["[1, 2, 3] 1", "[1, 3, 2] 1", "[1, 2, 3] 2", "[2, 1, 3] 1"], answer: 0, why: "After one swap at j=1 and the final swap, the pivot 2 sits at index 1." },
    { kind: "trace", q: "Counting sort on [3, 1, 3, 0] (keys 0 to 3). What is the result?", options: ["[0, 1, 3, 3]", "[3, 1, 3, 0]", "[0, 1, 2, 3]", "[1, 0, 3, 3]"], answer: 0, why: "Count each key, then write the keys back in order: 0, 1, 3, 3." },
    { kind: "trace", q: "Cyclic sort on [3, 1, 2] (values 1 to n). What is printed?\ni = 0; while i < n: j = a[i]-1; if a[i] != a[j]: swap a[i], a[j] else: i += 1", options: ["[1, 2, 3]", "[3, 1, 2]", "[2, 3, 1]", "[1, 3, 2]"], answer: 0, why: "Each value is swapped into its home index j = value - 1." },
    { kind: "concept", q: "Why can quicksort degrade to O(n\u00b2), and what prevents it in practice?", options: ["Bad pivots leave one side nearly empty each time; random or median-of-three pivots make bad splits rare", "Quicksort has no worst case", "A stack removes the problem", "Sorting twice avoids it"], answer: 0, why: "Repeated worst-case splits do n levels of O(n) work; good pivots keep the depth near log n." },
    { kind: "concept", q: "Which sort is both stable and O(n log n) in the worst case?", options: ["Merge sort", "Lomuto quicksort", "Selection sort", "Heap sort"], answer: 0, why: "Merge sort keeps equal items in their original order and never degrades." },
    { kind: "complexity", q: "Counting sort on n items with keys from 0 to k: what is the time?", options: ["O(n + k)", "O(n log n)", "O(n\u00b2)", "O(k log k)"], answer: 0, why: "One pass to count, one pass over the key range to write back." },
    { kind: "trace", q: "Python sorts (1,'b'), (0,'z'), (1,'a') by the first item only. What is the result?", options: ["[(0, 'z'), (1, 'b'), (1, 'a')]", "[(0, 'z'), (1, 'a'), (1, 'b')]", "[(1, 'b'), (0, 'z'), (1, 'a')]", "[(1, 'a'), (1, 'b'), (0, 'z')]"], answer: 0, why: "Python's sort is stable: the two items with key 1 keep their original order." },
    { kind: "trace", q: "Merge sort splits [5, 2, 9] into [5] and [2, 9], then sorts and merges. What is the final list?", options: ["[2, 5, 9]", "[5, 2, 9]", "[2, 9, 5]", "[9, 5, 2]"], answer: 0, why: "[2, 9] is sorted to itself, then merging [5] with [2, 9] gives [2, 5, 9]." },
  ],
  nextNote: "Next, **Recursion II** uses recursion to explore choices (backtracking) and to split problems in half (divide and conquer).",
};
