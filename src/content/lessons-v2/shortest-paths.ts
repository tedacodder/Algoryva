import type { LessonV2 } from "../lesson-types";

const EDGES = "[(0, 1, 7), (0, 2, 9), (0, 5, 14), (1, 2, 10), (1, 3, 15), (2, 3, 11), (2, 5, 2), (3, 4, 6), (4, 5, 9)]";
const naive = String.raw`from collections import deque

# A-B costs 1, B-C costs 1, but the direct road A-C costs 5.
g = {"A": [("B", 1), ("C", 5)], "B": [("A", 1), ("C", 1)], "C": [("A", 5), ("B", 1)]}

def bfs_cost(g, s, t):
    q = deque([(s, 0)])
    seen = {s}
    while q:
        u, cost = q.popleft()
        if u == t:
            return cost
        for v, w in g[u]:
            if v not in seen:
                seen.add(v)
                q.append((v, cost + w))

def cheapest_bruteforce(g, s, t, seen=()):
    if s == t:
        return 0
    best = float("inf")
    for v, w in g[s]:
        if v not in seen:
            best = min(best, w + cheapest_bruteforce(g, v, t, seen + (s,)))
    return best

print(bfs_cost(g, "A", "C"))   # 5
print(cheapest_bruteforce(g, "A", "C"))   # 2`;
const dijk = String.raw`import heapq

INF = float("inf")

def dijkstra(n, edges, src):
    g = [[] for _ in range(n)]
    for a, b, w in edges:
        g[a].append((b, w))
        g[b].append((a, w))
    dist = [INF] * n
    parent = [-1] * n
    dist[src] = 0
    pq = [(0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue                      # a stale entry: u already has a better distance
        for v, w in g[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                parent[v] = u
                heapq.heappush(pq, (nd, v))
    return dist, parent

def path_to(parent, t):
    path = []
    while t != -1:
        path.append(t)
        t = parent[t]
    return path[::-1]

edges = ${EDGES}
dist, parent = dijkstra(6, edges, 0)
print(dist)   # [0, 7, 9, 20, 20, 11]
print(path_to(parent, 4))   # [0, 2, 5, 4]
dist7, _ = dijkstra(7, edges, 0)
print(dist7[6])   # inf`;
const bell = String.raw`INF = float("inf")

def bellman_ford(n, edges, src):
    dist = [INF] * n
    dist[src] = 0
    for _ in range(n - 1):
        changed = False
        for a, b, w in edges:
            if dist[a] != INF and dist[a] + w < dist[b]:
                dist[b] = dist[a] + w
                changed = True
        if not changed:
            break
    for a, b, w in edges:
        if dist[a] != INF and dist[a] + w < dist[b]:
            return None                   # still improving after n - 1 rounds: a negative cycle
    return dist

def dijkstra_settle_once(n, edges, src):   # the textbook version that never revisits a settled node
    g = [[] for _ in range(n)]
    for a, b, w in edges:
        g[a].append((b, w))
    dist = [INF] * n
    dist[src] = 0
    done = [False] * n
    for _ in range(n):
        u = min((i for i in range(n) if not done[i]), key=lambda i: dist[i])
        done[u] = True
        for v, w in g[u]:
            if not done[v] and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    return dist

print(bellman_ford(4, [(0, 1, 4), (0, 2, 5), (1, 2, -3), (2, 3, 2)], 0))   # [0, 4, 1, 3]
print(bellman_ford(3, [(0, 1, 1), (1, 2, -1), (2, 1, -1)], 0))   # None
neg = [(0, 1, 2), (0, 2, 5), (2, 1, -4)]
print(dijkstra_settle_once(3, neg, 0))   # [0, 2, 5]
print(bellman_ford(3, neg, 0))   # [0, 1, 5]`;
const floyd = String.raw`INF = float("inf")

def floyd_warshall(n, edges):
    d = [[INF] * n for _ in range(n)]
    for i in range(n):
        d[i][i] = 0
    for a, b, w in edges:
        d[a][b] = min(d[a][b], w)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if d[i][k] + d[k][j] < d[i][j]:
                    d[i][j] = d[i][k] + d[k][j]
    return d

d = floyd_warshall(4, [(0, 1, 3), (1, 2, 1), (0, 2, 7), (2, 3, 2)])
print(d[0])   # [0, 3, 4, 6]
print(d[3][0])   # inf
print(d[1][3])   # 3`;
const delay = String.raw`import heapq

def network_delay(n, times, k):
    g = [[] for _ in range(n + 1)]
    for u, v, w in times:
        g[u].append((v, w))
    dist = [float("inf")] * (n + 1)
    dist[k] = 0
    pq = [(0, k)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        for v, w in g[u]:
            if d + w < dist[v]:
                dist[v] = d + w
                heapq.heappush(pq, (d + w, v))
    worst = max(dist[1:])
    return -1 if worst == float("inf") else worst

print(network_delay(4, [[2, 1, 1], [2, 3, 1], [3, 4, 1]], 2))   # 2
print(network_delay(2, [[1, 2, 1]], 2))   # -1
print(network_delay(1, [], 1))   # 0`;
const bottle = String.raw`import heapq

def min_bottleneck(n, edges, s, t):
    g = [[] for _ in range(n)]
    for a, b, w in edges:
        g[a].append((b, w))
        g[b].append((a, w))
    best = [float("inf")] * n
    best[s] = 0
    pq = [(0, s)]
    while pq:
        b, u = heapq.heappop(pq)
        if b > best[u]:
            continue
        if u == t:
            return b
        for v, w in g[u]:
            nb = max(b, w)
            if nb < best[v]:
                best[v] = nb
                heapq.heappush(pq, (nb, v))
    return -1

print(min_bottleneck(4, [(0, 1, 5), (1, 3, 2), (0, 2, 3), (2, 3, 4)], 0, 3))   # 4
print(min_bottleneck(3, [(0, 1, 2)], 0, 2))   # -1`;

