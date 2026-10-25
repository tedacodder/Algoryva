import type { LessonV2 } from "../lesson-types";

const code = String.raw`def greedy_by_ratio(problems, minutes):
    total_points, used = 0, 0
    for m, p in sorted(problems, key=lambda x: x[1] / x[0], reverse=True):
        if used + m <= minutes:
            used += m
            total_points += p
    return total_points

def best_plan(problems, minutes):
    best = [0] * (minutes + 1)
    for m, p in problems:
        for t in range(minutes, m - 1, -1):
            best[t] = max(best[t], best[t - m] + p)
    return best[minutes]

problems = [(10, 60), (20, 100), (30, 120)]
print(greedy_by_ratio(problems, 50))   # 160
print(best_plan(problems, 50))   # 220
print(greedy_by_ratio([(5, 5), (5, 5)], 7))   # 5
print(best_plan([(5, 5), (5, 5)], 7))   # 5
print(best_plan([(3, 9)], 2))   # 0`;

export const contestStrategy: LessonV2 = {
  topic: "contest-strategy", depth: "complete", minutes: 50,
  hook: "A contest with a clock is a knapsack problem: the right plan is the best set of problems that fits in the time, not the list you would solve in order of ease.",
  objectives: [
    "Model a contest as choosing problems with time costs and point values, under a fixed time budget.",
    "Explain why sorting by points per minute is a good heuristic but not always optimal, and find a counterexample.",
    "Use a dynamic-programming table to find the best set of problems for a given time, and state its cost.",
    "Plan a contest in practice: read all statements first, skip what is not yet cheap, and budget time per problem.",
    "Recognise when the contest model fits a situation, and when the problems depend on each other so it does not.",
  ],
  prereqNote: "Greedy and top-down DP are the key prerequisites. The 0/1 knapsack table in Bottom-Up DP is exactly the planning tool used here.",
  sections: [
    { kind: "intuition", id: "clock", title: "A contest is a clock and a list",
      paras: [
        "Two hours, six problems, and each problem has a different value and a different expected solving time. Most competitors spend the first minutes on the problem that looks easiest, which is not always the same as the one that earns the most points for the time it takes.",
        "The structure is familiar. You have a fixed budget (the minutes), and each item (a problem) costs time and returns points. Choosing which items to take is exactly the 0/1 knapsack problem: each problem is taken whole or skipped.",
      ] },
    { kind: "concept", id: "concept", title: "Points per minute, and why it can mislead",
      paras: [
        "The tempting rule is greedy: rank problems by points per minute, then take them in that order while time remains. It is quick, easy to explain, and often close to right.",
      ],
      bullets: [
        "Greedy by ratio is an approximation. It works when the problems divide the time finely, so no single large problem blocks the rest.",
        "It can fail when the big, high-value problem takes a large share of the clock. A small problem with a good ratio can then leave too little time for a combination that is worth more.",
        "The exact answer comes from the knapsack table: the best total for every time t, built one problem at a time. It considers every combination without listing them.",
        "The table is exact but costs time proportional to the number of problems times the number of minutes, so it suits contests, where both numbers are small.",
      ] },
    { kind: "example", id: "example", title: "Three problems and fifty minutes",
      paras: [
        "Take three problems: (10 minutes, 60 points), (20 minutes, 100 points) and (30 minutes, 120 points). Their ratios are 6, 5 and 4 points per minute.",
        "Greedy by ratio takes the 10-minute problem (60 points) and the 20-minute one (100 points). That uses 30 minutes and earns 160 points. The 30-minute problem then no longer fits in the 20 remaining minutes.",
        "The best plan is the 20-minute and 30-minute problems together: 50 minutes exactly, for 220 points. Greedy left 20 minutes unused and lost 60 points. The table below shows the best total for each set of problems and each time budget.",
      ],
      table: { head: ["Plan", "Minutes", "Points"], rows: [["10 + 20 (greedy)", "30", "160"], ["20 + 30 (best)", "50", "220"], ["10 + 30", "40", "180"], ["all three", "60", "too long"]] } },
    { kind: "viz", id: "viz-contest", title: "Filling the table for fifty minutes", viz: "contest-knapsack",
      paras: [
        "Each row adds one problem; each column is a time budget from 0 to 50 minutes. A cell holds the best points you can get in that many minutes. Follow the bottom-right cell back: the cells where the value changed from the row above tell you which problems were taken.",
      ] },
    { kind: "code", id: "code", title: "Greedy, then the exact table",
      paras: [
        "The plan: a greedy function that sorts by ratio, and a table function that is exact. Both run on the same three problems so the difference is visible.",
      ],
      pseudocode: "greedy: sort by points/minutes descending; take each problem that still fits\nexact: best[t] = points achievable in t minutes; for each problem, go through t downwards and take the better of skip and take",
      code,
      walkthrough: [
        "greedy_by_ratio takes problems in ratio order and skips any that no longer fits. It is fast, but it never looks back at a choice it made earlier.",
        "best_plan goes through the time budgets from high to low. Going downwards means each problem is used at most once, which is the 0/1 rule: taking a problem uses the value computed before it, not a value already including it.",
        "The last three prints check edge cases: two identical problems where only one fits, and a single problem that is too long for the budget.",
      ] },
    { kind: "complexity", id: "complexity", title: "The cost of each plan",
      rows: [
        { what: "greedy by ratio", time: "O(n log n)", space: "O(n)", why: "sorting dominates; a single pass then takes or skips each problem." },
        { what: "exact knapsack table", time: "O(n · T)", space: "O(T)", why: "for each of n problems, update every time budget up to T. The space is one row, reused." },
      ],
      paras: [
        "With n = 6 problems and T = 180 minutes, the table takes about 1,000 updates, which is trivial. The greedy rule is cheaper, but for a contest the exact plan is affordable, and it is the safer choice when you are unsure.",
      ] },
    { kind: "edge", id: "edge", title: "Cases that change the plan",
      items: [
        { case: "A problem longer than the whole contest", handle: "It can never be taken. The table handles this naturally, because the loop never reaches it." },
        { case: "Two problems with equal ratio", handle: "Either order gives the same greedy total, but the exact table may prefer the one that fits better with the rest." },
        { case: "Time left over at the end", handle: "A plan that leaves slack is not wrong, but compare it with the table: unused minutes are often a sign that a larger problem was skipped." },
        { case: "Problems that depend on each other", handle: "The knapsack model assumes independent problems. If you must solve A before B, the choice is a chain, not a set, and the model needs changing." },
      ] },
    { kind: "mistakes", id: "mistakes", title: "Common mistakes in contest planning",
      items: [
        { mistake: "Starting to code the first problem before reading all of them.", fix: "Spend the first few minutes reading every statement. The best plan depends on what you see, and reading is cheap compared with a wasted hour." },
        { mistake: "Treating points per minute as the whole rule.", fix: "It is a heuristic. Check the table for the final decision when the numbers are close." },
        { mistake: "Spending the whole budget on one problem you are stuck on.", fix: "Set a time limit per problem. Leave a stuck problem and return if time allows; a partial solution earns nothing, but the next problem may earn full points." },
        { mistake: "Ignoring wrong-submission penalties.", fix: "Add the expected penalty to the time cost. A problem with many attempts is more expensive than its statement suggests." },
      ] },
    { kind: "recognize", id: "recognize", title: "Recognising a contest-planning problem",
      signals: [
        "A fixed budget (time, money or capacity) is shared by several tasks, each with a cost and a value.",
        "Each task can be done or skipped, and doing it once is enough.",
        "The question asks for the best total value that fits the budget.",
      ],
      notThis: [
        "If the tasks depend on each other in a fixed order, the set model is wrong; plan a sequence instead.",
        "If tasks can be split into parts that earn partial value, the problem is fractional knapsack, where taking by ratio is exactly optimal.",
      ],
      paras: [
        "Whenever a budget and a list of costed options appear together, the knapsack table is the reliable tool, and greedy is a fast first guess.",
      ] },
    { kind: "worked", id: "worked", title: "Worked problem: a practice session",
      problem: "A coach has 30 minutes for a practice session and three drills: (15 minutes, 50 points), (10 minutes, 30 points), (20 minutes, 55 points). Choose the drills that maximise the points within 30 minutes.",
      approach: [
        "Ratios are 3.33, 3 and 2.75 points per minute. Greedy takes the first two drills: 25 minutes, 80 points.",
        "The table checks the alternatives. The 20-minute drill with the 10-minute drill uses 30 minutes for 85 points, which is better.",
        "The exact answer is 85 points. Greedy missed it because the first choice used half the session and blocked a better pair.",
      ],
      code: String.raw`def best(drills, minutes):
    dp = [0] * (minutes + 1)
    for m, p in drills:
        for t in range(minutes, m - 1, -1):
            dp[t] = max(dp[t], dp[t - m] + p)
    return dp[minutes]

print(best([(15, 50), (10, 30), (20, 55)], 30))   # 85`,
      takeaway: "The best set is found by the table, not by ratio alone. When the budget is tight, the large item is often the problem." },
  ],
  cheatSheet: [
    { label: "Model", value: "0/1 knapsack: each problem is taken whole or skipped, with a time budget" },
    { label: "Greedy", value: "sort by points per minute; fast, but not always optimal" },
    { label: "Exact", value: "dp[t] = best points in t minutes; go t downwards; O(n · T)" },
    { label: "Practice", value: "read everything first; time-box each problem; add expected penalties to the costs" },
  ],
  summary: [
    "A contest is a knapsack problem: a fixed time budget and problems that are taken whole or skipped.",
    "Ranking by points per minute is a fast heuristic, but it can leave time unused and lose points.",
    "The exact knapsack table finds the best set for a given budget, in time proportional to problems times minutes.",
    "Good planning reads all problems first, time-boxes each one, and accounts for penalties.",
  ],
  checks: [
    { kind: "concept", q: "What does a points-per-minute greedy rule do well, and where can it fail?", options: ["It always gives the exact answer", "It is fast and often close, but a large valuable problem can be blocked", "It cannot handle more than two problems", "It needs a dynamic table"], answer: 1, why: "Greedy is a quick heuristic. It can fail when a large, valuable combination is available but the ratio order picks smaller problems first." },
    { kind: "trace", q: "With the problems (10,60), (20,100), (30,120) and 50 minutes, what is the best total?", options: ["160", "180", "220", "280"], answer: 2, why: "Taking the 20-minute and 30-minute problems uses exactly 50 minutes for 100 + 120 = 220 points." },
    { kind: "trace", q: "Greedy by ratio on the same problems and 50 minutes earns how many points?", options: ["120", "160", "180", "220"], answer: 1, why: "It takes 10 minutes (60 points) and 20 minutes (100 points), for 160 points. The 30-minute problem no longer fits." },
    { kind: "complexity", q: "What is the time cost of the exact knapsack table for n problems and T minutes?", options: ["O(n + T)", "O(n · T)", "O(2^n)", "O(T log T)"], answer: 1, why: "For each of the n problems the table updates up to T time budgets, giving n · T updates." },
    { kind: "recognize", q: "Which situation does NOT fit the knapsack model of a contest?", options: ["Several problems, each taken whole or skipped, with a time budget", "Problem B can only be attempted after A is solved", "A fixed number of drills, each with a time cost and a value", "Choosing items for a bag with a weight limit"], answer: 1, why: "When one task must come before another, the choice is a sequence, not a set. The knapsack model assumes independent items." },
    { kind: "concept", q: "In a 3-hour contest, why is it wise to read every problem statement early?", options: ["To spot the easy problems and plan the order before spending time on any one", "Reading is scored", "Problems change after you read them", "It is not wise; start coding at once"], answer: 0, why: "A quick scan of every statement reveals the easy problems and the risky ones, so the time goes where it earns the most." },
    { kind: "concept", q: "Why set a time limit before you give up on a problem you are stuck on?", options: ["A stuck problem can absorb the whole contest while easier problems stay unsolved", "Judges require it", "Points drop the moment you pause", "Submissions close after one hour"], answer: 0, why: "Switching early keeps the easy points within reach." },
    { kind: "concept", q: "When is a brute-force solution a good first submission?", options: ["When the limits are small enough for it to run in time", "Never; brute force is always rejected", "Only for graph problems", "Only when the output is a string"], answer: 0, why: "A correct brute force that fits the limits is a safe score, and a reference for checking a faster idea." },
    { kind: "concept", q: "Why check your solution on the sample input before submitting?", options: ["It catches misread formats and simple logic errors cheaply", "The samples are the real judge tests", "It speeds up the judge", "It is not needed"], answer: 0, why: "Samples are the cheapest test for misreading the input format or the output rule." },
    { kind: "concept", q: "Two solutions disagree on a random test. What is the best next step?", options: ["Write a brute force and compare the two on small random inputs to find a failing case", "Submit both and see which is accepted", "Ignore the disagreement", "Change the output format"], answer: 0, why: "A small brute force gives a trusted answer to compare against, and small inputs make the failing case easy to read." },
    { kind: "concept", q: "Why are edge cases like n = 1 or all values equal worth checking?", options: ["They often break assumptions such as non-empty input or distinct values", "They are always the slowest case", "Judges never test them", "They change the time limit"], answer: 0, why: "Many wrong answers come from an assumption that fails only at the smallest or most uniform input." },
    { kind: "concept", q: "What does checking complexity against the limit tell you?", options: ["Roughly whether the operation count fits in the time, about 10^8 simple steps per second", "The exact runtime in milliseconds", "The memory limit", "The number of test cases"], answer: 0, why: "It is an estimate: the count of operations matters more than the exact time." },
    { kind: "concept", q: "Why keep a record of your mistakes after a contest?", options: ["It turns each mistake into a pattern you can avoid next time", "The platform requires it", "It raises your rating directly", "It lowers the time limit"], answer: 0, why: "Repeated mistakes usually share a cause, and naming the cause is what prevents them." },
    { kind: "concept", q: "A greedy rule looks right during a contest. What should you check before trusting it?", options: ["That no small counterexample breaks it, by comparing with a brute force on small inputs", "That it is always correct", "That the input is sorted", "That the output has one line"], answer: 0, why: "Greedy rules often fail on a small case, and a brute-force comparison is the fastest way to find it." },
    { kind: "concept", q: "Why write a short plan on paper before you code?", options: ["It stops you wasting time coding an approach you could have checked on paper first", "Plans are scored by the judge", "Coding during a contest is forbidden", "A plan replaces testing"], answer: 0, why: "Checking an idea on paper costs seconds; coding the wrong idea costs minutes." },
  ],
  nextNote: "Once the planning model is clear, the next step is to practise it on real contests, and to review afterwards. The upsolving lesson explains how to turn those contests into lasting skill.",
};
