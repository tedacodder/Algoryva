import type { LessonV2 } from "../lesson-types";

const code = String.raw`from collections import Counter

log = [
    ("A", "prefix sum", "solved"),
    ("B", "two pointers", "upsolved"),
    ("C", "binary search", "upsolved"),
    ("D", "DP", "unsolved"),
    ("E", "BFS", "solved"),
    ("F", "DP", "upsolved"),
]

print(sum(1 for _, _, s in log if s == "solved"))   # 2
print(sum(1 for _, _, s in log if s == "unsolved"))   # 1
print(Counter(topic for _, topic, s in log if s != "solved").most_common(1))   # [('DP', 2)]

def review_days(first=1, times=4):
    day, gap, out = 0, first, []
    for _ in range(times):
        day += gap
        out.append(day)
        gap *= 2
    return out

print(review_days())   # [1, 3, 7, 15]`;

export const upsolving: LessonV2 = {
  topic: "upsolving", depth: "complete", minutes: 45,
  hook: "A contest tells you what you could not do under pressure; upsolving, solving the problems afterwards, turns that into a pattern you recognise next time.",
  objectives: [
    "Define upsolving and explain why it improves more than a contest score does.",
    "Keep a log of problems with the technique that solved them, and the signal that pointed to it.",
    "Turn a log into a review plan, with reviews spaced further apart over time.",
    "Recognise the patterns that recur across problems, and state the signal for each.",
    "Measure progress honestly, separating what was solved live from what was upsolved.",
  ],
  prereqNote: "Contest Strategy explains how a contest is run. Upsolving is what you do afterwards, so it helps to know the planning model first.",
  sections: [
    { kind: "intuition", id: "after", title: "The contest is the test; upsolving is the lesson",
      paras: [
        "A contest measures what you can do under time pressure, and it is a useful measurement. But the learning happens afterwards. Once the clock has stopped, you have the time to read the problems you could not solve, to see the idea that was missing, and to solve them properly.",
        "That is upsolving: returning to the problems from a contest you did not finish, and solving them without the pressure. It is one of the most effective habits in competitive programming, because each problem you upsolve is a pattern you can now recognise.",
      ] },
    { kind: "concept", id: "concept", title: "What makes upsolving work",
      paras: [
        "Upsolving is not copying a solution. It works when you make the thinking explicit: name the technique, write down the signal in the statement that pointed to it, and note why the first attempt failed.",
      ],
      bullets: [
        "**Solved live** and **upsolved** are different entries. Keep them apart, so your record shows what you can do under pressure as well as what you can learn.",
        "**The signal** is the phrase or property in the statement that suggested the technique. Writing it down is what makes the pattern reusable.",
        "**The mistake** is the reason the first attempt failed, such as a missed edge case or the wrong technique. It is the most valuable line in the log.",
        "**Spacing** matters. A pattern reviewed after one day, then three, then a week, is remembered far better than one reviewed many times on a single day.",
      ] },
    { kind: "example", id: "example", title: "A contest log",
      paras: [
        "Suppose a contest had six problems. You solved A and E live, and upsolved B, C and F afterwards. D is still unsolved. The log records each problem with its topic and status.",
        "Two things stand out. Both DP problems (D and F) have caused trouble, so DP is where to focus. And the live score (2 solved) is lower than the score you would have after upsolving (5 out of 6, with D still open).",
      ],
      table: { head: ["Problem", "Topic", "Status", "Signal to remember"], rows: [["A", "prefix sum", "solved live", "many range-sum queries"], ["B", "two pointers", "upsolved", "sorted array and a target pair"], ["C", "binary search", "upsolved", "smallest value that works, monotone"], ["D", "DP", "unsolved", "still open: choose or skip under a small state"], ["E", "BFS", "solved live", "fewest moves on a grid"], ["F", "DP", "upsolved", "choose or skip, best future from a small state"]] } },
    { kind: "viz", id: "viz-upsolve", title: "A recognition map from upsolving", viz: "upsolve-map",
      paras: [
        "Each upsolved problem ticks the technique its signal taught you. The map shows what you can now spot at a glance. Empty cells are the next targets for practice.",
      ] },
    { kind: "code", id: "code", title: "Analysing the log and scheduling reviews",
      paras: [
        "The plan: count which topics are not yet solved live, and compute review dates that double the gap each time. Both use only the standard library, so the analysis is repeatable.",
      ],
      pseudocode: "count the topics not solved live; the most common one is where to practise\nreviews: day 1, then +2, +4, +8 (each gap doubles)",
      code,
      walkthrough: [
        "The first three prints summarise the log: how many were solved live, how many are open, and which topic has the most problems that were not solved live. DP appears twice, so it leads.",
        "review_days doubles the gap each time. Starting from day 0, the reviews fall on days 1, 3, 7 and 15, so each review comes after a longer rest than the one before.",
        "Counter comes from the standard library and counts strings. It is the simplest way to see where the weak topics cluster.",
      ] },
    { kind: "complexity", id: "complexity", title: "The cost of keeping a log",
      rows: [
        { what: "counting topics in the log", time: "O(m)", space: "O(t)", why: "one pass over the m entries, storing one counter per distinct topic t." },
        { what: "review schedule", time: "O(r)", space: "O(r)", why: "one step per review date; the number of reviews r is small, usually four or five." },
      ],
      paras: [
        "The cost is trivial. The real cost is the time spent writing the reason for each mistake, and that time is where the value comes from.",
      ] },
    { kind: "edge", id: "edge", title: "Cases to handle in the log",
      items: [
        { case: "A problem solved after a long time without help", handle: "Log it as upsolved, not solved live. Counting it as solved overstates your contest ability." },
        { case: "A problem that uses two techniques", handle: "Record both topics. The counter then reflects that the problem exercised both patterns." },
        { case: "A problem you read but never solved", handle: "Log it as unsolved with the signal you missed. Leaving it out hides the weakness." },
        { case: "No problems in a topic yet", handle: "A topic with zero entries does not appear in the counter at all, so check the map for empty cells rather than trusting the counter alone." },
      ] },
    { kind: "mistakes", id: "mistakes", title: "Common mistakes when upsolving",
      items: [
        { mistake: "Reading the editorial and moving on without solving the problem yourself.", fix: "Read the signal, close the solution, and try again. The thinking is the practice; reading alone teaches little." },
        { mistake: "Logging only the solution, not the signal.", fix: "Write the phrase in the statement that should have pointed you to the technique. That is what you will recognise next time." },
        { mistake: "Counting upsolved problems as contest results.", fix: "Keep the two statuses separate, so progress in live solving is measured honestly." },
        { mistake: "Reviewing everything on the same day.", fix: "Space the reviews. A pattern seen once a week for a month sticks better than the same pattern reviewed ten times in one sitting." },
      ] },
    { kind: "recognize", id: "recognize", title: "Recognising a pattern worth upsolving",
      signals: [
        "You could not start the problem: no first idea came to mind, which points to a missing pattern.",
        "You started but got the wrong answer on a case you had not thought of: an edge case worth recording.",
        "You solved it, but only after a long time: the pattern is known but not yet fast, which needs repetition.",
      ],
      notThis: [
        "A problem lost to a typing error or a misread input is a process mistake. Log it briefly, but it is not a pattern, so do not add it to the recognition map.",
        "A problem far above your current level is better left for later. Upsolve problems one step beyond what you can already do.",
      ],
      paras: [
        "The most useful upsolves are the problems where you could not start, because that is where a new pattern is being learned.",
      ] },
    { kind: "worked", id: "worked", title: "Worked problem: turning one upsolve into a rule",
      problem: "After upsolving a problem that asked for the number of ways to pick two positions in a sorted array summing to a target, you want a rule you can apply next time. Write it.",
      approach: [
        "Name the technique: two pointers on a sorted array, moving the ends towards the middle.",
        "State the signal: a sorted sequence and a target sum to find a pair of positions.",
        "Record the mistake that caused the trouble: forgetting to move the correct pointer when the sum was too small or too large.",
      ],
      code: String.raw`signal = "sorted array, find a pair with a target sum"
technique = "two pointers: move the left end up if the sum is too small, the right end down if too large"
mistake = "moved the wrong pointer, so the search skipped a valid pair"
print(technique)   # two pointers: move the left end up if the sum is too small, the right end down if too large`,
      takeaway: "A good log entry has three parts: the technique, the signal that suggests it, and the mistake to avoid. Together they turn one problem into a rule you can apply." },
  ],
  cheatSheet: [
    { label: "Upsolve", value: "solve the problems you could not finish, afterwards, without time pressure" },
    { label: "Log entry", value: "problem, technique, signal in the statement, mistake that cost time" },
    { label: "Reviews", value: "space them out, each gap roughly double the last" },
    { label: "Progress", value: "keep solved-live and upsolved separate; track the topics with most open entries" },
  ],
  summary: [
    "Upsolving turns contest mistakes into reusable patterns, which is where most of the learning happens.",
    "A good log records the technique, the signal in the statement, and the mistake, not only the solution.",
    "Review spacing with doubling gaps keeps patterns in memory with little total effort.",
    "Measure honestly: separate solved-live results from upsolved ones, and focus on the topic with the most open entries.",
  ],
  checks: [
    { kind: "concept", q: "What is the main purpose of upsolving?", options: ["To raise your contest rating immediately", "To turn problems you could not finish into patterns you recognise next time", "To copy solutions into a notebook", "To avoid reading the statement"], answer: 1, why: "Upsolving is solving afterwards without pressure, so the missing pattern is learned and can be recognised later." },
    { kind: "trace", q: "In the log above (A solved, B upsolved, C upsolved, D unsolved, E solved, F upsolved), how many problems were solved live?", options: ["1", "2", "3", "4"], answer: 1, why: "Only A and E were solved live. The rest were either upsolved or left unsolved." },
    { kind: "trace", q: "Using the review rule that doubles the gap from day 0 with a first gap of 1, on which days are the first three reviews?", options: ["1, 2, 3", "1, 3, 7", "2, 4, 8", "1, 2, 4"], answer: 1, why: "The gaps are 1, 2 and 4, so the reviews fall on days 1, 3 and 7." },
    { kind: "concept", q: "Why should a log record the signal in the statement, not only the solution?", options: ["Solutions are not worth keeping", "The signal is what lets you spot the same pattern in a new problem", "Statements change every week", "It makes the log longer"], answer: 1, why: "A solution fits one problem. A signal such as a sorted array with a target sum applies to many problems." },
    { kind: "recognize", q: "Which problem is the most useful to upsolve?", options: ["One lost to a typing error", "One you could not start, because no first idea came to mind", "One far above your level, with no hints", "One you already solved live quickly"], answer: 1, why: "Being unable to start points to a missing pattern. That is where the new learning is." },
    { kind: "concept", q: "What does upsolving mean?", options: ["Solving problems again after a contest or lesson, with time to think and to learn from the editorial", "Solving problems faster than the judge", "Submitting before the contest starts", "Solving only the hardest problem"], answer: 0, why: "Upsolving is the deliberate review of what you could not solve live." },
    { kind: "concept", q: "After a contest, which problems should you upsolve first?", options: ["Unsolved problems whose idea you can learn from, then near-misses", "Only the easiest problems", "Only problems from other contests", "None of them"], answer: 0, why: "Unsolved problems teach the most new technique, and near-misses are often one idea away." },
    { kind: "concept", q: "What is a good first step before reading an editorial when upsolving?", options: ["Think for a bounded time and write down what you tried", "Copy the editorial code", "Skip straight to the answer", "Submit a random guess"], answer: 0, why: "Struggling for a fixed time makes the editorial's idea stick when you do read it." },
    { kind: "concept", q: "Why review your own wrong submissions?", options: ["They show which reasoning step failed, so you can catch the same error earlier next time", "Judges count them twice", "They lower your rating", "They are never useful"], answer: 0, why: "A wrong submission records a specific belief that turned out to be false." },
    { kind: "concept", q: "What does a spaced review schedule do for a problem you have solved?", options: ["It brings the problem back at growing gaps, so it stays in memory", "It makes you forget it on purpose", "It repeats the problem the same day", "It ends the practice"], answer: 0, why: "Reviewing just before you forget strengthens recall more than repeating at once." },
    { kind: "concept", q: "When reading an editorial, what is the most useful thing to extract?", options: ["The key observation that made the problem tractable", "The variable names used", "The judge's machine speed", "The formatting rules"], answer: 0, why: "The observation is the reusable part; the code is specific to one problem." },
    { kind: "concept", q: "Why group upsolved problems by technique?", options: ["So you can recognise the signal in a statement and pick the right technique faster", "To make the list longer", "Judges require it", "To avoid solving them again"], answer: 0, why: "Recognising a pattern from the wording is the skill contests actually test." },
    { kind: "concept", q: "After solving an upsolved problem, what should you record?", options: ["The signal in the statement, the key idea, and the mistake that slowed you down", "Only the final code", "Only the time it took", "Nothing"], answer: 0, why: "The signal and the key idea are what transfer to new problems." },
    { kind: "concept", q: "What is a sign that your upsolving is working?", options: ["You solve a similar new problem without the editorial, from its signal alone", "You copy editorials faster", "You solve more problems per hour without learning from them", "You stop reading problem statements"], answer: 0, why: "The test of learning is whether the idea appears on a problem you have not seen." },
    { kind: "concept", q: "Why come back to a solved problem after a gap of days or weeks?", options: ["Recall fades, and testing yourself after a gap shows what you really remember", "The judge resets the problem", "It is required to earn points", "Problems change every week"], answer: 0, why: "Recalling an idea after a gap is what makes it durable." },
  ],
  nextNote: "Upsolving feeds the topics across the curriculum. Pick the topic with the most open entries, and return to its lesson with the recognition map in mind.",
};
