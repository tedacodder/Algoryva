import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EDITOR_SNIPPETS } from "./editorSnippets";

describe("editor snippets", () => {
  it("have unique labels and a non-empty body", () => {
    const labels = EDITOR_SNIPPETS.map((s) => s.label);
    assert.equal(new Set(labels).size, labels.length);
    for (const s of EDITOR_SNIPPETS) assert.ok(s.apply.trim().length > 0, s.label);
  });
  it("every snippet is valid Python (when python3 is installed)", () => {
    let hasPython = true;
    try {
      execFileSync("python3", ["--version"], { stdio: "ignore" });
    } catch {
      hasPython = false;
    }
    if (!hasPython) return;
    for (const s of EDITOR_SNIPPETS) {
      const code = JSON.stringify(s.apply);
      execFileSync("python3", ["-c", `compile(${code}, "<snippet>", "exec")`], { stdio: "ignore" });
    }
  });
});
