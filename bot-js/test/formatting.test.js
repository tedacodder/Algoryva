import { test } from "node:test";
import assert from "node:assert/strict";
import { localStamp, utcStamp, timeLeft, problemHtml, contestsHtml, nextContestHtml, reportHtml, durationText } from "../src/formatting.js";
import { toHtml } from "../src/render.js";

const T1430 = Date.parse("2026-10-27T14:35:00Z") / 1000;

test("local time is Ethiopian time (UTC+3), shown with the UTC time", () => {
  assert.match(localStamp(T1430), /17:35 EAT$/);
  assert.match(utcStamp(T1430), /14:35 UTC$/);
});

test("time left and duration read naturally", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  assert.equal(timeLeft(T1430, now), "2h 35m");
  assert.equal(timeLeft(T1430, new Date("2026-10-27T15:00:00Z")), "already started");
  assert.equal(durationText(7200), "2h 0m");
});

test("contests are listed soonest first, each in its own quote", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  const later = { id: 2, name: "Later Round", startTimeSeconds: T1430 + 86400, durationSeconds: 7200, url: "https://codeforces.com/contests/2" };
  const sooner = { id: 1, name: "Sooner Round", startTimeSeconds: T1430, durationSeconds: 7200, url: "https://codeforces.com/contests/1" };
  const html = contestsHtml([later, sooner], now);
  assert.ok(html.indexOf("Sooner Round") < html.indexOf("Later Round"));
  assert.match(html, /<blockquote>/);
  assert.match(html, /Starts in <b>2h 35m<\/b>/);
  assert.match(html, /17:35 EAT/);
});

test("the next contest warns inside the last two hours", () => {
  const c = { id: 1, name: "Round", startTimeSeconds: T1430, durationSeconds: 7200, url: "https://codeforces.com/contests/1" };
  assert.match(nextContestHtml(c, new Date("2026-10-27T13:00:00Z")), /Less than two hours/);
  assert.doesNotMatch(nextContestHtml(c, new Date("2026-10-27T10:00:00Z")), /Less than two hours/);
});

test("a problem is a quote with its tags behind a spoiler, and names are escaped", () => {
  const html = problemHtml({ name: "<script>x</script>", rating: 1100, tags: ["greedy", "sortings"], url: "https://codeforces.com/problemset/problem/1800/C" }, { header: "Brain teaser", personalized: true });
  assert.match(html, /<blockquote>/);
  assert.match(html, /<tg-spoiler>#greedy #sortings<\/tg-spoiler>/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /skipped for you/);
});

test("the report puts each group of students in a quote", () => {
  const html = reportHtml({ problem: { ref: "1800/A", name: "Easy" }, rosterCount: 2, registered: 2, notRegistered: [], solved: ["alice"], unsolved: ["bob"], pending: [], usesConnectedFallback: false });
  assert.match(html, /Class report/);
  assert.match(html, /<code>alice<\/code>/);
  assert.match(html, /<blockquote>/);
});

test("scheduled messages get the same spoiler on their tags", () => {
  assert.match(toHtml("⭐ Rating 1100   🏷️ #greedy #sortings"), /<tg-spoiler>#greedy #sortings<\/tg-spoiler>/);
});

import { commandCardHtml, helpIndexHtml, leaderboardHtml, leaderboardCheckingHtml, progressBar } from "../src/formatting.js";
import { commandByName } from "../src/commands.js";

const ROWS = [
  { rank: 1, handle: "tourist", rating: 3900, solved: 12, activeDays: 6, consistency: 86, score: 24 },
  { rank: 2, handle: "jiangly", rating: null, solved: 5, activeDays: 2, consistency: 29, score: 9 },
];
const DATA = { period: "week", rows: ROWS, rosterCount: 3, registered: 2, notRegistered: ["ksun48"], pending: [], checkedAt: "2026-10-31T12:00:00.000Z" };

test("the leaderboard is a table with medals, and every handle appears in it", () => {
  const html = leaderboardHtml(DATA);
  assert.match(html, /<pre>/);
  assert.ok(html.includes("🥇  tourist"));
  assert.ok(html.includes("🥈  jiangly"));
  assert.match(html, /—/); // an unrated member shows a dash, not "null"
  assert.doesNotMatch(html, /null/);
});

test("the leaderboard explains the score, and lists the members still being checked", () => {
  const html = leaderboardHtml({ ...DATA, pending: ["amy"] });
  assert.match(html, /Score = solved \+ 2 × active days/);
  assert.match(html, /Still being checked \(1\)/);
  assert.match(html, /Refresh/);
  assert.match(html, /Not registered \(1\)/);
  assert.match(html, /2\/3 registered/);
});

test("an empty period says so, instead of printing an empty table", () => {
  const html = leaderboardHtml({ ...DATA, rows: [], registered: 0 });
  assert.match(html, /No verified solves in this period yet/);
  assert.doesNotMatch(html, /<pre>/);
});

test("names in the table are escaped", () => {
  const html = leaderboardHtml({ ...DATA, rows: [{ ...ROWS[0], handle: "a<b" }] });
  assert.ok(html.includes("a&lt;b"));
});

test("the progress bar fills in proportion", () => {
  assert.equal(progressBar(0, 10), "▱▱▱▱▱▱▱▱▱▱");
  assert.equal(progressBar(5, 10), "▰▰▰▰▰▱▱▱▱▱");
  assert.equal(progressBar(10, 10), "▰▰▰▰▰▰▰▰▰▰");
  assert.match(leaderboardCheckingHtml("week"), /Checking Codeforces/);
});

test("a command card shows usage, subcommands and admin marks", () => {
  const card = commandCardHtml(commandByName("roster"));
  assert.match(card, /<code>\/roster list<\/code>/);
  assert.match(card, /Subcommands/);
  assert.match(card, /🔒/);
});

test("the help index lists every section and the commands under it", () => {
  const html = helpIndexHtml();
  assert.match(html, /Practice/);
  assert.match(html, /Groups and classes/);
  assert.match(html, /<code>\/leaderboard<\/code>/);
});
