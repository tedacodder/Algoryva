import type { LessonV2 } from "../lesson-types";

const EDGES = "[(0, 1, 7), (0, 2, 9), (0, 5, 14), (1, 2, 10), (1, 3, 15), (2, 3, 11), (2, 5, 2), (3, 4, 6), (4, 5, 9)]";
const naive = String.raw`from itertools import combinations

def connected(n, chosen):
    parent = list(range(n))
    def find(x):
        while parent[x] != x:
            x = parent[x]
        return x
    for a, b, w in chosen:
        parent[find(a)] = find(b)
    return len({find(i) for i in range(n)}) == 1

def mst_bruteforce(n, edges):
    best = None
    for chosen in combinations(edges, n - 1):          # try every set of n - 1 edges
        if connected(n, chosen):
            cost = sum(w for a, b, w in chosen)
            if best is None or cost < best:
                best = cost
    return best

print(mst_bruteforce(4, [(0, 1, 1), (1, 2, 4), (2, 3, 2), (0, 2, 3), (0, 3, 10)]))   # 6
print(mst_bruteforce(3, [(0, 1, 5)]))   # None`;
const kru = String.raw`def kruskal(n, edges):
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    total, used = 0, []
    for w, a, b in sorted((w, a, b) for a, b, w in edges):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
            total += w
            used.append((a, b, w))
    return total, used

edges = ${EDGES}
total, used = kruskal(6, edges)
print(total)   # 33
print(used)   # [(2, 5, 2), (3, 4, 6), (0, 1, 7), (0, 2, 9), (4, 5, 9)]
print(len(used) == 6 - 1)   # True
total2, used2 = kruskal(4, [(0, 1, 1), (2, 3, 1)])
print(len(used2) == 4 - 1)   # False`;
const pri = String.raw`import heapq

def prim(n, edges, start=0):
    g = [[] for _ in range(n)]
    for a, b, w in edges:
        g[a].append((b, w))
        g[b].append((a, w))
    seen = [False] * n
    pq = [(0, start)]
    total, count = 0, 0
    while pq:
        w, u = heapq.heappop(pq)
        if seen[u]:
            continue
        seen[u] = True
        total += w
        count += 1
        for v, wt in g[u]:
            if not seen[v]:
                heapq.heappush(pq, (wt, v))
    return total if count == n else -1

edges = ${EDGES}
print(prim(6, edges))   # 33
print(prim(6, edges, start=4))   # 33
print(prim(4, [(0, 1, 1), (2, 3, 1)]))   # -1
print(prim(1, []))   # 0`;
const pts = String.raw`def min_cost_connect(points):
    n = len(points)
    INF = float("inf")
    best = [INF] * n
    best[0] = 0
    used = [False] * n
    total = 0
    for _ in range(n):
        u = -1
        for i in range(n):
            if not used[i] and (u == -1 or best[i] < best[u]):
                u = i
        used[u] = True
        total += best[u]
        for v in range(n):
            if not used[v]:
                d = abs(points[u][0] - points[v][0]) + abs(points[u][1] - points[v][1])
                if d < best[v]:
                    best[v] = d
    return total

print(min_cost_connect([[0, 0], [2, 2], [3, 10], [5, 2], [7, 0]]))   # 20
print(min_cost_connect([[3, 12], [-2, 5], [-4, 1]]))   # 18
print(min_cost_connect([[0, 0]]))   # 0`;
const extra = String.raw`def extra_cables(n, cables):
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    components = n
    for a, b in cables:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
            components -= 1
    return len(cables) - (n - components)

print(extra_cables(4, [(0, 1), (1, 2), (2, 0), (2, 3)]))   # 1
print(extra_cables(6, [(0, 1), (1, 2), (3, 4)]))   # 0
print(extra_cables(3, [(0, 0), (0, 1), (0, 1)]))   # 2`;

