import type { Edge, GraphGen, GraphStep } from "./types";

export type Graph = { n: number; edges: Edge[]; directed: boolean };
export type St = "queued" | "cur" | "done" | "hit";
export type Mark = "pick" | "skip" | "cur";

const CX = 150;
const CY = 150;
const R = 115;

/** Nodes sit on a circle, node 0 at the top, so every frame uses the same positions. */
export function layout(n: number): { id: string; x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { id: String(i), x: CX + R * Math.cos(t), y: CY + R * Math.sin(t) };
  });
}

/** Key for an edge in the marks map. Undirected edges share one key in both directions. */
export const edgeKey = (g: Graph, u: number, v: number) => (g.directed ? `${u}>${v}` : `${Math.min(u, v)}-${Math.max(u, v)}`);

/** Outgoing neighbours of each node, sorted by index so every run visits them in the same order. */
export function neighbours(g: Graph): Map<number, { v: number; w: number }[]> {
  const adj = new Map<number, { v: number; w: number }[]>();
  for (let i = 0; i < g.n; i++) adj.set(i, []);
  for (const e of g.edges) {
    adj.get(e.u)?.push({ v: e.v, w: e.w });
    if (!g.directed) adj.get(e.v)?.push({ v: e.u, w: e.w });
  }
  for (const list of adj.values()) list.sort((p, q) => p.v - q.v);
  return adj;
}

type FrameOpts = {
  states?: Record<number, St>;
  marks?: Map<string, Mark>;
  text?: Record<number, string>;
  structure?: { label: string; items: number[] };
  order?: number[];
  showWeights?: boolean;
};

export function frame(g: Graph, line: number, note: string, o: FrameOpts): GraphStep {
  const marks = o.marks ?? new Map<string, Mark>();
  const state: Record<string, St> = {};
  for (const [k, s] of Object.entries(o.states ?? {})) state[k] = s;
  const text: Record<string, string> = {};
  for (const [k, s] of Object.entries(o.text ?? {})) text[k] = s;
  return {
    line,
    note,
    nodes: layout(g.n),
    edges: g.edges.map((e) => ({
      a: String(e.u),
      b: String(e.v),
      directed: g.directed,
      w: o.showWeights ? e.w : undefined,
      mark: marks.get(edgeKey(g, e.u, e.v)),
    })),
    state,
    text,
    structure: { label: o.structure?.label ?? "", items: (o.structure?.items ?? []).map(String) },
    order: (o.order ?? []).map(String),
  };
}

export function bfs(g: Graph, start: number): GraphGen {
  const adj = neighbours(g);
  const seen = new Set<number>([start]);
  const queue: number[] = [start];
  const order: number[] = [];
  const states: Record<number, St> = { [start]: "queued" };
  const marks = new Map<string, Mark>();
  const snap = (line: number, note: string) =>
    frame(g, line, note, { states: { ...states }, marks, structure: { label: "Queue (front on the left)", items: [...queue] }, order: [...order] });

  const f: GraphStep[] = [snap(0, `Start at ${start}. Mark it seen and put it in the queue.`)];
  while (queue.length > 0) {
    const u = queue.shift() ?? start;
    states[u] = "cur";
    f.push(snap(2, `Dequeue ${u}. Check each of its neighbours.`));
    for (const { v } of adj.get(u) ?? []) {
      marks.set(edgeKey(g, u, v), "cur");
      f.push(snap(3, `Look at the edge from ${u} to ${v}.`));
      if (!seen.has(v)) {
        seen.add(v);
        queue.push(v);
        states[v] = "queued";
        marks.set(edgeKey(g, u, v), "pick");
        f.push(snap(4, `${v} is new. Mark it seen and enqueue it.`));
      } else {
        marks.set(edgeKey(g, u, v), "skip");
        f.push(snap(4, `${v} was already seen, so skip it.`));
      }
    }
    states[u] = "done";
    order.push(u);
    f.push(snap(5, `${u} has no unseen neighbours left, so it is finished.`));
  }
  return { kind: "graph", frames: f, result: `visit order ${order.join(" ")}` };
}

