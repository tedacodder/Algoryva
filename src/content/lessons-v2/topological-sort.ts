import type { LessonV2 } from "../lesson-types";

const EDGES = "[(0, 2), (1, 2), (1, 3), (2, 4), (3, 4), (4, 5)]";
const naive = String.raw`from itertools import permutations

def first_valid_order(n, edges):
    for order in permutations(range(n)):
        pos = {v: i for i, v in enumerate(order)}
        if all(pos[a] < pos[b] for a, b in edges):
            return list(order)
    return []

print(first_valid_order(4, [(0, 1), (0, 2), (1, 3), (2, 3)]))   # [0, 1, 2, 3]
print(first_valid_order(3, [(0, 1), (1, 2), (2, 0)]))   # []`;
const kahnCode = String.raw`from collections import deque

def topo_order(n, edges):
    g = [[] for _ in range(n)]
    indeg = [0] * n
    for a, b in edges:
        g[a].append(b)
        indeg[b] += 1
    q = deque(i for i in range(n) if indeg[i] == 0)
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in g[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return order if len(order) == n else []

print(topo_order(6, ${EDGES}))   # [0, 1, 2, 3, 4, 5]
print(topo_order(4, [(0, 1), (1, 2), (2, 3), (3, 1)]))   # []
print(topo_order(3, []))   # [0, 1, 2]`;
const dfsCode = String.raw`def topo_dfs(n, edges):
    g = [[] for _ in range(n)]
    for a, b in edges:
        g[a].append(b)
    state = [0] * n          # 0 = new, 1 = on the current path, 2 = finished
    order = []
    ok = True

    def go(u):
        nonlocal ok
        state[u] = 1
        for v in g[u]:
            if state[v] == 1:
                ok = False
            elif state[v] == 0:
                go(v)
        state[u] = 2
        order.append(u)

    for s in range(n):
        if state[s] == 0:
            go(s)
    return order[::-1] if ok else []

def is_valid(order, edges):
    pos = {v: i for i, v in enumerate(order)}
    return len(order) > 0 and all(pos[a] < pos[b] for a, b in edges)

edges = ${EDGES}
result = topo_dfs(6, edges)
print(result)   # [1, 3, 0, 2, 4, 5]
print(is_valid(result, edges))   # True
print(is_valid([0, 1, 2, 3, 4, 5], edges))   # True
print(topo_dfs(3, [(0, 1), (1, 2), (2, 0)]))   # []`;
const canFinish = String.raw`from collections import deque

def can_finish(n, prerequisites):
    g = [[] for _ in range(n)]
    indeg = [0] * n
    for course, need in prerequisites:
        g[need].append(course)
        indeg[course] += 1
    q = deque(i for i in range(n) if indeg[i] == 0)
    done = 0
    while q:
        u = q.popleft()
        done += 1
        for v in g[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return done == n

print(can_finish(2, [[1, 0]]))   # True
print(can_finish(2, [[1, 0], [0, 1]]))   # False
print(can_finish(4, [[1, 0], [2, 1], [3, 2]]))   # True`;
const minTime = String.raw`from collections import deque

def minimum_time(n, relations, time):
    g = [[] for _ in range(n + 1)]
    indeg = [0] * (n + 1)
    for a, b in relations:
        g[a].append(b)
        indeg[b] += 1
    finish = [0] * (n + 1)
    q = deque()
    for i in range(1, n + 1):
        if indeg[i] == 0:
            finish[i] = time[i - 1]
            q.append(i)
    while q:
        u = q.popleft()
        for v in g[u]:
            finish[v] = max(finish[v], finish[u] + time[v - 1])
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return max(finish)

print(minimum_time(3, [[1, 3], [2, 3]], [3, 2, 5]))   # 8
print(minimum_time(5, [[1, 5], [2, 5], [3, 5], [3, 4], [4, 5]], [1, 2, 3, 4, 5]))   # 12`;

