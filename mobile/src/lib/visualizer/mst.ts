import { edgeKey, frame, neighbours, type Graph, type Mark, type St } from "./graphs";
import type { GraphGen, GraphStep } from "./types";

/** Kruskal: take edges lightest first, skipping any edge whose ends are already connected. */
export function kruskal(g: Graph): GraphGen {
  const order = g.edges.map((e, i) => ({ ...e, i })).sort((p, q) => p.w - q.w || p.i - q.i);
  const parent = Array.from({ length: g.n }, (_, i) => i);
  const root = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    return r;
  };
  const marks = new Map<string, Mark>();
  let total = 0;
  const text = () => {
    const t: Record<number, string> = {};
    for (let i = 0; i < g.n; i++) t[i] = `c${root(i)}`;
    return t;
  };
  const snap = (line: number, note: string) =>
    frame(g, line, note, { marks, text: text(), structure: { label: "Total weight so far", items: [total] }, showWeights: true });

  const f: GraphStep[] = [snap(0, "Sort the edges from lightest to heaviest. Each node starts in its own component.")];
  for (const e of order) {
    marks.set(edgeKey(g, e.u, e.v), "cur");
    f.push(snap(1, `Next lightest edge: ${e.u} to ${e.v}, weight ${e.w}.`));
    const ru = root(e.u);
    const rv = root(e.v);
    if (ru !== rv) {
      parent[ru] = rv;
      total += e.w;
      marks.set(edgeKey(g, e.u, e.v), "pick");
      f.push(snap(2, `${e.u} and ${e.v} are in different components, so take the edge. Total is now ${total}.`));
    } else {
      marks.set(edgeKey(g, e.u, e.v), "skip");
      f.push(snap(3, `${e.u} and ${e.v} are already connected. Taking this edge would close a cycle, so skip it.`));
    }
  }
  const components = new Set(Array.from({ length: g.n }, (_, i) => root(i))).size;
  if (components === 1) {
    f.push(snap(4, `Done. The spanning tree has weight ${total}.`));
    return { kind: "graph", frames: f, result: `total ${total}` };
  }
  f.push(snap(4, `Done. The graph is not connected, so this is a spanning forest with weight ${total}.`));
  return { kind: "graph", frames: f, result: `total ${total} (not connected)` };
}

/** Prim: grow one tree from the start, each round adding the cheapest edge that leaves it. */
export function prim(g: Graph, start: number): GraphGen {
  const inTree = new Set<number>([start]);
  const states: Record<number, St> = { [start]: "done" };
  const marks = new Map<string, Mark>();
  let total = 0;
  const snap = (line: number, note: string) =>
    frame(g, line, note, { states: { ...states }, marks, structure: { label: "Total weight so far", items: [total] }, showWeights: true });

  const f: GraphStep[] = [snap(0, `Start the tree at node ${start}.`)];
  while (inTree.size < g.n) {
    const cands = g.edges.filter((e) => inTree.has(e.u) !== inTree.has(e.v));
    if (cands.length === 0) {
      f.push(snap(3, `No edge leaves the tree, so the graph is not connected. Stop with ${inTree.size} of ${g.n} nodes.`));
      break;
    }
    for (const e of cands) marks.set(edgeKey(g, e.u, e.v), "cur");
    f.push(snap(2, `Scan the ${cands.length} edge${cands.length === 1 ? "" : "s"} that leave the tree.`));
    let best = cands[0];
    for (const e of cands) if (e.w < best.w) best = e;
    for (const e of cands) marks.set(edgeKey(g, e.u, e.v), e === best ? "pick" : "skip");
    const v = inTree.has(best.u) ? best.v : best.u;
    inTree.add(v);
    states[v] = "done";
    total += best.w;
    f.push(snap(4, `The cheapest is ${best.u}-${best.v} with weight ${best.w}. Add node ${v} and this edge. Total is now ${total}.`));
  }
  if (inTree.size === g.n) return { kind: "graph", frames: f, result: `total ${total}` };
  return { kind: "graph", frames: f, result: `not connected: total ${total} for ${inTree.size} of ${g.n} nodes` };
}

/** Connected components: explore from each unlabelled node, labelling everything reached. */
export function components(g: Graph): GraphGen {
  const adj = neighbours(g);
  const label: number[] = Array.from({ length: g.n }, () => -1);
  const states: Record<number, St> = {};
  const text = () => {
    const t: Record<number, string> = {};
    for (let i = 0; i < g.n; i++) t[i] = label[i] === -1 ? "" : `#${label[i]}`;
    return t;
  };
  const snap = (line: number, note: string) => frame(g, line, note, { states: { ...states }, text: text() });

  const f: GraphStep[] = [snap(0, "No node has a component yet. Go through the nodes in order.")];
  const groups: number[][] = [];
  let comp = 0;
  for (let s = 0; s < g.n; s++) {
    if (label[s] !== -1) continue;
    comp += 1;
    label[s] = comp;
    states[s] = "cur";
    const members = [s];
    f.push(snap(2, `Node ${s} has no component yet. Start component ${comp} here.`));
    const queue = [s];
    while (queue.length > 0) {
      const u = queue.shift() ?? s;
      for (const { v } of adj.get(u) ?? []) {
        if (label[v] !== -1) continue;
        label[v] = comp;
        queue.push(v);
        members.push(v);
        states[v] = "queued";
        f.push(snap(3, `Reach ${v} from ${u}. It joins component ${comp}.`));
      }
      states[u] = "done";
    }
    groups.push(members.sort((p, q) => p - q));
  }
  f.push(snap(4, `${comp} component${comp === 1 ? "" : "s"} found.`));
  return { kind: "graph", frames: f, result: `${comp} components: ${groups.map((m) => `{${m.join(",")}}`).join(" ")}` };
}