export const mst: LessonV2 = {
  topic: "mst", depth: "complete", minutes: 45,
  hook: "Connect every node as cheaply as possible, with no wasted links: the cheapest way to wire a network.",
  objectives: [
    "Define a spanning tree and a minimum spanning tree (MST), and state how many edges a spanning tree has.",
    "Explain the cut property and why it makes greedy choices safe.",
    "Run Kruskal's algorithm (sort edges, skip those that close a cycle) with Union-Find.",
    "Run Prim's algorithm (grow one tree with a heap) and say when each is preferable.",
    "Handle disconnected graphs, ties, and “connect all points” problems on a plane.",
  ],
  prereqNote: "Union-Find is essential for Kruskal. Heap and Shortest Paths help with Prim, which looks very much like Dijkstra.",
  sections: [
    { kind: "intuition", id: "cables", title: "Wiring a village",
      paras: ["A village needs electricity. Poles can be linked by cable, and each possible link has a price. You want every house connected, as cheaply as possible. You would never buy a cable that connects two houses already joined through other cables: that link is wasted money.",
        "The cheapest wiring plan is a **minimum spanning tree**: it connects all the nodes, contains no cycle (a cycle means a removable, wasted link), and has the smallest total cost. Note the contrast with shortest paths: there you want the cheapest route between *two* places, here the cheapest way to connect *everything*."] },
    { kind: "concept", id: "concept", title: "Spanning trees and the cut property",
      paras: ["A **spanning tree** of a connected graph is a set of edges that connects all V nodes with no cycle."],
      bullets: ["Every spanning tree has exactly **V − 1 edges**. Fewer cannot connect everything; one more would create a cycle.", "A **minimum spanning tree (MST)** is a spanning tree with the smallest total weight. There may be several with the same total (ties). If all weights are distinct, the MST is unique.", "**Cut property:** split the nodes into any two groups. The **lightest edge crossing between the groups** belongs to some MST. This is why picking the cheapest safe edge is never a mistake.", "**Cycle property:** the heaviest edge on any cycle is never needed (there is always a cheaper way around), unless ties make it equally good.", "A graph that is not connected has no spanning tree; the best you can do is a **minimum spanning forest** (one tree per component).", "Weights may be negative: the algorithms are unchanged. For the *maximum* spanning tree, sort in the opposite order."] },
    { kind: "naive", id: "naive", title: "Try every set of V − 1 edges",
      paras: ["An MST uses exactly V − 1 edges, so one approach is to try every choice of V − 1 edges out of E, keep those that connect everything, and take the cheapest.",
        "It is correct, but the number of choices is the binomial C(E, V − 1). With 20 nodes and 40 edges that is already about 1.3 × 10¹¹ subsets (131 billion), and real graphs are far bigger."],
      code: naive,
      cost: "O(C(E, V − 1) × V): astronomically large; fine only for toy graphs." },
    { kind: "observation", id: "observation", title: "Keep taking the cheapest edge that does not waste money",
      paras: ["Imagine building the network edge by edge, always taking the lightest remaining edge. If the edge joins two nodes that are **already connected**, it only creates a cycle, so skip it. Otherwise it connects two separate groups, and by the cut property it is safe: the lightest edge leaving a group can always be part of an optimal tree.",
        "That is **Kruskal's algorithm**. **Prim's algorithm** applies the same cut property differently: grow a single tree from a start node, always adding the cheapest edge that leaves the tree, exactly like Dijkstra with a different priority."] },
    { kind: "viz", id: "viz-kruskal", title: "Kruskal's algorithm", viz: "kruskal",
      paras: ["Edges are considered lightest first. The label under each node is the leader of its group. A yellow edge is under consideration, a thick coloured edge is taken, and a dashed faded edge is skipped because its ends are already in the same group. The side list shows the groups merging until one group remains."] },
    { kind: "viz", id: "viz-prim", title: "Prim's algorithm: grow one tree from A", viz: "prim-grow",
      paras: ["Each node outside the tree shows its key: the cheapest edge that would connect it. Prim adds the node with the smallest key each step, so one tree grows instead of separate groups merging. On the same graph it reaches the same total weight as Kruskal."] },
    { kind: "example", id: "example", title: "Kruskal by hand",
      paras: ["The same graph, edges sorted by weight (ties broken alphabetically)."],
      table: { head: ["edge", "weight", "groups before", "decision"], rows: [["C–F", "2", "C and F are separate", "take: {C,F}"], ["D–E", "6", "separate", "take: {D,E}"], ["A–B", "7", "separate", "take: {A,B}"], ["A–C", "9", "{A,B} and {C,F}", "take: {A,B,C,F}"], ["E–F", "9", "{D,E} and {A,B,C,F}", "take: all six connected"], ["…", "10 to 15", "already one group", "skip every remaining edge"]] },
      steps: [{ title: "Five edges for six nodes", body: "V − 1 = 5 edges were taken, with total weight 2 + 6 + 7 + 9 + 9 = 33. We can stop as soon as the tree has V − 1 edges." }, { title: "Ties", body: "A–C and E–F both weigh 9. Taking them in the other order gives the same total. The set of edges may differ between runs, but the total weight cannot." }] },
    { kind: "code", id: "code-kruskal", title: "Kruskal with Union-Find",
      paras: ["Sort edges by weight, then use Union-Find to test whether an edge's endpoints are already connected."],
      pseudocode: "sort edges by weight\nfor each edge (a, b, w) in that order:\n    if find(a) != find(b):    # different groups\n        union them; add w to the total; keep the edge",
      code: kru,
      walkthrough: ["Sorting tuples `(w, a, b)` sorts by weight first, then by endpoints, giving a deterministic order.", "`find` uses path halving (`parent[x] = parent[parent[x]]`) so repeated finds stay fast; this is the Union-Find from its own lesson, written compactly.", "If the final `used` has fewer than V − 1 edges, the graph was **disconnected** (last line: 2 edges for 4 nodes).", "The cost is dominated by the sort, O(E log E), plus almost-constant Union-Find work per edge."] },
    { kind: "code", id: "code-prim", title: "Prim with a heap",
      paras: ["Start from any node. Keep a heap of edges leaving the tree built so far, each keyed by weight. Pop the cheapest; if it leads to a new node, add that node and push its edges."],
      code: pri,
      walkthrough: ["It is almost line for line Dijkstra, with one change: the heap key is the **edge weight** `wt`, not the total distance `d + w`.", "`seen[u]` makes stale heap entries harmless: a node popped a second time is ignored.", "`count == n` checks that every node was reached, returning -1 for a disconnected graph (the third call).", "Starting from a different node gives the same total (33), because the MST weight does not depend on the start."] },
    { kind: "complexity", id: "complexity", title: "Costs, and Kruskal versus Prim",
      rows: [
        { what: "Kruskal", time: "O(E log E)", space: "O(V + E)", why: "Sorting the edges dominates; each Union-Find operation is nearly constant." },
        { what: "Prim with a binary heap", time: "O(E log V)", space: "O(V + E)", why: "Each edge may be pushed once; each push or pop costs O(log E) = O(log V)." },
        { what: "Prim with an array (dense graphs)", time: "O(V²)", space: "O(V)", why: "Scan all nodes for the cheapest each round; best when E is close to V²." },
        { what: "Brute force over edge subsets", time: "O(C(E, V − 1) · V)", space: "O(V)", why: "Tries every choice of V − 1 edges." },
        { what: "MST edge count", time: "-", space: "-", why: "Always V − 1 for a connected graph on V nodes." }],
      paras: ["**Choose Kruskal** when edges are given as a list and the graph is sparse (it also fits naturally with Union-Find). **Choose Prim** (array version) when the graph is dense or implicit, such as connecting points on a plane where every pair is an edge."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Disconnected graph", handle: "No spanning tree exists. Detect it by counting: fewer than V − 1 edges taken (Kruskal) or fewer than V nodes reached (Prim)." }, { case: "Ties in weights", handle: "Several different MSTs may exist, all with the same total. Only the total is unique." }, { case: "Single node", handle: "The MST has no edges and total weight 0." }, { case: "Parallel edges and self-loops", handle: "Kruskal skips a self-loop automatically (same group) and uses the cheapest parallel edge naturally." }, { case: "Negative weights", handle: "No problem for MST algorithms, unlike Dijkstra." }, { case: "Maximum spanning tree", handle: "Sort edges in descending order (or negate weights)." }, { case: "Huge point sets", handle: "Generating all pairs is O(n²) edges; use Prim's O(n²) array version instead of sorting n² edges." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Confusing the MST with shortest paths.", fix: "The MST minimises the total weight of a connecting tree. The path between two nodes inside it is **not** necessarily their shortest path." }, { mistake: "Forgetting the cycle check in Kruskal.", fix: "Take an edge only if `find(a) != find(b)`." }, { mistake: "Not checking for a disconnected graph.", fix: "Verify V − 1 edges were used, and print -1 (or whatever the statement says) otherwise." }, { mistake: "Using Dijkstra's distance `d + w` as the Prim key.", fix: "Prim's key is the single edge weight `w`." }, { mistake: "Sorting edges as `(a, b, w)` instead of `(w, a, b)`.", fix: "Put the weight first, or use `key=lambda e: e[2]`." }, { mistake: "Assuming the MST is unique.", fix: "It is unique only when all edge weights are distinct." }] },
    { kind: "recognize", id: "recognize", title: "How to spot an MST problem",
      signals: ["“**Connect all** nodes (cities, computers, islands) with the **minimum total cost**”, with no cycle needed.", "“**Fewest/cheapest cables, roads or pipes** so that everything is reachable from everything else.”", "Points on a plane to be joined cheaply by segments: a **complete graph** with distance weights.", "“Remove as many edges as possible while keeping connectivity” or “how many edges are redundant”: the answer is E − (V − components).", "**Clustering** by cutting the heaviest edges of an MST, or “minimise the largest edge needed to connect everything” (the MST also minimises that bottleneck)."],
      notThis: ["You need the cheapest route from one node to another: shortest paths.", "Edges are directed and you need a rooted arborescence: that is a different, harder problem (Chu–Liu/Edmonds).", "The graph must be traversed (a tour visiting all nodes and returning): that is the travelling salesman problem."] },
    { kind: "worked", id: "worked-points", title: "Connect all the points cheaply",
      problem: "Given `n` points on a plane, the cost to connect two points is their Manhattan distance |x₁ − x₂| + |y₁ − y₂|. Find the minimum total cost to connect all the points so that every point is reachable from every other.",
      approach: ["Every pair of points is a possible edge, so the graph is **complete**: about n² / 2 edges. Sorting all of them would work but wastes time.", "Use Prim's algorithm with an **array** instead of a heap: keep for each point the cheapest known cost to attach it to the tree.", "Each round attach the unused point with the smallest cost, then update the others' costs using the new point."],
      code: pts,
      takeaway: "On a complete graph, Prim in O(n²) beats sorting all edges. The edges are never stored: distances are computed when needed (an *implicit graph*). The 20 in the first example is the known answer for those five points." },
    { kind: "worked", id: "worked-extra", title: "How many cables are redundant?",
      problem: "There are `n` computers and a list of cables (pairs). Some cables are redundant: removing them leaves exactly the same groups of connected computers. What is the largest number of cables you can remove?",
      approach: ["A minimal wiring that keeps each group connected needs a spanning tree per group: `n − components` cables in total.", "So the answer is `len(cables) − (n − components)`.", "Count components with Union-Find: start at `n` and subtract 1 whenever a cable merges two groups."],
      code: extra,
      takeaway: "Counting what you *can* keep (a spanning forest) tells you what you can discard. Self-loops and repeated cables are always redundant, and the formula already counts them." },
  ],
  cheatSheet: [{ label: "Spanning tree", value: "connects V nodes with V − 1 edges, no cycle" }, { label: "Kruskal", value: "sort edges; take if find(a) != find(b); stop at V − 1 edges" }, { label: "Prim", value: "grow from a node; heap of (edge weight, node); skip seen" }, { label: "Cut property", value: "the lightest edge across any cut is in some MST" }, { label: "Cost", value: "Kruskal O(E log E) · Prim O(E log V) or O(V²) dense" }, { label: "Redundant edges", value: "E − (V − components)" }],
  summary: ["A minimum spanning tree connects all nodes with V − 1 edges and the smallest possible total weight.", "The cut property says the lightest edge across any split of the nodes is safe, which justifies greedy choices.", "Kruskal sorts edges and uses Union-Find to skip cycle-forming ones; Prim grows one tree with a heap, like Dijkstra with a different key.", "A disconnected graph has no spanning tree: check that V − 1 edges were used.", "MSTs answer “connect everything cheaply”, not “cheapest route between two nodes”."],
  checks: [
    { kind: "concept", q: "How many edges does a spanning tree of a connected graph with 10 nodes have?", options: ["8", "9", "10", "It depends on the weights"], answer: 1, why: "A spanning tree on V nodes always has V − 1 edges: 9 here." },
    { kind: "concept", q: "In Kruskal's algorithm, when is an edge skipped?", options: ["When it is the heaviest edge", "When its endpoints are already in the same connected group", "When its weight is negative", "When it is the first edge"], answer: 1, why: "An edge between two nodes that are already connected would only create a cycle, which wastes weight." },
    { kind: "trace", q: "In the lesson's graph the MST total weight is 33. How many edges does it contain?", options: ["4", "5", "6", "9"], answer: 1, why: "The graph has 6 nodes, so a spanning tree has 6 − 1 = 5 edges (2 + 6 + 7 + 9 + 9 = 33)." },
    { kind: "complexity", q: "What dominates the running time of Kruskal's algorithm?", options: ["The Union-Find operations", "Sorting the edges, O(E log E)", "Building the adjacency list", "Printing"], answer: 1, why: "Union-Find work is nearly constant per edge, so the sort of the E edges dominates." },
    { kind: "recognize", q: "“Connect n cities with roads at minimum total cost so every city can reach every other” is:", options: ["A shortest-path problem", "A minimum spanning tree problem", "A topological sort", "A binary search"], answer: 1, why: "Connecting everything cheaply with no wasted links is exactly an MST." },
    { kind: "concept", q: "Is the path between two nodes inside the MST always their shortest path in the original graph?", options: ["Yes, always", "No: the MST minimises total weight, not individual path lengths", "Only for unweighted graphs", "Only with distinct weights"], answer: 1, why: "A different, non-tree edge may give a shorter route between two particular nodes even though it is not part of the cheapest overall network." },
    { kind: "trace", q: "Kruskal on the edges (1,2,1), (2,3,2), (1,3,3), (3,4,4), sorted by weight with union-find. What is the total weight of the minimum spanning tree?", options: ["7", "6", "8", "10"], answer: 0, why: "Edges 1, 2 and 4 connect all four nodes without a cycle: 1 + 2 + 4 = 7." },
    { kind: "trace", q: "Kruskal on the same four edges. How many edges does the minimum spanning tree use?", options: ["3", "2", "4", "6"], answer: 0, why: "A spanning tree on 4 nodes always has 3 edges." },
    { kind: "trace", q: "A triangle with edges (1,2,1), (2,3,1), (1,3,5). What is the total weight of its minimum spanning tree?", options: ["2", "5", "6", "7"], answer: 0, why: "Taking the two weight-1 edges spans the triangle; the weight-5 edge would form a cycle." },
    { kind: "concept", q: "Why is Kruskal's choice always safe to add?", options: ["The cheapest edge crossing any cut between two groups belongs to some minimum spanning tree (the cut property)", "Every cut has the same weight", "Edges are removed from the graph", "The MST is always unique"], answer: 0, why: "Any cut's lightest crossing edge can be swapped into an optimal tree without raising its weight." },
    { kind: "complexity", q: "Kruskal's algorithm on m edges, sorting first: what is the running time?", options: ["O(m log m)", "O(n\u00b3)", "O(m\u00b2)", "O(n + m)"], answer: 0, why: "Sorting the edges dominates the union-find work." },
    { kind: "concept", q: "Which structure does Kruskal use to detect cycles?", options: ["Union-find (disjoint sets)", "A stack", "A trie", "A segment tree"], answer: 0, why: "Two nodes already in one set would close a cycle." },
    { kind: "concept", q: "How many edges does a minimum spanning tree on 5 nodes have?", options: ["4", "5", "6", "3"], answer: 0, why: "A spanning tree on n nodes always has n - 1 edges." },
    { kind: "concept", q: "When can a graph have more than one minimum spanning tree?", options: ["When two edges that can be chosen have the same weight", "Never", "Only when the graph is a tree", "Only when there are no cycles"], answer: 0, why: "Ties let different trees have the same minimum total weight." },
    { kind: "concept", q: "Prim's algorithm grows the tree from one node. Which edge does it add each step?", options: ["The cheapest edge leaving the tree", "The longest edge in the graph", "A random edge", "The edge with the most nodes"], answer: 0, why: "Prim always takes the lightest edge that connects a new node." },
  ],
  nextNote: "Next, **Bottom-Up DP** returns to dynamic programming with a new way of filling the table: iteratively, starting from the smallest cases.",
};
