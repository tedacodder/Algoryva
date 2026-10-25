import type { LessonV2 } from "../lesson-types";

const naive = String.raw`from itertools import combinations

def cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

def inside_triangle(a, b, c, p):
    d1, d2, d3 = cross(a, b, p), cross(b, c, p), cross(c, a, p)
    return not ((d1 > 0 or d2 > 0 or d3 > 0) and (d1 < 0 or d2 < 0 or d3 < 0))

def corners_naive(points):
    pts = sorted(set(points))
    count = 0
    for p in pts:
        others = [q for q in pts if q != p]
        covered = any(inside_triangle(a, b, c, p) for a, b, c in combinations(others, 3) if cross(a, b, c) != 0)
        if not covered:
            count += 1
    return count

print(corners_naive([(0, 0), (4, 0), (4, 4), (0, 4), (2, 2)]))   # 4
print(corners_naive([(0, 0), (4, 0), (0, 4), (4, 4), (2, 0)]))   # 4`;

const code = String.raw`def cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

def twice_area(poly):
    n = len(poly)
    s = 0
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s)

def hull(points):
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]

print(cross((0, 0), (4, 0), (2, 1)))   # 4
print(cross((0, 0), (4, 0), (2, 0)))   # 0
print(twice_area([(0, 0), (4, 0), (0, 3)]))   # 12
print(len(hull([(1, 1), (5, 0), (6, 3), (4, 6), (1, 5), (0, 3), (3, 3), (3, 0), (2, 2)])))   # 7
print(hull([(0, 0), (1, 1), (2, 2), (3, 3)]))   # [(0, 0), (3, 3)]`;

