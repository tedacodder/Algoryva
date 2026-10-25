import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VIZ_IDS, vizById } from "./index";
import { ALGORITHMS, defaultsOf, runAlgorithm } from "../visualizer/registry";
import type { Frame, GraphFrame, GridFrame } from "./steps";

/** Every frame must be drawable: indices in range, graph edges and states refer to real nodes, grids are rectangular. */
function checkArrayFrame(f: Frame, where: string) {
  const n = f.values.length;
  assert.equal(typeof f.note, "string", `${where}: note`);
  for (const k of Object.keys(f.marks)) assert.ok(Number(k) >= 0 && Number(k) < n + 1, `${where}: mark index ${k} out of range (n=${n})`);
  for (const i of f.dim ?? []) assert.ok(i >= 0 && i < n, `${where}: dim index ${i} out of range`);
  for (const a of f.aux ?? []) assert.equal(a.values.length >= 0, true, `${where}: aux`);
}
function checkGraphFrame(f: GraphFrame, where: string) {
  const ids = new Set(f.nodes.map((n) => n.id));
  for (const e of f.edges) {
    assert.ok(ids.has(e.a) && ids.has(e.b), `${where}: edge ${e.a}-${e.b} refers to a missing node`);
  }
  for (const id of Object.keys(f.state)) assert.ok(ids.has(id), `${where}: state for missing node ${id}`);
  for (const id of Object.keys(f.text)) assert.ok(ids.has(id), `${where}: text for missing node ${id}`);
  for (const n of f.nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), `${where}: node ${n.id} has no position`);
}
function checkGridFrame(f: GridFrame, where: string) {
  const rows = f.cells.length;
  const cols = f.colLabels.length;
  assert.equal(f.rowLabels.length, rows, `${where}: row labels vs rows`);
  for (const r of f.cells) assert.equal(r.length, cols, `${where}: ragged grid (expected ${cols} columns)`);
  if (f.active) assert.ok(f.active[0] < rows && f.active[1] < cols, `${where}: active cell out of range`);
}

describe("every lesson visualization produces drawable frames", () => {
  for (const id of VIZ_IDS) {
    it(id, () => {
      const v = vizById(id);
      assert.ok(v, `${id} did not resolve`);
      assert.ok(v.frames.length > 0, `${id} has no frames`);
      v.frames.forEach((f, i) => {
        const where = `${id}[${i}]`;
        if (v.kind === "array") checkArrayFrame(f as Frame, where);
        else if (v.kind === "graph") checkGraphFrame(f as GraphFrame, where);
        else checkGridFrame(f as GridFrame, where);
      });
    });
  }
});

describe("every interactive algorithm runs with its example input", () => {
  for (const algo of ALGORITHMS) {
    it(algo.id, () => {
      const out = runAlgorithm(algo, defaultsOf(algo));
      assert.equal(out.ok, true, out.ok ? "" : out.error);
      if (!out.ok) return;
      assert.ok(out.gen.frames.length > 0, `${algo.id} produced no frames`);
      out.gen.frames.forEach((f, i) => {
        const where = `${algo.id}[${i}]`;
        assert.ok(Number.isInteger(f.line) && f.line >= 0 && f.line < algo.pseudocode.length, `${where}: pseudocode line ${f.line} out of range`);
        if (out.gen.kind === "array") checkArrayFrame(f as Frame, where);
        else if (out.gen.kind === "graph") checkGraphFrame(f as GraphFrame, where);
        else checkGridFrame(f as GridFrame, where);
      });
    });
  }
});