export function dfs(g: Graph, start: number): GraphGen {
  const adj = neighbours(g);
  const seen = new Set<number>();
  const path: number[] = [];
  const preorder: number[] = [];
  const states: Record<number, St> = {};
  const marks = new Map<string, Mark>();
  const snap = (line: number, note: string) =>
    frame(g, line, note, { states: { ...states }, marks, structure: { label: "Call stack (top on the right)", items: [...path] }, order: [...preorder] });

  const enter = (u: number) => {
    seen.add(u);
    preorder.push(u);
    const top = path[path.length - 1];
    if (top !== undefined) states[top] = "queued";
    path.push(u);
    states[u] = "cur";
  };
  const leave = (u: number) => {
    path.pop();
    states[u] = "done";
    const top = path[path.length - 1];
    if (top !== undefined) states[top] = "cur";
  };
  const visit = (u: number): void => {
    enter(u);
    const f = snap(1, `Enter ${u} and mark it seen.`);
    frames.push(f);
    for (const { v } of adj.get(u) ?? []) {
      marks.set(edgeKey(g, u, v), "cur");
      frames.push(snap(2, `Look at the edge from ${u} to ${v}.`));
      if (!seen.has(v)) {
        marks.set(edgeKey(g, u, v), "pick");
        frames.push(snap(3, `${v} is unseen, so recurse into it.`));
        visit(v);
      } else {
        marks.set(edgeKey(g, u, v), "skip");
        frames.push(snap(3, `${v} was already seen, so skip it.`));
      }
    }
    leave(u);
    frames.push(snap(4, `${u} has no unseen neighbours left, so it is finished and the call returns.`));
  };
  const frames: GraphStep[] = [snap(0, `Call dfs(${start}).`)];
  visit(start);
  return { kind: "graph", frames, result: `visit order ${preorder.join(" ")}` };
}

export function dijkstra(g: Graph, start: number): GraphGen {
  const adj = neighbours(g);
  const INF = Infinity;
  const dist: number[] = Array.from({ length: g.n }, (_, i) => (i === start ? 0 : INF));
  const settled = new Set<number>();
  const settledOrder: number[] = [];
  const marks = new Map<string, Mark>();
  const label = (d: number) => (d === INF ? "∞" : String(d));
  const stateMap = (cur: number | null): Record<number, St> => {
    const s: Record<number, St> = {};
    for (let i = 0; i < g.n; i++) {
      if (settled.has(i)) s[i] = "done";
      else if (i === cur) s[i] = "cur";
      else if (dist[i] !== INF) s[i] = "queued";
    }
    return s;
  };
  const snap = (line: number, note: string, cur: number | null = null) => {
    const text: Record<number, string> = {};
    dist.forEach((d, i) => { text[i] = `d=${label(d)}`; });
    return frame(g, line, note, { states: stateMap(cur), marks, text, showWeights: true, order: [...settledOrder] });
  };

  const f: GraphStep[] = [snap(0, `Set dist[${start}] = 0. Every other node starts at ∞.`)];
  let done = false;
  while (!done) {
    let best = -1;
    for (let i = 0; i < g.n; i++) {
      if (!settled.has(i) && dist[i] !== INF && (best < 0 || dist[i] < dist[best])) best = i;
    }
    if (best < 0) {
      f.push(snap(1, "No unsettled node has a finite distance, so the search is over."));
      done = true;
      break;
    }
    const u = best;
    settled.add(u);
    settledOrder.push(u);
    f.push(snap(2, `Settle ${u}. Its distance ${dist[u]} is the smallest among unsettled nodes, so it is final.`, u));
    for (const { v, w } of adj.get(u) ?? []) {
      marks.set(edgeKey(g, u, v), "cur");
      f.push(snap(3, `Edge ${u} to ${v} has weight ${w}. Check whether going through ${u} is shorter.`, u));
      const cand = dist[u] + w;
      if (cand < dist[v]) {
        const old = dist[v];
        dist[v] = cand;
        marks.set(edgeKey(g, u, v), "pick");
        f.push(snap(4, `${dist[u]} + ${w} = ${cand} beats ${label(old)}, so dist[${v}] = ${cand}.`, u));
      } else {
        marks.set(edgeKey(g, u, v), "skip");
        f.push(snap(4, `${cand} does not beat dist[${v}] = ${label(dist[v])}, so keep it.`, u));
      }
    }
  }
  const parts = dist.map((d, i) => `${i}:${label(d)}`);
  return { kind: "graph", frames: f, result: `distances ${parts.join(", ")}` };
}