export const shortestPaths: LessonV2 = {
  topic: "shortest-paths", depth: "complete", minutes: 55,
  hook: "Find the cheapest route through a weighted graph: the engine behind maps, network routing and many contest problems.",
  objectives: [
    "Explain why BFS is wrong once edges have different costs, and what “relaxing” an edge means.",
    "Run Dijkstra's algorithm by hand and in code with a priority queue, and recover the actual path.",
    "Explain why Dijkstra needs non-negative edges and what to use instead (Bellman–Ford) when edges can be negative.",
    "Detect a negative cycle, and use Floyd–Warshall for all-pairs distances on small graphs.",
    "Choose the right algorithm from the graph's size, weights and what is being asked.",
  ],
  prereqNote: "BFS (distances on unweighted graphs) and Heap (`heapq`). Graphs, for adjacency lists with weights.",
  sections: [
    { kind: "intuition", id: "gps", title: "A navigation app",
      paras: ["A navigation app does not pick the route with the fewest turns. It picks the one with the smallest **total travel time**, where every road has its own cost. A short road through a traffic jam can lose to a longer empty highway.",
        "A shortest-path algorithm answers exactly that: given a graph whose edges have costs (weights), find the path from a start to a goal with the smallest sum of costs."] },
    { kind: "naive", id: "naive", title: "Use BFS and report the cost",
      paras: ["You already know how to find the path with the **fewest edges**: BFS. It is tempting to reuse it and add up the weights along the way.",
        "But fewest edges is not cheapest cost. In the graph below the direct road A–C (one edge, cost 5) beats the two-edge route A–B–C (cost 1 + 1 = 2) in BFS's eyes, so BFS returns 5 when the true answer is 2. The result is not just slow, it is **wrong**."],
      code: naive,
      cost: "Wrong whenever edge weights differ: BFS minimises the number of edges, not the total cost." },
    { kind: "concept", id: "concept", title: "Weights, relaxation and the family of algorithms",
      paras: ["In a **weighted graph** the length of a path is the **sum** of its edge weights. The **single-source shortest path** problem asks for the distance from one start node to every other node. One tiny operation drives all the algorithms:"],
      bullets: ["**Relaxation:** if going to `u` and then along edge `u → v` of weight `w` is better than the best known way to `v`, update it: `if dist[u] + w < dist[v]: dist[v] = dist[u] + w`. Every algorithm below is a strategy for **which edges to relax, and in what order**.", "**BFS:** all weights equal, O(V + E).", "**Dijkstra:** weights ≥ 0, settle the closest node first, O((V + E) log V) with a heap.", "**Bellman–Ford:** weights may be negative; relax every edge V − 1 times, O(V·E); also **detects negative cycles**.", "**Floyd–Warshall:** distances between **all pairs**, O(V³), only for small V (a few hundred).", "**DAG:** with no cycles, relax in topological order for O(V + E), even with negative weights.", "A **negative cycle** (a loop with total weight below 0) makes shortest paths undefined: you could go around forever, getting cheaper each lap."] },
    { kind: "observation", id: "observation", title: "The closest unfinished node is already final",
      paras: ["Suppose every edge weight is zero or positive. Among all nodes whose distance is not yet final, take the one with the smallest tentative distance, `u`. Could some other route reach `u` more cheaply? Any such route must leave the finished region through some other unfinished node `x`, whose tentative distance is at least that of `u`, and then continue along edges that cannot be negative, so it cannot beat `u`'s value.",
        "So `u`'s distance is **final**: settle it, relax its outgoing edges (which may lower its neighbours' tentative distances), and repeat with the next closest. A priority queue (heap) finds “the closest” fast. That is Dijkstra's algorithm. It is greedy in the same sense as the Greedy lesson, and it depends on **no negative edges** for the argument to hold."] },
    { kind: "viz", id: "viz-dijkstra", title: "Dijkstra on a six-node graph", viz: "dijkstra",
      paras: ["Numbers on the edges are lengths; the number under each node is the best distance found so far (∞ means unknown). Each step pops the closest queued node (its distance becomes final), then **relaxes** its edges. Watch D: first set to 22 via B, then improved to 20 via C. Also see the stale queue entries skipped later."] },
    { kind: "viz", id: "viz-bellman", title: "Bellman–Ford with a negative edge", viz: "bellman-ford",
      paras: ["Dijkstra's rule assumes no edge is negative, so it can settle a node too early on a graph like this one. Bellman–Ford does not rely on that: it relaxes every edge in each round and runs at most V − 1 rounds. Watch the distances fall, and the rounds stop as soon as nothing changes."] },
    { kind: "viz", id: "viz-floyd", title: "Floyd–Warshall: every pair at once", viz: "floyd-warshall",
      paras: ["Each cell is the best distance from i to j found so far. Trying node k as a stop-over updates the cell whenever going i → k → j is shorter. After the last k, every cell holds the shortest distance for its pair, in O(n³) time for n nodes."] },
    { kind: "example", id: "example", title: "The same run in a table",
      paras: ["Start at A. “Settle” means a node's distance is final."],
      table: { head: ["settle", "relaxations", "distances after (A B C D E F)"], rows: [["A (0)", "B = 7, C = 9, F = 14", "0 7 9 ∞ ∞ 14"], ["B (7)", "C: 7 + 10 = 17 no · D: 7 + 15 = 22 yes", "0 7 9 22 ∞ 14"], ["C (9)", "D: 9 + 11 = 20 yes · F: 9 + 2 = 11 yes", "0 7 9 20 ∞ 11"], ["F (11)", "E: 11 + 9 = 20 yes", "0 7 9 20 20 11"], ["D (20)", "E: 20 + 6 = 26 no", "0 7 9 20 20 11"], ["E (20)", "nothing left to improve", "0 7 9 20 20 11"]] },
      steps: [{ title: "Distances can improve before they are final", body: "D started at 22 (through B) and dropped to 20 (through C). That is allowed: it was only *tentative* until D was settled." }, { title: "Ties", body: "D and E both end at 20, so either may be settled first. The distances do not depend on tie-breaking." }] },
    { kind: "code", id: "code-dijkstra", title: "Dijkstra with a heap",
      paras: ["The heap holds `(distance, node)` pairs. Python's `heapq` cannot lower a key in place, so we push a **new** pair each time a distance improves, and ignore old pairs when they surface (“lazy deletion”)."],
      pseudocode: "dist[src] = 0; heap = [(0, src)]\nwhile the heap is not empty:\n    pop (d, u); if d > dist[u]: skip it (stale)\n    for each edge u → v of weight w:\n        if d + w < dist[v]: dist[v] = d + w; remember parent; push (d + w, v)",
      code: dijk,
      walkthrough: ["The nodes A to F of the picture are 0 to 5 here. The result `[0, 7, 9, 20, 20, 11]` matches the table.", "`if d > dist[u]: continue` discards stale entries: a node may be pushed several times, but only the smallest (the first popped) is processed.", "`parent[v] = u` records the last edge of the best path to `v`. Walking `parent` backwards from the target and reversing gives the path: `[0, 2, 5, 4]` is A → C → F → E, total 9 + 2 + 9 = 20.", "A node that cannot be reached keeps `INF` (Python prints `inf`). Always treat it as “unreachable”, not as a number.", "Each edge relaxation pushes at most one entry, so the heap holds at most E entries and every push or pop costs O(log E) = O(log V)."] },
    { kind: "code", id: "code-bellman", title: "Negative edges: Bellman–Ford",
      paras: ["Dijkstra's argument fails if an edge can be negative: a later detour might *reduce* a distance that was already declared final. **Bellman–Ford** makes no such promise. It simply relaxes **every edge**, over and over. A shortest path has at most V − 1 edges, so after V − 1 rounds all distances are correct. If a further round still improves something, a negative cycle must exist."],
      code: bell,
      walkthrough: ["`changed` lets the loop stop early once a full round improves nothing.", "The final loop is the **negative-cycle test**: after V − 1 rounds a correct shortest distance cannot improve any more, so an improvement proves a cycle with negative total weight (returned as `None`).", "`dist[a] != INF` skips edges out of unreachable nodes, which would otherwise propagate `inf` arithmetic.", "The last two lines show why Dijkstra needs non-negative weights: with the edge `2 → 1` of weight −4, the settle-once version fixes node 1 at 2 and never revisits it, but the true distance is 5 − 4 = 1, which Bellman–Ford finds."] },
    { kind: "code", id: "code-floyd", title: "All pairs: Floyd–Warshall",
      paras: ["To get the distance between **every** pair of nodes on a small graph, consider each node `k` in turn as a possible stop in the middle: can going `i → k → j` beat the best known `i → j`? After all `k` have been tried, every distance is final. Three nested loops, with `k` outermost."],
      code: floyd,
      walkthrough: ["`d[i][i] = 0` (no cost to stay) and `d[a][b] = min(...)` handles several edges between the same pair.", "`k` must be the **outer** loop: when processing `k`, the table already holds the best paths that use only the intermediate nodes tried so far.", "Cost is O(V³): fine for V up to about 400 in a contest, hopeless for V = 10⁵.", "`d[3][0]` is `inf` because the graph is directed and nothing leads back to node 0."] },
    { kind: "complexity", id: "complexity", title: "Costs and when to use which",
      rows: [
        { what: "BFS (all weights equal)", time: "O(V + E)", space: "O(V)", why: "Each node and edge handled once." },
        { what: "Dijkstra with a binary heap", time: "O((V + E) log V)", space: "O(V + E)", why: "Each edge may push one heap entry (O(log V)); each node is settled once." },
        { what: "Bellman–Ford", time: "O(V · E)", space: "O(V)", why: "V − 1 rounds, each relaxing all E edges." },
        { what: "Floyd–Warshall (all pairs)", time: "O(V³)", space: "O(V²)", why: "Three nested loops over V nodes." },
        { what: "Shortest paths on a DAG", time: "O(V + E)", space: "O(V)", why: "Relax edges in topological order; each edge once." },
        { what: "Dijkstra on a dense graph with an array instead of a heap", time: "O(V²)", space: "O(V)", why: "Scan for the closest unsettled node each round; better than a heap when E is about V²." }],
      paras: ["Rule of thumb: **unweighted** → BFS; **weights ≥ 0** → Dijkstra; **negative weights** → Bellman–Ford (or topological order on a DAG); **all pairs and V ≤ 400** → Floyd–Warshall."] },
    { kind: "edge", id: "edges", title: "Edge cases",
      items: [{ case: "Unreachable node", handle: "Its distance stays `inf`. Print -1 (or whatever the statement says), never the raw infinity." }, { case: "Negative edge weights", handle: "Dijkstra can give wrong answers. Use Bellman–Ford, or a DAG order if there are no cycles." }, { case: "Negative cycle", handle: "Distances through it are undefined (arbitrarily low). Bellman–Ford detects it; decide what the problem wants (usually “impossible” or a flag)." }, { case: "Zero-weight edges", handle: "Allowed in Dijkstra. Zero-weight cycles are harmless." }, { case: "Several edges between the same pair, or self-loops", handle: "Relaxation naturally keeps the cheapest; a self-loop with positive weight never helps." }, { case: "Huge weights or long paths", handle: "Distances can exceed 32 bits (10⁵ edges of 10⁹). Python is safe; use 64-bit integers elsewhere, and a sentinel like `10**18` for infinity." }, { case: "Directed versus undirected", handle: "For undirected edges add both directions to the adjacency list." }, { case: "Start equals target", handle: "Distance 0, and the path is just the start node." }] },
    { kind: "mistakes", id: "mistakes", title: "Mistakes to avoid",
      items: [{ mistake: "Using BFS on a weighted graph.", fix: "BFS counts edges, not cost. Use Dijkstra (or Bellman–Ford) when weights differ." }, { mistake: "Running Dijkstra with negative edges.", fix: "The “closest is final” argument breaks. Use Bellman–Ford." }, { mistake: "Forgetting the stale-entry check `if d > dist[u]: continue`.", fix: "Without it correctness holds but the same node is processed many times, which can turn O((V + E) log V) into something far slower." }, { mistake: "Putting the weight second in the heap tuple, `(node, dist)`.", fix: "The heap orders by the first element: push `(distance, node)`." }, { mistake: "Floyd–Warshall with the wrong loop order.", fix: "The intermediate node `k` must be the outermost loop." }, { mistake: "Printing `inf` or treating it as a real distance.", fix: "Check for `INF` explicitly and convert to the required output." }] },
    { kind: "recognize", id: "recognize", title: "How to spot a shortest-path problem",
      signals: ["“**Cheapest**”, “**fastest**”, “**minimum cost/time/distance** from A to B” on a network where each link has its own cost.", "Moves have **different prices**: travel times, tolls, fuel, effort in a grid with cell costs.", "“Minimum number of steps” where each step has the same cost: **BFS**, not Dijkstra.", "A **state graph** with costs: nodes are (position, fuel left) or (room, keys), edges are moves with a price.", "“Minimise the worst edge on the route” (a **bottleneck**) or other path-combination rules: a Dijkstra variant where the way costs combine changes (see the worked problem).", "Negative values or “can you make an infinite profit?”: **Bellman–Ford** and negative cycles (currency arbitrage)."],
      notThis: ["Every move costs 1: BFS is simpler and faster.", "You need to connect everything as cheaply as possible rather than reach one target: that is a minimum spanning tree.", "The graph is a DAG and you want longest or shortest paths: process in topological order."] },
    { kind: "worked", id: "worked-delay", title: "Network delay time",
      problem: "A signal is sent from node `k` of a directed network of `n` nodes. Each entry `[u, v, w]` says the signal takes `w` time units to travel from `u` to `v`. How long until **every** node has received the signal? Return -1 if some node is never reached.",
      approach: ["The time for a node to receive the signal is its shortest-path distance from `k`.", "All nodes have received it when the **slowest** one has: the answer is the maximum distance.", "If any distance is infinity, some node is unreachable, so return -1."],
      code: delay,
      takeaway: "Many problems are “run Dijkstra, then summarise the distance array”: here a maximum. Always check unreachable nodes separately, since `inf` would otherwise leak into the answer." },
    { kind: "worked", id: "worked-bottleneck", title: "Minimise the worst edge on the route",
      problem: "Given an undirected weighted graph, find a path from `s` to `t` whose **largest single edge weight is as small as possible** (think: the narrowest bridge you must cross). Return that value, or -1 if there is no path.",
      approach: ["This is not “sum of weights”, but the same engine works. Define the cost of a path as the **maximum** edge on it.", "Replace `d + w` with `max(d, w)` when relaxing. Combining by max never makes a path cheaper by adding an edge, so the “closest first” argument still holds.", "Stop as soon as `t` is popped: its value is final."],
      code: bottle,
      takeaway: "Dijkstra is really about *how costs combine along a path*. As long as extending a path never makes it better (it is monotone), the greedy argument works. Sum and max both qualify." },
  ],
  cheatSheet: [{ label: "Relax", value: "if dist[u] + w < dist[v]: dist[v] = dist[u] + w" }, { label: "Dijkstra", value: "heap of (dist, node); pop; skip if d > dist[u]; relax; needs weights ≥ 0" }, { label: "Bellman–Ford", value: "relax all edges V − 1 times; one more improvement ⇒ negative cycle" }, { label: "Floyd–Warshall", value: "for k, for i, for j: d[i][j] = min(d[i][j], d[i][k] + d[k][j])" }, { label: "Costs", value: "BFS O(V+E) · Dijkstra O((V+E) log V) · Bellman–Ford O(VE) · Floyd O(V³)" }, { label: "Path", value: "store parent[v] = u on each improvement; walk back from the target" }],
  summary: ["BFS minimises edges, not cost; for weighted graphs use a shortest-path algorithm built on relaxation.", "Dijkstra settles the closest unfinished node, whose distance is final when no edge is negative; a heap makes it O((V + E) log V).", "Store parents to recover paths, and treat `inf` as “unreachable”.", "Bellman–Ford handles negative edges in O(V·E) and detects negative cycles with one extra round.", "Floyd–Warshall gives all pairs in O(V³); pick the algorithm from the weights and the size of the graph."],
  checks: [
    { kind: "concept", q: "Why can BFS give a wrong answer on a weighted graph?", options: ["It is too slow", "It minimises the number of edges, not the total weight", "It cannot handle cycles", "It needs a heap"], answer: 1, why: "The fewest-edge path can be much more expensive than a route with more, cheaper edges." },
    { kind: "concept", q: "What does relaxing the edge u → v with weight w do?", options: ["Deletes the edge", "Lowers dist[v] to dist[u] + w if that is smaller", "Sorts the neighbours", "Marks v as visited"], answer: 1, why: "Relaxation checks whether going through u gives a cheaper way to reach v and updates the best-known distance if so." },
    { kind: "trace", q: "In the lesson's graph, what is the shortest distance from A to D?", options: ["15", "20", "22", "26"], answer: 1, why: "A → C → D costs 9 + 11 = 20, better than A → B → D = 7 + 15 = 22." },
    { kind: "complexity", q: "What is the time complexity of Dijkstra with a binary heap on V nodes and E edges?", options: ["O(V + E)", "O((V + E) log V)", "O(V · E)", "O(V³)"], answer: 1, why: "Each edge can cause one heap push or pop costing O(log V), plus work per node." },
    { kind: "concept", q: "Why does Dijkstra fail with negative edge weights?", options: ["The heap cannot store negative numbers", "A later negative edge can lower a distance that was already declared final", "It becomes O(V³)", "It works fine"], answer: 1, why: "Dijkstra assumes the closest unfinished node cannot be improved, which only holds when edges cannot reduce a path's cost." },
    { kind: "recognize", q: "“Can you make an infinite profit by trading currencies in a cycle?” points to:", options: ["BFS", "Bellman–Ford, detecting a negative cycle", "Dijkstra", "Binary search"], answer: 1, why: "Taking logarithms of exchange rates turns a profitable loop into a negative-weight cycle, which Bellman–Ford detects." },
    { kind: "trace", q: "Dijkstra on edges 1->2 (1), 1->3 (4), 2->3 (2), 3->4 (1), starting at 1. What is the distance to node 4?", options: ["4", "5", "3", "6"], answer: 0, why: "The route 1-2-3-4 costs 1 + 2 + 1 = 4, which beats the direct 1-3-4 route of 5." },
    { kind: "trace", q: "Bellman-Ford with edges 1->2 (4), 1->3 (5), 3->2 (-3), run for V-1 = 2 rounds from node 1. What is the distance to node 2?", options: ["2", "4", "5", "-3"], answer: 0, why: "The negative edge makes the route 1-3-2 cost 5 - 3 = 2, which is shorter than 4." },
    { kind: "trace", q: "Floyd-Warshall on 3 nodes (0-based) with 0->1 (3), 1->2 (4), 0->2 (10). What is dist[0][2] after the algorithm?", options: ["7", "10", "8", "4"], answer: 0, why: "The route 0-1-2 costs 3 + 4 = 7, which beats the direct 10." },
    { kind: "trace", q: "Dijkstra on the 6-node graph with edges 1-2 (7), 1-3 (9), 1-6 (14), 2-3 (10), 2-4 (15), 3-4 (11), 3-6 (2), 4-5 (6), 6-5 (9), undirected. What is the distance from 1 to 5?", options: ["20", "26", "23", "11"], answer: 0, why: "The best route is 1-3-6-5: 9 + 2 + 9 = 20." },
    { kind: "concept", q: "Why can Dijkstra give wrong answers when an edge weight is negative?", options: ["A node it has finished can later get a shorter route through the negative edge", "It is too slow with negative numbers", "It needs a heap, which negatives break", "It cannot read the graph"], answer: 0, why: "Dijkstra never revisits a finished node, so a later negative edge can reveal a shorter path it missed." },
    { kind: "complexity", q: "Dijkstra with a binary heap on a graph with n nodes and m edges: what is the running time?", options: ["O((n + m) log n)", "O(n\u00b3)", "O(n\u00b2)", "O(m log m)"], answer: 0, why: "Each edge may push one heap entry, and each heap operation costs log n." },
    { kind: "concept", q: "What does Floyd-Warshall compute?", options: ["The shortest distance between every pair of nodes", "A minimum spanning tree", "The maximum flow", "A topological order"], answer: 0, why: "It tries every node as an intermediate stop for every pair." },
    { kind: "complexity", q: "What is the running time of Floyd-Warshall on n nodes?", options: ["O(n\u00b3)", "O(n\u00b2)", "O(n log n)", "O(n + m)"], answer: 0, why: "Three nested loops over the nodes." },
    { kind: "concept", q: "What does one relaxation step do in shortest-path algorithms?", options: ["Lowers a node's distance if the route through the current node is shorter", "Removes a node from the graph", "Sorts the edges by weight", "Counts the paths"], answer: 0, why: "Relaxation is the basic update that all these algorithms repeat." },
  ],
  nextNote: "Next, **Minimum Spanning Tree** asks a different question: not the cheapest route to one place, but the cheapest way to connect everything.",
};
