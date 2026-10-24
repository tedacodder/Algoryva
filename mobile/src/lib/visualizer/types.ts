import type { Frame, GraphFrame, GridFrame } from "../viz/steps";

export type Category = "arrays" | "sorting" | "structures" | "trees" | "graphs" | "dp" | "techniques";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "arrays", label: "Arrays and searching" },
  { id: "sorting", label: "Sorting" },
  { id: "structures", label: "Stacks, queues and Fenwick tree" },
  { id: "trees", label: "Trees and tries" },
  { id: "graphs", label: "Graphs" },
  { id: "dp", label: "Dynamic programming" },
  { id: "techniques", label: "Greedy and backtracking" },
];

/** One frame of an array visualization. `line` is the index of the pseudocode line the frame describes. */
export type Step = Frame & { line: number };
/** One frame of a tree or graph visualization, with the same pseudocode link. */
export type GraphStep = GraphFrame & { line: number };
/** One frame of a DP table, with the same pseudocode link. */
export type GridStep = GridFrame & { line: number };

export type ArrayGen = { kind: "array"; frames: Step[]; result: string };
export type GraphGen = { kind: "graph"; frames: GraphStep[]; result: string };
export type GridGen = { kind: "grid"; frames: GridStep[]; result: string };
export type Gen = ArrayGen | GraphGen | GridGen;

export type RunOutcome = { ok: true; gen: Gen } | { ok: false; error: string };

/** A user-editable input. `key` is the name the algorithm's run function reads from its raw values. */
export type Field = { key: string; label: string; help: string; placeholder: string };
export type Preset = { label: string; values: Record<string, string> };

/** A stack or queue operation. `arg` is present only for operations that take a value. */
export type Op = { name: string; arg?: number };

/** A weighted edge between node indices 0..n-1. */
export type Edge = { u: number; v: number; w: number };

export type Algorithm = {
  id: string;
  title: string;
  category: Category;
  summary: string;
  /** A precondition the input must meet. The visualizer rejects inputs that break it. */
  precondition?: string;
  complexity: { time: string; space: string; note?: string };
  /** Pseudocode lines. Generator frames refer to these by index. */
  pseudocode: string[];
  fields: Field[];
  presets: Preset[];
  /** Lesson slug under /learn that explains this algorithm. */
  lessonSlug?: string;
  /** Parses the raw input, validates it, and builds the frames by running the algorithm. Never evaluates user code. */
  run: (raw: Record<string, string>) => RunOutcome;
};