/** Kahn's algorithm. Requires a directed graph. Nodes left unordered lie on a cycle or behind one. */
export function topoSort(g: Graph): GraphGen {
  const adj = neighbours(g);
  const indeg: number[] = Array.from({ length: g.n }, () => 0);
  for (const e of g.edges) indeg[e.v] += 1;
  const queue: number[] = [];
  for (let i = 0; i < g.n; i++) if (indeg[i] === 0) queue.push(i);
  const order: number[] = [];
  const finished = new Set<number>();
  const marks = new Map<string, Mark>();
  const text = () => {
    const t: Record<number, string> = {};
    indeg.forEach((d, i) => { t[i] = `in ${d}`; });
    return t;
  };
  const stateMap = (cur: number | null): Record<number, St> => {
    const s: Record<number, St> = {};
    for (const q of queue) s[q] = "queued";
    if (cur !== null) s[cur] = "cur";
    for (const d of finished) s[d] = "done";
    return s;
  };
  const snap = (line: number, note: string, cur: number | null = null) =>
    frame(g, line, note, { states: stateMap(cur), marks, text: text(), structure: { label: "Queue (front on the left)", items: [...queue] }, order: [...order] });

  const f: GraphStep[] = [snap(0, "Count the incoming edges of every node. Nodes with none can go first.")];
  while (queue.length > 0) {
    const u = queue.shift() ?? 0;
    order.push(u);
    f.push(snap(3, `Dequeue ${u} and append it to the order.`, u));
    finished.add(u);
    for (const { v } of adj.get(u) ?? []) {
      marks.set(edgeKey(g, u, v), "cur");
      indeg[v] -= 1;
      if (indeg[v] === 0) {
        queue.push(v);
        marks.set(edgeKey(g, u, v), "pick");
        f.push(snap(4, `Remove edge ${u} to ${v}. ${v} has no incoming edges left, so enqueue it.`, u));
      } else {
        marks.set(edgeKey(g, u, v), "skip");
        f.push(snap(4, `Remove edge ${u} to ${v}. ${v} still has ${indeg[v]} incoming edge${indeg[v] === 1 ? "" : "s"}.`, u));
      }
    }
  }
  if (order.length === g.n) {
    f.push(snap(5, `All ${g.n} nodes are ordered. Every edge points forward, so this is a valid topological order.`));
    return { kind: "graph", frames: f, result: `order ${order.join(" ")}` };
  }
  const stuck: number[] = [];
  for (let i = 0; i < g.n; i++) if (!finished.has(i)) stuck.push(i);
  f.push(snap(5, `Only ${order.length} of ${g.n} nodes were ordered. Nodes ${stuck.join(", ")} never reached zero incoming edges. They lie on a cycle or after one, so no valid order exists.`));
  return { kind: "graph", frames: f, result: `not ordered: nodes ${stuck.join(", ")} (cycle)` };
}

/** Bellman–Ford: relax every edge once per round. Negative weights are allowed; a change in round n reveals a reachable negative cycle. */
export function bellmanFord(g: Graph, start: number): GraphGen {
  const INF = Infinity;
  const dist: number[] = Array.from({ length: g.n }, (_, i) => (i === start ? 0 : INF));
  const arcs = g.directed ? g.edges : g.edges.flatMap((e) => [e, { u: e.v, v: e.u, w: e.w }]);
  const marks = new Map<string, Mark>();
  const label = (d: number) => (d === INF ? "∞" : String(d));
  const stateMap = (cur: number | null): Record<number, St> => {
    const s: Record<number, St> = {};
    for (let i = 0; i < g.n; i++) {
      if (i === cur) s[i] = "cur";
      else if (dist[i] !== INF) s[i] = "queued";
    }
    return s;
  };
  const snap = (line: number, note: string, cur: number | null = null) => {
    const text: Record<number, string> = {};
    dist.forEach((d, i) => { text[i] = `d=${label(d)}`; });
    return frame(g, line, note, { states: stateMap(cur), marks, text, showWeights: true });
  };
  const f: GraphStep[] = [snap(0, `Set dist[${start}] = 0. Every other node starts at ∞.`)];
  let stopped = false;
  for (let round = 1; round <= g.n - 1 && !stopped; round++) {
    f.push(snap(1, `Round ${round} of ${g.n - 1}: relax every edge once.`));
    let changed = false;
    for (const a of arcs) {
      marks.set(edgeKey(g, a.u, a.v), "cur");
      f.push(snap(2, `Edge ${a.u} to ${a.v}, weight ${a.w}.`, a.u));
      const cand = dist[a.u] + a.w;
      if (cand < dist[a.v]) {
        const old = dist[a.v];
        dist[a.v] = cand;
        changed = true;
        marks.set(edgeKey(g, a.u, a.v), "pick");
        f.push(snap(3, `${label(dist[a.u])} + ${a.w} = ${cand} beats ${label(old)}, so dist[${a.v}] = ${cand}.`, a.u));
      } else {
        marks.set(edgeKey(g, a.u, a.v), "skip");
        f.push(snap(3, `${label(cand)} does not beat dist[${a.v}] = ${label(dist[a.v])}.`, a.u));
      }
    }
    if (!changed) {
      stopped = true;
      f.push(snap(1, "No distance changed this round, so further rounds would change nothing."));
    }
  }
  let negative = false;
  for (const a of arcs) if (dist[a.u] + a.w < dist[a.v]) { negative = true; break; }
  f.push(snap(4, negative
    ? "One more relaxation still improves a distance, so a negative cycle is reachable from the start."
    : "No edge can be relaxed again, so these distances are final."));
  if (negative) return { kind: "graph", frames: f, result: "negative cycle reachable" };
  return { kind: "graph", frames: f, result: `distances ${dist.map((d, i) => `${i}:${label(d)}`).join(", ")}` };
}
