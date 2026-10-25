import type { Cell } from "../viz/steps";
import { at, type M } from "./arrays";
import type { ArrayGen, GridGen, GridStep, Step } from "./types";
import { grid } from "./dp";

/**
 * N-Queens by backtracking: place one queen per row, try each column, and undo a placement when
 * the search below it has been fully explored. Every column tried is shown, including the attacked ones.
 */
export function nQueens(n: number): GridGen {
  const labels: Cell[] = Array.from({ length: n }, (_, i) => i);
  const board: (Cell | null)[][] = Array.from({ length: n }, () => Array.from({ length: n }, (): Cell | null => null));
  const colOf: number[] = Array.from({ length: n }, () => -1);
  const f: GridStep[] = [];
  const solutions: number[][] = [];
  const snap = (line: number, note: string, active?: [number, number], deps?: [number, number][]) =>
    grid(labels, labels, board.map((r) => r.slice()), line, note, active, deps);

  /** The first queen (above `row`) that attacks (row, col), or null when the square is safe. */
  const attacker = (row: number, col: number): [number, number] | null => {
    for (let r = 0; r < row; r++) {
      const c = colOf[r];
      if (c === col || Math.abs(row - r) === Math.abs(col - c)) return [r, c];
    }
    return null;
  };

  const solve = (row: number): void => {
    if (row === n) {
      solutions.push([...colOf]);
      f.push(snap(1, `All ${n} queens are placed. That is solution ${solutions.length}.`));
      return;
    }
    for (let col = 0; col < n; col++) {
      const bad = attacker(row, col);
      if (bad) {
        f.push(snap(4, `(${row}, ${col}) is attacked by the queen at (${bad[0]}, ${bad[1]}). Skip this column.`, [row, col], [bad]));
        continue;
      }
      colOf[row] = col;
      board[row][col] = "Q";
      f.push(snap(3, `(${row}, ${col}) is safe. Place a queen and move to row ${row + 1}.`, [row, col]));
      solve(row + 1);
      board[row][col] = null;
      colOf[row] = -1;
      f.push(snap(3, `Backtrack: remove the queen at (${row}, ${col}) and try the next column.`, [row, col]));
    }
  };

  f.push(snap(0, `Solve row 0 of a ${n} by ${n} board.`));
  solve(0);
  const result = solutions.length === 0 ? `no solutions for ${n}` : `${solutions.length} solution${solutions.length === 1 ? "" : "s"}`;
  f.push(snap(0, solutions.length === 0 ? `The search found no placement for all ${n} queens.` : `The search is finished: ${result}.`));
  return { kind: "grid", frames: f, result };
}

/**
 * Subset sum by backtracking: for each value, try including it, then try excluding it.
 * A branch is pruned as soon as the running sum exceeds the target (values must be positive).
 */
export function subsetSum(a: number[], target: number): ArrayGen {
  const n = a.length;
  const chosen: boolean[] = a.map(() => false);
  const found: number[][] = [];
  const f: Step[] = [];
  const sumNow = () => a.reduce((s, v, i) => (chosen[i] ? s + v : s), 0);
  const view = (line: number, note: string, cur: number | null) => {
    const marks: M[] = [];
    if (cur !== null) marks.push([cur, "cur"]);
    a.forEach((_, i) => { if (chosen[i]) marks.push([i, "hit"]); });
    f.push(at(a, line, note, marks, { structure: { label: "Chosen sum", items: [String(sumNow())] } }));
  };
  const search = (i: number, s: number): void => {
    if (s === target) {
      found.push(a.map((_, k) => k).filter((k) => chosen[k]));
      view(1, `The sum ${s} equals the target ${target}. Record this subset.`, null);
      return;
    }
    if (i === n || s > target) {
      view(2, i === n ? `No values are left and the sum is ${s}. Undo the last choice.` : `The sum ${s} is already above ${target}, so no extension can work. Prune.`, null);
      return;
    }
    view(3, `Try including a[${i}] = ${a[i]}.`, i);
    chosen[i] = true;
    search(i + 1, s + a[i]);
    chosen[i] = false;
    view(4, `Undo: now try skipping a[${i}] = ${a[i]}.`, i);
    search(i + 1, s);
  };
  search(0, 0);
  const result = found.length === 0 ? `no subset sums to ${target}` : `${found.length} subset${found.length === 1 ? "" : "s"} sum to ${target}`;
  view(0, result[0].toUpperCase() + result.slice(1) + ".", null);
  return { kind: "array", frames: f, result };
}
