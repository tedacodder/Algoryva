import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isOpenableLink, platformOf } from "./platform";

describe("practice platform", () => {
  it("names LeetCode, Codeforces and HackerRank, with or without www", () => {
    assert.equal(platformOf("https://leetcode.com/problems/two-sum/")?.name, "LeetCode");
    assert.equal(platformOf("https://www.codeforces.com/problemset/problem/1/A")?.name, "Codeforces");
    assert.equal(platformOf("https://hackerrank.com/challenges/x")?.name, "HackerRank");
  });
  it("shows any other https site by its host", () => {
    assert.equal(platformOf("https://example.org/p/1")?.name, "example.org");
  });
  it("refuses links that are not https, malformed, or missing", () => {
    assert.equal(platformOf("http://leetcode.com/problems/x"), null);
    assert.equal(platformOf("javascript:alert(1)"), null);
    assert.equal(platformOf("not a url"), null);
    assert.equal(platformOf(null), null);
    assert.equal(isOpenableLink("http://leetcode.com"), false);
    assert.equal(isOpenableLink("https://leetcode.com"), true);
  });
});
