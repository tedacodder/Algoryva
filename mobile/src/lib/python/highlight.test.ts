import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../highlight";

/** The colours are drawn over the typed text, so the tokens must rebuild the code exactly, character for character. */
describe("editor highlighting keeps every character", () => {
  const samples = [
    "print('hi')\n",
    "def f(x):\n    return x * 2  # double\n",
    "name = input(\"Your name: \")\nfor i in range(3):\n    print(f\"Hello {name} {i + 1}\")\n",
    "",
    "tabs\there\r\nand unicode café ✓\n",
  ];
  for (const code of samples) {
    it(`round-trips ${JSON.stringify(code.slice(0, 24))}`, () => {
      assert.equal(tokenize(code).map((t) => t.v).join(""), code);
    });
  }
});
