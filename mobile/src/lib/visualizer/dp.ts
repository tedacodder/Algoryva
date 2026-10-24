import type { Cell } from "../viz/steps";
import type { GridGen, GridStep } from "./types";

type Cells = (Cell | null)[][];

/** Builds one table frame. Every DP generator goes through here. */
export function grid(rowLabels: Cell[], colLabels: Cell[], cells: Cells, line: number, note: string, active?: [number, number], deps?: [number, number][]): GridStep {
  return { rowLabels: [...rowLabels], colLabels: [...colLabels], cells: cells.map((r) => [...r]), line, note, active, deps };
}

/** ways[i] = ways[i-1] + ways[i-2]: the number of ways to climb to step n taking 1 or 2 steps at a time. */
export function climbingStairs(n: number): GridGen {
  const cols: Cell[] = Array.from({ length: n + 1 }, (_, i) => i);
  const ways: (number | null)[] = Array.from({ length: n + 1 }, () => null);
  const snap = (line: number, note: string, active?: [number, number], deps?: [number, number][]) =>
    grid(["ways"], cols, [ways.slice()], line, note, active, deps);
  ways[0] = 1;
  const f: GridStep[] = [snap(0, "ways[0] = 1: there is one way to stand at the start.", [0, 0])];
  if (n >= 1) {
    ways[1] = 1;
    f.push(snap(0, "ways[1] = 1: there is one way to reach step 1.", [0, 1]));
  }
  for (let i = 2; i <= n; i++) {
    const a = ways[i - 1] ?? 0;
    const b = ways[i - 2] ?? 0;
    ways[i] = a + b;
    f.push(snap(2, `ways[${i}] = ways[${i - 1}] + ways[${i - 2}] = ${a} + ${b} = ${ways[i]}.`, [0, i], [[0, i - 1], [0, i - 2]]));
  }
  f.push(snap(3, `Answer: ${ways[n]} ways to reach step ${n}.`, [0, n]));
  return { kind: "grid", frames: f, result: `${ways[n]} ways` };
}

/** dp[a] = fewest coins that sum to a. Unreachable amounts stay ∞. */
export function coinChange(coins: number[], amount: number): GridGen {
  const INF = Infinity;
  const dp: number[] = Array.from({ length: amount + 1 }, (_, a) => (a === 0 ? 0 : INF));
  const cols: Cell[] = Array.from({ length: amount + 1 }, (_, a) => a);
  const show = (upto: number): Cells => [Array.from({ length: amount + 1 }, (_, a): Cell | null => (a > upto ? null : dp[a] === INF ? "∞" : dp[a]))];
  const snap = (line: number, note: string, upto: number, active?: [number, number], deps?: [number, number][]) =>
    grid(["dp"], cols, show(upto), line, note, active, deps);
  const f: GridStep[] = [snap(0, "dp[0] = 0: zero coins make amount 0. Other amounts start at ∞.", 0, [0, 0])];
  for (let a = 1; a <= amount; a++) {
    f.push(snap(1, `Find dp[${a}], the fewest coins that make ${a}.`, a - 1, [0, a]));
    let usable = 0;
    for (const c of coins) {
      if (c > a) continue;
      usable++;
      const prev = dp[a - c];
      const cand = prev === INF ? INF : prev + 1;
      const old = dp[a];
      if (cand < dp[a]) dp[a] = cand;
      const candText = cand === INF ? "∞" : String(cand);
      const oldText = old === INF ? "∞" : String(old);
      f.push(snap(3, `Coin ${c}: dp[${a - c}] + 1 = ${candText}. ${cand < old ? `That beats ${oldText}, so dp[${a}] = ${candText}.` : `dp[${a}] stays ${oldText}.`}`, a, [0, a], [[0, a - c]]));
    }
    if (usable === 0) f.push(snap(3, `No coin is at most ${a}, so dp[${a}] stays ∞.`, a, [0, a]));
  }
  const result = dp[amount] === INF ? "impossible" : `${dp[amount]} coins`;
  f.push(snap(4, dp[amount] === INF ? `Answer: amount ${amount} cannot be made from these coins.` : `Answer: ${dp[amount]} coins make ${amount}.`, amount, [0, amount]));
  return { kind: "grid", frames: f, result };
}

