import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRandom, parseHandle, parseNotify, errorText, GENERIC } from "../src/texts.js";
import { toHtml } from "../src/render.js";

test("random defaults to 800-2000 with no tags", () => {
  assert.deepEqual(parseRandom(""), { minRating: 800, maxRating: 2000, tags: [] });
});

test("random reads a band, a single rating, and tags in any order", () => {
  assert.deepEqual(parseRandom("1200-1600 dp GRAPHS"), { minRating: 1200, maxRating: 1600, tags: ["dp", "graphs"] });
  assert.deepEqual(parseRandom("1400"), { minRating: 1300, maxRating: 1500, tags: [] });
  assert.deepEqual(parseRandom("dfs-and-similar"), { minRating: 800, maxRating: 2000, tags: ["dfs-and-similar"] });
});

test("random refuses bad input with a message a user can act on", () => {
  assert.throws(() => parseRandom("1600-1200"), /must not be above/);
  assert.throws(() => parseRandom("dp;drop"), /not a valid tag/);
  assert.throws(() => parseRandom("a1 b2 c3 d4 e5 f6"), /at most 5/);
});

test("handles and notify options are strict", () => {
  assert.equal(parseHandle("@Tourist"), "Tourist");
  assert.equal(parseHandle("ab"), null);
  assert.equal(parseHandle("bad handle!"), null);
  assert.deepEqual(parseNotify("daily on"), ["daily", true]);
  assert.equal(parseNotify("all on"), null);
});

test("unknown website errors never show the raw code", () => {
  assert.equal(errorText("something_unexpected"), GENERIC);
  assert.ok(!errorText("handle_not_found").includes("handle_not_found"));
});

test("rendering escapes user text and bolds labels", () => {
  assert.ok(toHtml("<script>x</script>").includes("&lt;script&gt;"));
  assert.ok(toHtml("⭐ Rating 1100").includes("<b>Rating</b> <code>1100</code>"));
  assert.ok(toHtml("Title line\nbody").startsWith("<b>Title line</b>"));
});

import { parseRoster, parseSetDaily, formatReport } from "../src/texts.js";

test("roster accepts spaces or commas, and rejects bad handles", () => {
  assert.deepEqual(parseRoster("set tourist, jiangly  ksun48"), { action: "set", handles: ["tourist", "jiangly", "ksun48"] });
  assert.deepEqual(parseRoster(""), { action: "list", handles: [] });
  assert.throws(() => parseRoster("set bad handle!"), /not a valid handle/);
  assert.throws(() => parseRoster("explode tourist"), /Use: \/roster/);
});

test("setdaily accepts 1800C, 1800/C, a Codeforces link, or reset", () => {
  assert.deepEqual(parseSetDaily("1800C"), { problem: "1800/C" });
  assert.deepEqual(parseSetDaily("1800/c"), { problem: "1800/C" });
  assert.deepEqual(parseSetDaily("https://codeforces.com/problemset/problem/1800/C"), { problem: "1800/C" });
  assert.deepEqual(parseSetDaily("https://codeforces.com/contest/1800/problem/C2"), { problem: "1800/C2" });
  assert.deepEqual(parseSetDaily("reset"), { problem: null });
  assert.throws(() => parseSetDaily("banana"), /Use: \/setdaily/);
});

test("the report lists solved, unsolved, not-registered and pending, and says what solved means", () => {
  const text = formatReport({
    problem: { ref: "1800/A", name: "Easy One" }, rosterCount: 4, registered: 3,
    notRegistered: ["carol"], solved: ["alice"], unsolved: ["bob"], pending: ["dan"], usesConnectedFallback: false,
  });
  assert.match(text, /Easy One \(1800\/A\)/);
  assert.match(text, /3\/4 registered/);
  assert.match(text, /Solved \(1\): alice/);
  assert.match(text, /Not solved yet \(1\): bob/);
  assert.match(text, /Not registered \(1\): carol/);
  assert.match(text, /Still being checked \(1\): dan/);
  assert.match(text, /any time/);
});

test("a report with no roster says it is showing students who ran /connect here", () => {
  const text = formatReport({ problem: null, rosterCount: 0, registered: 2, notRegistered: [], solved: [], unsolved: [], pending: [], usesConnectedFallback: true });
  assert.match(text, /no roster set/);
  assert.match(text, /none today yet/);
});

test("a long list is shortened so one message stays readable", () => {
  const many = Array.from({ length: 60 }, (_, i) => `student${i}`);
  const text = formatReport({ problem: null, rosterCount: 60, registered: 60, notRegistered: [], solved: [], unsolved: many, pending: [], usesConnectedFallback: false });
  assert.match(text, /and 20 more/);
});