export const geometry: LessonV2 = {
  topic: "geometry", depth: "complete", minutes: 60,
  hook: "Points, lines and polygons become exact, reliable arithmetic once you can answer one question: on which side of a line does this point lie?",
  objectives: [
    "Compute the cross product of two vectors and read its sign as the side of a line, using only integers.",
    "Explain why integer cross products are safer than comparing floating-point angles.",
    "Compute a polygon's area with the shoelace formula, and count lattice points with Pick's theorem.",
    "Decide whether two segments share a point, including the touching and overlapping cases.",
    "Build a convex hull with Andrew's monotone chain, and say why collinear points must be removed.",
  ],
  prereqNote: "Comfortable with tuples, sorting with a key, and integer arithmetic. The sorting and stack ideas in Sorting II and Stacks help with the hull.",
  sections: [
    { kind: "intuition", id: "fence", title: "Which side am I on?",
      paras: [
        "Imagine walking from a fence post A to a post B. Some trees are on your left, some on your right, and a few stand exactly on the line between the posts. Almost every geometry problem reduces to asking this question quickly and correctly, for many points.",
        "Computers can answer it exactly with arithmetic on the coordinates alone. No angles, no distances, no square roots: just a product and a difference. That is what keeps geometry code correct when the numbers are large.",
      ] },
    { kind: "concept", id: "cross", title: "The cross product as a side test",
      paras: [
        "For three points O, A and B, the **cross product** is (A − O) × (B − O) = (A.x − O.x)(B.y − O.y) − (A.y − O.y)(B.x − O.x). Its sign tells you the side of the directed line from O to A on which B lies. Its size is **twice the area** of the triangle O, A, B.",
      ],
      bullets: [
        "**Positive**: B is strictly left of the direction O → A (a counterclockwise turn).",
        "**Negative**: B is strictly right of it (a clockwise turn).",
        "**Zero**: O, A and B are collinear.",
        "With O = (0,0), A = (4,0): B = (2,1) gives 4 × 1 − 0 × 2 = 4, so it is left. B = (2,0) gives 0, so it is on the line.",
        "All of this is integer arithmetic. The value is exact, unlike an angle computed with atan2.",
      ] },
    { kind: "naive", id: "naive", title: "Test every triangle",
      paras: [
        "A point is a corner of the convex hull (the smallest convex polygon containing every point) exactly when it is not inside the hull of the other points. A simple way to test that: check whether the point lies inside some triangle formed by three of the others. If it does, it is not a corner.",
        "This is correct, and the code is short, but it examines every triple of other points for every point. With n points that is about n⁴ triangle tests, so 100 points already means roughly 10⁸ operations. The version above also assumes at least one non-degenerate triangle exists; the monotone chain below has no such assumption.",
      ],
      code: naive,
      cost: "O(n⁴): every point against every triple of the others." },
    { kind: "observation", id: "observation", title: "Sort, then walk around the hull with a stack",
      paras: [
        "Sort the points by x, then by y. The lower hull is the chain you get walking from the leftmost point to the rightmost, always turning left. Keep a stack of the current chain. When a new point makes a turn that is not a strict left turn (cross ≤ 0), the top point cannot be a corner, so pop it. Do the same from right to left for the upper hull.",
        "Removing points with cross = 0 is what drops points that sit on an edge. Keeping them would count edge points as corners, and the answer would be wrong.",
      ] },
    { kind: "viz", id: "viz-hull", title: "Monotone chain on nine points", viz: "convex-hull",
      paras: [
        "Watch the stack (the chain) grow with each point. Each grey edge that gets removed is a turn that was not a left turn. The final chain, read counterclockwise, is the hull, and the points left out are either inside it or on one of its edges.",
      ] },
    { kind: "example", id: "example", title: "A triangle, traced by hand",
      paras: [
        "Take the triangle with corners A = (0,0), B = (4,0) and C = (0,3). The cross product at A, from B to C, is 4 × 3 − 0 × 0 = 12, so the triangle's area is 12 / 2 = 6.",
        "The shoelace formula gives the same result one edge at a time: sum x₁y₂ − x₂y₁ over the edges A→B, B→C, C→A. Those terms are 0, 12 and 0, so twice the area is 12.",
        "Pick's theorem links area to lattice points. For a simple polygon with I interior and B boundary lattice points, twice the area is 2I + B − 2. This triangle has B = 8 boundary points (4 on AB, 1 on BC, 3 on CA, counting one endpoint of each edge once) and I = 3, so 2I + B − 2 = 6 + 8 − 2 = 12, matching the shoelace result.",
      ],
      table: { head: ["Quantity", "Value", "How"], rows: [["twice the area", "12", "shoelace, or the cross product at A"], ["interior points I", "3", "(1,1), (2,1), (1,2)"], ["boundary points B", "8", "sum of gcd(|dx|, |dy|) over the edges"], ["check", "12", "2I + B − 2"]] } },
    { kind: "code", id: "code", title: "Cross product, area and the hull in Python",
      paras: [
        "The plan: a cross function that gives the sign, the shoelace sum with absolute value, and Andrew's monotone chain. Python integers never overflow, so these run exactly on any coordinates.",
      ],
      pseudocode: "cross(o, a, b) = (a−o) × (b−o)\nshoelace: sum x_i·y_{i+1} − x_{i+1}·y_i over the edges, then abs\nhull: sort; build lower and upper chains with a stack, popping on cross ≤ 0; join them without repeating the ends",
      code,
      walkthrough: [
        "cross returns an integer. Its sign is the side, and the magnitude is twice the triangle's area, so the same function does both jobs.",
        "twice_area walks the edges with the index wrapping around (i + 1) % n, so the last edge returns to the first corner. The absolute value makes clockwise and counterclockwise polygons give the same answer.",
        "hull removes duplicates with set() first, because two copies of one point would otherwise confuse the turn test. The condition cross ≤ 0 removes collinear points, so only real corners remain.",
        "The lower chain is built from left to right, the upper from right to left. Each chain starts and ends at the extreme points, so the two ends are dropped before joining.",
      ] },
    { kind: "complexity", id: "complexity", title: "What the operations cost",
      rows: [
        { what: "cross product", time: "O(1)", space: "O(1)", why: "a fixed number of multiplications and subtractions." },
        { what: "shoelace area", time: "O(n)", space: "O(1)", why: "one term per edge, each computed once." },
        { what: "convex hull (monotone chain)", time: "O(n log n)", space: "O(n)", why: "sorting dominates; the stack pass is linear because each point is pushed and popped at most once." },
        { what: "all-pairs segment test", time: "O(n²)", space: "O(1)", why: "every pair is checked once. Faster sweep-line methods exist, but they are not needed for a few hundred segments." },
      ],
      paras: [
        "The hull's O(n log n) bound comes from sorting, not from the stack. Without the sort, no method this simple can find the hull.",
      ] },
    { kind: "edge", id: "edge", title: "Cases that break geometry code",
      items: [
        { case: "Collinear points", handle: "With cross ≤ 0 they are popped, so only the two ends of the line are corners. With cross < 0 they would be counted and the answer is wrong." },
        { case: "Duplicate points", handle: "Deduplicate with set() first. The problem statement says whether repeats count once; here they do." },
        { case: "One or two distinct points", handle: "The hull is the point itself, or the segment with two corners. Return early, before building chains." },
        { case: "Large coordinates", handle: "Values near 10⁹ make cross products near 10¹⁸ or more. Python handles this exactly; in C++ or Java use 64-bit integers, and compute the products before subtracting." },
        { case: "Orientation of the polygon", handle: "The shoelace sum is positive for counterclockwise polygons and negative for clockwise ones. Take the absolute value before reporting an area." },
      ] },
    { kind: "mistakes", id: "mistakes", title: "Common mistakes",
      items: [
        { mistake: "Comparing angles with atan2 to sort or to test turns.", fix: "Use the cross product. Floating-point angles cannot always separate two directions that differ by a tiny amount, and integer tests are exact." },
        { mistake: "Keeping collinear points on the hull by using < 0 instead of ≤ 0.", fix: "Pop on cross ≤ 0. The hull has corners, not edge points." },
        { mistake: "Counting a boundary point as strictly inside.", fix: "“Strictly inside” excludes edges and corners. Test the boundary separately, as the brute-force check in this lesson does." },
        { mistake: "Reporting a negative area for a clockwise polygon.", fix: "Take the absolute value of the shoelace sum." },
        { mistake: "Forgetting that the polygon closes back to its first corner.", fix: "Use index (i + 1) % n so the last edge is included." },
      ] },
    { kind: "recognize", id: "recognize", title: "Recognising a geometry problem",
      signals: [
        "The input is a list of points or segments, and the question is about shape: area, perimeter, corners, containment, or whether shapes touch.",
        "The problem asks whether a point is left, right or on a line, or about turning direction.",
        "Coordinates are integers, and an exact answer is required (a count, a yes or no, or an integer area).",
      ],
      notThis: [
        "If every point lies on one line, the problem is one-dimensional: sort and take the ends.",
        "If the answer is a real length such as a perimeter, the result is irrational, so the output needs a stated precision. Exact integer methods then no longer apply.",
      ],
      paras: [
        "Use the cross product for any side, turn or containment test, because it stays exact.",
      ] },
    { kind: "worked", id: "worked", title: "Worked problem: corners of a hull",
      problem: "Given n points, possibly with repeats, count the corners of their convex hull. Points on an edge or inside the hull are not corners.",
      approach: [
        "Deduplicate the points. Repeated copies of one point must count once.",
        "Run the monotone chain. The number of corners is the length of the lower chain minus one, plus the length of the upper chain minus one. Each chain includes both extreme points, so each is shortened by one.",
        "Check the degenerate cases: one point gives 1, and a set of collinear points gives 2 (the two ends).",
      ],
      code: String.raw`def hull_corners(points):
    pts = sorted(set(points))
    if len(pts) <= 2:
        return len(pts)
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return (len(lower) - 1) + (len(upper) - 1)`,
      takeaway: "The hull is the sorted point list with the turn test applied twice. The only careful details are deduplication, ≤ 0, and the degenerate cases." },
  ],
  cheatSheet: [
    { label: "Side test", value: "cross(O, A, B) > 0 left, < 0 right, = 0 on the line; magnitude = twice the triangle area" },
    { label: "Shoelace", value: "twice the area = |Σ (x_i·y_{i+1} − x_{i+1}·y_i)|, O(n)" },
    { label: "Pick's theorem", value: "twice the area = 2I + B − 2, so I = (2A − B + 2) / 2" },
    { label: "Hull", value: "monotone chain: sort, two stack passes, pop on cross ≤ 0, O(n log n)" },
    { label: "Segments", value: "they touch if the signs cross, or an endpoint lies on the other segment" },
  ],
  summary: [
    "The cross product answers side, turn and collinearity questions exactly, with integers only.",
    "Area (shoelace) and lattice counting (Pick's theorem) are linked, so each one checks the other.",
    "The convex hull is a sort followed by a stack walk; popping on ≤ 0 keeps only real corners.",
    "Exactness is the point: avoid floating-point angles, and be explicit about collinear, duplicate and degenerate inputs.",
  ],
  checks: [
    { kind: "concept", q: "What is the cross product of O = (0,0), A = (4,0) and B = (2,1), and what does its sign say?", options: ["−4, B is right of the line", "0, the points are collinear", "4, B is left of the line", "2, B lies on the line"], answer: 2, why: "(4)(1) − (0)(2) = 4. Positive means B is strictly left of the directed line from O to A." },
    { kind: "trace", q: "What is twice the area of the triangle (0,0), (4,0), (0,3)?", options: ["3", "6", "12", "24"], answer: 2, why: "The cross product at (0,0) of (4,0) and (0,3) is 12, which is twice the area. The area is 6." },
    { kind: "concept", q: "Why does the monotone chain pop a point when the cross product is ≤ 0, rather than < 0?", options: ["It makes the code faster", "Collinear points on an edge are removed, so only real corners remain", "Negative values are not allowed", "It keeps the stack sorted"], answer: 1, why: "A point with cross = 0 lies on the edge being formed. Keeping it would count an edge point as a corner." },
    { kind: "trace", q: "A polygon has I = 3 interior and B = 8 boundary lattice points. What is twice its area by Pick's theorem?", options: ["8", "11", "12", "14"], answer: 2, why: "2I + B − 2 = 6 + 8 − 2 = 12." },
    { kind: "recognize", q: "For n ≤ 500 segments, what is a sensible first approach to deciding whether any two share a point?", options: ["Sort the segments by angle", "Test every pair with orientation tests", "Build a segment tree over the coordinates", "Binary search on the answer"], answer: 1, why: "500 segments give about 125,000 pairs, each tested in constant time. That is fast enough, and the method is exact." },
    { kind: "concept", q: "Why is an exact integer cross product preferred over comparing atan2 angles?", options: ["atan2 is slower", "Floating-point angles cannot always separate two directions that are very close together", "Integers use less memory", "Python cannot compute atan2"], answer: 1, why: "Two different directions can produce the same or misordered floating-point angles when the coordinates are large. The integer test is exact." },
    { kind: "trace", q: "What does print(1*1 - 0*0) print? This is the cross product of vectors (1, 0) and (0, 1).", options: ["1", "0", "-1", "2"], answer: 0, why: "The cross product is x1*y2 - x2*y1 = 1*1 - 0*0 = 1." },
    { kind: "trace", q: "What is the area of the triangle (0,0), (4,0), (0,3)? Print abs(4*3 - 0*0) // 2.", options: ["6", "12", "3", "7"], answer: 0, why: "The doubled area is 12, so the area is 6." },
    { kind: "trace", q: "What is the squared distance between (1, 2) and (4, 6)?", options: ["25", "5", "9", "16"], answer: 0, why: "(4-1)^2 + (6-2)^2 = 9 + 16 = 25." },
    { kind: "concept", q: "What sign does the cross product of two vectors have when the second turns left (counter-clockwise) from the first?", options: ["Positive", "Negative", "Zero", "Undefined"], answer: 0, why: "A counter-clockwise turn gives a positive cross product." },
    { kind: "complexity", q: "What is the running time of the monotone-chain convex hull on n points?", options: ["O(n log n)", "O(n\u00b2)", "O(n)", "O(log n)"], answer: 0, why: "The sort dominates; the hull is then built in one linear pass." },
    { kind: "concept", q: "Why compare squared distances instead of distances?", options: ["It avoids square roots, and the order is the same", "Squares are always integers", "Distances cannot be compared", "Python requires it"], answer: 0, why: "If a and b are non-negative, a squared is bigger than b squared exactly when a is bigger than b." },
    { kind: "trace", q: "Are the points (0,0), (1,1), (2,2) collinear? Print their cross product value.", options: ["0", "1", "2", "-1"], answer: 0, why: "The cross product is zero, so the three points lie on one line." },
    { kind: "concept", q: "What does a zero cross product mean for three points?", options: ["They are collinear", "They form a right angle", "They are the same point", "They are equally far from the origin"], answer: 0, why: "Zero cross product means the vectors are parallel." },
    { kind: "trace", q: "How many integer points lie strictly between (0,0) and (4,2) on the segment? Print math.gcd(4, 2) - 1.", options: ["1", "0", "2", "3"], answer: 0, why: "gcd(4,2) = 2, so the segment has one interior lattice point, (2,1)." },
  ],
  nextNote: "Geometry builds on Numerics and Sorting. The next natural step is Dynamic Programming on structures, or the contest-skills topics, where geometry problems often appear alongside time pressure.",
};