/** dp[i][j] = LCS length of the first i characters of s and the first j of t. */
export function lcs(s: string, t: string): GridGen {
  const m = s.length;
  const n = t.length;
  const dp: (number | null)[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, (): number | null => null));
  const rowLabels: Cell[] = ["", ...s.split("")];
  const colLabels: Cell[] = ["", ...t.split("")];
  const snap = (line: number, note: string, active?: [number, number], deps?: [number, number][]) =>
    grid(rowLabels, colLabels, dp.map((r) => r.slice()), line, note, active, deps);
  for (let i = 0; i <= m; i++) dp[i][0] = 0;
  for (let j = 0; j <= n; j++) dp[0][j] = 0;
  const f: GridStep[] = [snap(0, "An empty prefix shares nothing with anything, so the first row and column are 0.")];
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const a = s[i - 1];
      const b = t[j - 1];
      if (a === b) {
        const diag = dp[i - 1][j - 1] ?? 0;
        dp[i][j] = diag + 1;
        f.push(snap(3, `${a} matches ${b}, so dp[${i}][${j}] = dp[${i - 1}][${j - 1}] + 1 = ${dp[i][j]}.`, [i, j], [[i - 1, j - 1]]));
      } else {
        const up = dp[i - 1][j] ?? 0;
        const left = dp[i][j - 1] ?? 0;
        dp[i][j] = Math.max(up, left);
        f.push(snap(4, `${a} and ${b} differ, so take the larger of up (${up}) and left (${left}).`, [i, j], [[i - 1, j], [i, j - 1]]));
      }
    }
  }
  const answer = dp[m][n] ?? 0;
  f.push(snap(5, `Answer: the longest common subsequence has length ${answer}.`, [m, n]));
  return { kind: "grid", frames: f, result: `length ${answer}` };
}

/** dp[i][w] = best value using the first i items with capacity w. Each item is used at most once. */
export function knapsack(weights: number[], values: number[], cap: number): GridGen {
  const k = weights.length;
  const dp: (number | null)[][] = Array.from({ length: k + 1 }, () => Array.from({ length: cap + 1 }, (): number | null => null));
  const rowLabels: Cell[] = ["none", ...weights.map((w, i) => `${i + 1}: w${w} v${values[i]}`)];
  const colLabels: Cell[] = Array.from({ length: cap + 1 }, (_, c) => c);
  const snap = (line: number, note: string, active?: [number, number], deps?: [number, number][]) =>
    grid(rowLabels, colLabels, dp.map((r) => r.slice()), line, note, active, deps);
  for (let w = 0; w <= cap; w++) dp[0][w] = 0;
  const f: GridStep[] = [snap(0, "With no items to choose from, every capacity is worth 0.")];
  for (let i = 1; i <= k; i++) {
    const wi = weights[i - 1];
    const vi = values[i - 1];
    for (let w = 0; w <= cap; w++) {
      const skip = dp[i - 1][w] ?? 0;
      if (wi <= w) {
        const take = (dp[i - 1][w - wi] ?? 0) + vi;
        dp[i][w] = Math.max(skip, take);
        f.push(snap(4, `Item ${i} (weight ${wi}, value ${vi}) fits in capacity ${w}. Skipping gives ${skip}, taking gives ${take}, so the best is ${dp[i][w]}.`, [i, w], [[i - 1, w], [i - 1, w - wi]]));
      } else {
        dp[i][w] = skip;
        f.push(snap(3, `Item ${i} is too heavy for capacity ${w}, so the best stays ${skip}.`, [i, w], [[i - 1, w]]));
      }
    }
  }
  const best = dp[k][cap] ?? 0;
  f.push(snap(5, `Answer: the best value with capacity ${cap} is ${best}.`, [k, cap]));
  return { kind: "grid", frames: f, result: `best value ${best}` };
}

/** Floyd–Warshall: dist[i][j] is the shortest distance using only intermediate nodes 0..k. Negative weights are allowed without negative cycles. */
export function floyd(g: { n: number; edges: { u: number; v: number; w: number }[]; directed: boolean }): GridGen {
  const n = g.n;
  const INF = Infinity;
  const d: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)));
  for (const e of g.edges) {
    d[e.u][e.v] = Math.min(d[e.u][e.v], e.w);
    if (!g.directed) d[e.v][e.u] = Math.min(d[e.v][e.u], e.w);
  }
  const lab = (x: number): Cell => (x === INF ? "∞" : x);
  const labels: Cell[] = Array.from({ length: n }, (_, i) => i);
  const show = (): Cells => d.map((r) => r.map((x) => lab(x)));
  const snap = (line: number, note: string, active?: [number, number], deps?: [number, number][]) =>
    grid(labels, labels, show(), line, note, active, deps);
  const f: GridStep[] = [snap(0, "Start with the direct edge weights. dist[i][i] = 0, and a missing edge is ∞.")];
  for (let k = 0; k < n; k++) {
    f.push(snap(1, `Allow node ${k} as a stop-over for every pair.`));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const via = d[i][k] + d[k][j];
        const old = d[i][j];
        const deps: [number, number][] = [[i, k], [k, j]];
        if (via < old) {
          d[i][j] = via;
          f.push(snap(2, `Through ${k}: ${lab(d[i][k])} + ${lab(d[k][j])} = ${lab(via)} beats ${lab(old)}, so dist[${i}][${j}] = ${lab(via)}.`, [i, j], deps));
        } else {
          f.push(snap(2, `Through ${k} gives ${lab(via)}, which does not beat ${lab(old)}.`, [i, j], deps));
        }
      }
    }
  }
  const negative = d.some((row, i) => row[i] < 0);
  f.push(snap(3, negative ? "Some dist[i][i] is negative, so there is a negative cycle." : "All pairs are done. Each cell is the shortest distance between its row and column."));
  if (negative) return { kind: "grid", frames: f, result: "negative cycle" };
  return { kind: "grid", frames: f, result: "all-pairs distances ready" };
}