export const topologicalSort: LessonV2 = {
  topic: "topological-sort", depth: "complete", minutes: 40,
  hook: "Put tasks in an order where every task comes after the ones it depends on, and discover at the same time whether such an order is even possible.",
  objectives: [
    "Describe a dependency problem as a directed graph and recognise a DAG (directed acyclic graph).",
    "Explain why a valid ordering exists exactly when there is no cycle.",
    "Compute a topological order with Kahn's algorithm (in-degrees and a queue) and with DFS (reverse finishing order).",
    "Detect cycles with either method, and explain what the leftover nodes mean.",
    "Extend the idea to longest-path problems on a DAG (earliest finish times).",
  ],
  prereqNote: "BFS (queue) and DFS (recursion and visited states). Graphs, for directed edges and in-degree.",
  sections: [
    { kind: "intuition", id: "getting-dressed", title: "Getting dressed",
      paras: ["Socks before shoes. Shirt before jacket. Underwear before trousers. Some pairs have no constraint (socks and shirt), so several orders work: any order that respects *every* “before” rule is fine.",
        "A topological sort finds such an order. If the rules contradict each other (“shoes before socks, socks before shoes”) no order exists, and a good algorithm tells you that instead of looping forever."] },
    { kind: "concept", id: "concept", title: "Dependencies as a directed graph",
      paras: ["Make each task a node, and draw an arrow **A → B** when A must come before B. A **topological order** lists all nodes so that every arrow points forward."],
      bullets: ["The graph must be **directed** (arrows have a direction) and have **no cycle**. A graph like that is a **DAG**.", "If there is a cycle (A needs B, B needs C, C needs A), nothing in it can go first, so **no valid order exists**.", "A valid order is usually **not unique**: independent tasks can be swapped.", "**In-degree** of a node = how many arrows point at it = how many prerequisites it still waits for. A node with in-degree 0 can go right now.", "Typical stories: course prerequisites, build systems (compile A before B), spreadsheet cells depending on other cells, task scheduling."] },
    { kind: "naive", id: "naive", title: "Try every ordering",
      paras: ["The most direct approach: generate all orderings of the nodes and return the first in which every arrow points forward.",
        "It is correct and fine for four nodes, but n nodes have n! orderings: 10 nodes means 3.6 million, 20 nodes means more than 10¹⁸. The search also never explains *why* a cycle makes it impossible."],
      code: naive,
      cost: "O(n! × E): unusable beyond about 10 nodes." },
    { kind: "observation", id: "observation", title: "Some node must always be free to go first",
      paras: ["In any DAG there is at least one node with in-degree 0: if every node had a prerequisite, you could keep stepping backwards along arrows forever and, with finitely many nodes, you would revisit one, which is a cycle.",
        "So: take a free node, put it first, and *remove it* (its arrows no longer constrain anyone). Some other node may now be free. Repeat. If you get stuck with nodes left but none free, those nodes form or depend on a cycle."] },
    { kind: "viz", id: "viz-kahn", title: "Kahn's algorithm", viz: "topo-order",
      paras: ["The number under each node is its in-degree (unfinished prerequisites). The queue holds nodes ready to go. Each time a node is taken, its arrows are removed and the in-degrees of its successors drop; any that reach 0 join the queue. Notice A and B start ready, but C has to wait for both."] },
    { kind: "viz", id: "viz-cycle", title: "What a cycle does", viz: "topo-cycle",
      paras: ["Here B → C → D → B is a cycle. Only A is free. Taking A lowers B's in-degree from 2 to 1, which is not 0, so B never becomes ready. The queue empties with three nodes left over. That shortfall is exactly how Kahn's algorithm detects a cycle."] },
    { kind: "example", id: "example", title: "Kahn's algorithm traced by hand",
      paras: ["Six tasks with arrows A→C, B→C, B→D, C→E, D→E, E→F. In-degrees: A 0, B 0, C 2, D 1, E 2, F 1."],
      table: { head: ["take", "arrows removed", "in-degrees that reach 0", "queue after"], rows: [["A", "A→C: in(C) 2→1", "none", "B"], ["B", "B→C: in(C) 1→0 · B→D: in(D) 1→0", "C, D", "C, D"], ["C", "C→E: in(E) 2→1", "none", "D"], ["D", "D→E: in(E) 1→0", "E", "E"], ["E", "E→F: in(F) 1→0", "F", "F"], ["F", "none", "none", "empty"]] },
      steps: [{ title: "The order", body: "A, B, C, D, E, F. Every arrow points forward. Taking B before A would also have been valid: orders are not unique." }, { title: "The count check", body: "All 6 nodes were taken, so there is no cycle. If fewer than 6 had been taken, the rest would depend on a cycle." }] },
    { kind: "code", id: "code-kahn", title: "Kahn's algorithm in code",
      paras: ["The algorithm is BFS where “neighbour is ready” means “its in-degree has just reached zero”."],
      pseudocode: "compute in-degree of every node\nqueue = all nodes with in-degree 0\nwhile queue is not empty:\n    take u, append it to the order\n    for each arrow u → v: in-degree of v decreases by 1; if it is now 0, add v to the queue\nif the order contains every node: success, else: there is a cycle",
      code: kahnCode,
      walkthrough: ["`indeg[b] += 1` counts incoming arrows while the graph is built; `g[a].append(b)` records the outgoing ones.", "Each node enters the queue **once**, exactly when its last prerequisite is taken, so the whole thing is O(V + E).", "`return order if len(order) == n else []` is the cycle check: fewer nodes than expected means some were never free.", "With no edges at all every node is free at the start, so the order is simply 0, 1, 2: a topological order is not unique, and ours depends on queue order."] },
    { kind: "code", id: "code-dfs", title: "The DFS way: reverse finishing order",
      paras: ["DFS finishes a node only after everything it points to is finished. So if you list nodes in the order they **finish** and then reverse that list, every node appears before everything it points to. To catch cycles, track three states: new, on the current path, finished. Meeting a node that is *on the current path* means we found a cycle."],
      code: dfsCode,
      walkthrough: ["`state[v] == 1` means `v` is an ancestor on the current recursion path: an arrow back to it closes a cycle.", "`order.append(u)` happens **after** the loop over successors: finishing order. The final `order[::-1]` reverses it.", "The result `[1, 3, 0, 2, 4, 5]` differs from Kahn's `[0, 1, 2, 3, 4, 5]` but `is_valid` confirms both respect every arrow. Any valid order is correct unless the problem asks for a specific one (for example the lexicographically smallest, which needs a heap instead of a queue in Kahn).", "As with every recursive DFS, very deep graphs may need an explicit stack in Python."] },
    { kind: "complexity", id: "complexity", title: "Costs",
      rows: [
        { what: "Kahn's algorithm", time: "O(V + E)", space: "O(V + E)", why: "Each node is queued once; each arrow is processed once when its tail is taken." },
        { what: "DFS-based sort", time: "O(V + E)", space: "O(V + E)", why: "Each node is entered once and each arrow examined once. The recursion depth can reach V." },
        { what: "Cycle detection", time: "O(V + E)", space: "O(V)", why: "A by-product of either method: nodes never freed (Kahn) or an arrow to a node on the current path (DFS)." },
        { what: "Trying all orderings (naive)", time: "O(n! × E)", space: "O(n)", why: "Checks every permutation." },
        { what: "Longest path / earliest finish on a DAG", time: "O(V + E)", space: "O(V)", why: "Process nodes in topological order, relaxing each outgoing arrow once." }],
      paras: ["Both methods read the graph once. The lesson to remember is the shape of the idea: *process a node only when everything it depends on is done*."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Cycle", handle: "Kahn finishes with fewer than n nodes; DFS sees a node on the current path. Decide what the problem wants then (often “impossible” or an empty list)." }, { case: "Self-loop (A → A)", handle: "A is its own prerequisite: a cycle of length one. Kahn never frees it; DFS sees A on its own path." }, { case: "Isolated nodes", handle: "In-degree 0 and no arrows. They appear in the order wherever the queue puts them." }, { case: "Duplicate arrows", handle: "A repeated arrow counts twice in the in-degree and is removed twice, so it is consistent. Be careful if you deduplicate in only one place." }, { case: "Several valid orders", handle: "Any is acceptable unless a tie-break is stated. For “smallest first” use a min-heap instead of a queue." }, { case: "Disconnected graph", handle: "Kahn handles it automatically. In DFS, start a new search from every unvisited node." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Reversing the arrow direction when building the graph.", fix: "For a prerequisite pair `[course, needs]` the arrow goes from `needs` to `course` (what must come first points at what follows)." }, { mistake: "Not checking whether all nodes were processed.", fix: "Compare `len(order)` with n. A shorter order means a cycle." }, { mistake: "Forgetting to reverse the DFS finishing order.", fix: "Finishing order lists dependencies last, so reverse it." }, { mistake: "Using a two-state visited flag in DFS for cycle detection.", fix: "A node already finished is fine to meet again; only a node on the current path signals a cycle. Use three states." }, { mistake: "Starting only from node 0.", fix: "Start from every node with in-degree 0 (Kahn) or every unvisited node (DFS)." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a topological-sort problem",
      signals: ["“**Prerequisites**”, “must be done before”, “depends on”, “build order”: arrows between tasks.", "“Can all tasks be completed?” or “return any valid order, or an empty list”: ordering plus cycle detection.", "A **directed graph with no cycles** where each node's value depends on its predecessors: process in topological order (earliest finish times, number of paths, longest chain).", "“All ancestors / all descendants of each node in a DAG.”", "Repeatedly **peeling off nodes with degree 1 or 0**: the same idea as Kahn's algorithm (for example finding the centre of a tree)."],
      notThis: ["The graph is undirected: there is no “before”. Use BFS, DFS or Union-Find.", "You need shortest paths with weights on a general graph: Dijkstra or Bellman–Ford (the DAG special case is solvable with a topological order)."] },
    { kind: "worked", id: "worked-courses", title: "Can you finish all courses?",
      problem: "There are `n` courses numbered 0 to n − 1 and a list of pairs `[course, need]`, meaning you must take `need` before `course`. Return True if all courses can be finished.",
      approach: ["Build a directed graph with an arrow `need → course` and count each course's in-degree.", "Run Kahn's algorithm and count how many courses were taken.", "All can be finished exactly when every course was taken (no cycle)."],
      code: canFinish,
      takeaway: "Course Schedule is topological sort with the answer being the *count check* alone. No order needs to be stored, just `done == n`. The second example is a two-course cycle: each waits for the other." },
    { kind: "worked", id: "worked-parallel", title: "Minimum time with parallel courses",
      problem: "Courses 1 to n each take `time[i - 1]` months. A relation `[a, b]` means course a must finish before course b can start. You can take any number of courses at once if their prerequisites are done. Find the minimum total time.",
      approach: ["A course can start only when *all* its prerequisites have finished, so its finish time is its own duration plus the **latest** finish among its prerequisites.", "That is a longest-path computation on a DAG, done by processing courses in topological order.", "Courses with no prerequisites finish at their own duration. When a course is taken from the queue, update each successor: `finish[v] = max(finish[v], finish[u] + time[v])`.", "The answer is the largest finish time overall."],
      code: minTime,
      takeaway: "Topological order gives a safe processing order for dynamic programming on a DAG: every predecessor is finished before a node is handled. “Longest path” sounds hard in general graphs but is linear on a DAG." },
  ],
  cheatSheet: [{ label: "Arrow", value: "A → B means A before B; build g[A].append(B), indeg[B] += 1" }, { label: "Kahn", value: "queue of in-degree 0; take u; decrement successors; enqueue new zeros" }, { label: "Cycle check", value: "len(order) < n ⇒ cycle" }, { label: "DFS version", value: "append u after its successors; reverse the list; 3 states for cycles" }, { label: "Cost", value: "O(V + E)" }, { label: "DAG DP", value: "process in topological order: finish[v] = max(finish[v], finish[u] + t[v])" }],
  summary: ["A topological order puts every task after its prerequisites; it exists exactly when the dependency graph has no cycle.", "Kahn's algorithm repeatedly takes nodes with in-degree 0 and removes their arrows; leftover nodes mean a cycle.", "The DFS version lists nodes by finishing time and reverses; a node on the current path signals a cycle.", "Both run in O(V + E), and valid orders are usually not unique.", "Processing a DAG in topological order solves longest-path and earliest-finish problems in linear time."],
  checks: [
    { kind: "concept", q: "When does a valid topological order exist?", options: ["Whenever the graph is connected", "Exactly when the directed graph has no cycle", "Whenever every node has at least one arrow", "Only for trees"], answer: 1, why: "A cycle makes every node in it wait for another node in it, so none can go first. Without cycles, a free node always exists." },
    { kind: "trace", q: "In the lesson's six-node example, what is the in-degree of C (arrows A→C and B→C)?", options: ["0", "1", "2", "3"], answer: 2, why: "Two arrows point at C, so it waits for two prerequisites." },
    { kind: "concept", q: "After Kahn's algorithm finishes, only 4 of 7 nodes are in the order. What does that mean?", options: ["The graph is disconnected", "The remaining 3 nodes depend on a cycle, so no valid order exists", "The algorithm has a bug", "The order is unique"], answer: 1, why: "Nodes in or behind a cycle never reach in-degree 0, so they are never taken." },
    { kind: "complexity", q: "What is the time complexity of Kahn's algorithm on V nodes and E arrows?", options: ["O(V)", "O(E)", "O(V + E)", "O(V!)"], answer: 2, why: "Every node is enqueued once and every arrow is processed once." },
    { kind: "recognize", q: "“Given prerequisites, output an order in which to take all courses, or report it is impossible” is:", options: ["A shortest-path problem", "A topological sort with cycle detection", "A binary search", "A sliding window"], answer: 1, why: "Ordering under before-constraints is topological sort, and impossibility corresponds to a cycle." },
    { kind: "concept", q: "In the DFS method, why do we need three states instead of just visited/not visited?", options: ["For speed", "Meeting a finished node is harmless, but meeting a node on the current path means a cycle", "To count nodes", "Python requires it"], answer: 1, why: "A visited-only flag cannot tell a harmless revisit from an arrow back to an ancestor on the current path." },
    { kind: "trace", q: "Kahn's algorithm on edges 1->2, 1->3, 2->4, 3->4, always taking the smallest ready node. What is the order?", options: ["[1, 2, 3, 4]", "[1, 3, 2, 4]", "[1, 2, 4, 3]", "[4, 1, 2, 3]"], answer: 0, why: "After 1, both 2 and 3 are ready; taking 2 first gives the smallest order." },
    { kind: "trace", q: "Kahn's algorithm on the cycle 1->2, 2->1. Does it process all nodes? Print len(order) == n.", options: ["False", "True", "It raises an error", "2"], answer: 0, why: "Neither node ever reaches in-degree zero, so no order exists." },
    { kind: "concept", q: "What must a topological order satisfy?", options: ["Every edge goes from an earlier node to a later node", "Edges are sorted by weight", "Nodes are sorted by degree", "The graph is undirected"], answer: 0, why: "Each prerequisite comes before the thing that depends on it." },
    { kind: "complexity", q: "Running time of Kahn's algorithm on n nodes and m edges?", options: ["O(n + m)", "O(n\u00b2)", "O(n log n)", "O(m\u00b2)"], answer: 0, why: "Each node is removed once and each edge is decremented once." },
    { kind: "trace", q: "Two courses: course 1 needs course 0 first. The edge is 0 -> 1. What order does Kahn's algorithm produce?", options: ["[0, 1]", "[1, 0]", "[0]", "[0, 0, 1]"], answer: 0, why: "Only course 0 has no prerequisite, so it comes first." },
    { kind: "concept", q: "Why does topological sort work only on directed acyclic graphs?", options: ["A cycle makes a valid ordering impossible", "DAGs are faster to sort", "Undirected graphs have no nodes", "It works on every graph"], answer: 0, why: "In a cycle, each node must come before the others, which is contradictory." },
    { kind: "trace", q: "Edges 1->2, 1->3, 2->3. After removing node 1 and its outgoing edges, what is the in-degree of node 3?", options: ["1", "2", "0", "3"], answer: 0, why: "Node 3 started with two incoming edges; the one from 1 is removed." },
    { kind: "concept", q: "In Kahn's algorithm, when does a node become ready to output?", options: ["When its in-degree drops to 0", "When its degree is 1", "When it has the highest label", "When it appears first in the input"], answer: 0, why: "All its prerequisites have already been output." },
    { kind: "trace", q: "DFS-based topological sort on 1->2 and 2->3: output the reverse of the finishing order. What is the result?", options: ["[1, 2, 3]", "[3, 2, 1]", "[2, 1, 3]", "[1, 3, 2]"], answer: 0, why: "The last node to finish is the first to appear in the order." },
  ],
  nextNote: "Next, **Sorting II** shows the fast sorts you will meet in many techniques: merge sort, quicksort, counting and cyclic sort.",
};
