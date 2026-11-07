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

import { commandCardHtml, helpIndexHtml, leaderboardHtml, leaderboardCheckingHtml, progressBar, rosterResultHtml, supportHtml } from "../src/formatting.js";
import { commandByName } from "../src/commands.js";

const ROWS = [
  { rank: 1, handle: "tourist", rating: 3900, solved: 12, activeDays: 6, consistency: 86, score: 24 },
  { rank: 2, handle: "jiangly", rating: null, solved: 5, activeDays: 2, consistency: 29, score: 9 },
];
const DATA = { period: "week", rows: ROWS, rosterCount: 3, registered: 2, notRegistered: ["ksun48"], pending: [], checkedAt: "2026-10-31T12:00:00.000Z" };

test("the leaderboard is phone-friendly: no code block, each member on two short lines with the rating beside the name", () => {
  const html = leaderboardHtml(DATA);
  assert.doesNotMatch(html, /<pre>/);
  assert.match(html, /🥇 <b>tourist<\/b> — 3900/);
  assert.match(html, /🥈 <b>jiangly<\/b> — unrated/);
  assert.match(html, /12 solved · 86% consistent/);
  assert.doesNotMatch(html, /score|Score|Days|active days/);
});

test("the leaderboard lists the members still being checked, and the not-registered ones", () => {
  const html = leaderboardHtml({ ...DATA, pending: ["amy"] });
  assert.match(html, /Still being checked \(1\)/);
  assert.match(html, /Refresh/);
  assert.match(html, /Not registered \(1\)/);
  assert.match(html, /2\/3 registered/);
});

test("an empty period says so", () => {
  const html = leaderboardHtml({ ...DATA, rows: [], registered: 0 });
  assert.match(html, /No verified solves in this period yet/);
  assert.doesNotMatch(html, /🥇/);
});

test("names in the leaderboard are escaped", () => {
  const html = leaderboardHtml({ ...DATA, rows: [{ ...ROWS[0], handle: "a<b" }] });
  assert.ok(html.includes("a&lt;b"));
  assert.doesNotMatch(html, /a<b/);
});

test("the roster result lists who was registered, who is not an account, and who is not checked yet", () => {
  const html = rosterResultHtml("add", { count: 2, handles: ["tourist", "jiangly"], added: ["tourist"], invalid: ["ghost"], unchecked: ["later"] });
  assert.match(html, /Registered \(1\)/);
  assert.match(html, /Not a Codeforces account \(1\)/);
  assert.match(html, /Queued for checking \(1\)/);
  assert.match(html, /<code>tourist<\/code>/);
});

test("the roster list shows the students, or says it is empty", () => {
  assert.match(rosterResultHtml("list", { count: 2, handles: ["tourist", "jiangly"] }), /<code>jiangly<\/code>/);
  assert.match(rosterResultHtml("list", { count: 0, handles: [] }), /The list is empty/);
});

test("the help footer and the support card show the support email", () => {
  assert.match(helpIndexHtml(), /Algoryva@gmail\.com/);
  assert.match(supportHtml(), /Algoryva@gmail\.com/);
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

test("students still being verified are said so on the leaderboard and in the roster reply", () => {
  assert.match(leaderboardHtml({ ...DATA, checking: 3 }), /3 students are still being verified/);
  assert.match(rosterResultHtml("add", { count: 5, handles: [], added: [], invalid: [], unchecked: [], checking: 45 }), /Checking on Codeforces: 45/);
  assert.doesNotMatch(leaderboardHtml({ ...DATA, checking: 0 }), /still being verified/);
});

import { meHtml } from "../src/formatting.js";

test("a handle that could not be looked up in time says it is checking", () => {
  const html = meHtml([{ handle: "amy", rating: null, solved: null, pending: true }, { handle: "ben", rating: 1200, solved: 4 }]);
  assert.match(html, /checking, try again shortly/);
  assert.match(html, /rating <b>1200<\/b> · 4 solved/);
});

import { motivationFor, ratingHtml, ranklistHtml, summaryHtml } from "../src/formatting.js";

test("advice follows what the member did: up, zero, down, podium, pending, default", () => {
  assert.match(motivationFor({ solved: 2, rank: 9, ratingChange: 40 }), /Rating up/);
  assert.match(motivationFor({ solved: 0, rank: 9, ratingChange: null }), /upsolve it tomorrow/);
  assert.match(motivationFor({ solved: 2, rank: 9, ratingChange: -20 }), /tough round/);
  assert.match(motivationFor({ solved: 3, rank: 2, ratingChange: null }), /podium/);
  assert.match(motivationFor({ solved: 3, rank: 9, ratingChange: null, pending: true }), /still loading/);
  assert.match(motivationFor({ solved: 3, rank: 9, ratingChange: null }), /Solid effort/);
});

test("a rating card shows rating, best rating, rank and rated contests, with names escaped", () => {
  const html = ratingHtml({ handle: "tourist", rating: 3900, maxRating: 4000, rank: "legendary grandmaster", maxRank: "tourist", contests: 80 });
  assert.match(html, /Rating <b>3900<\/b> · best 4000/);
  assert.match(html, /Rated contests: 80/);
  assert.match(ratingHtml({ handle: "a<b", rating: null, maxRating: null, rank: null, maxRank: null, contests: null }), /a&lt;b/);
});

const RANK_DATA = {
  contest: { id: 2279, name: "Round 1000", phase: "CODING" },
  top: [{ rank: 1, handle: "tourist", points: 4000, solved: 4 }],
  members: [{ rank: 12, handle: "amy", points: 1500, solved: 2 }],
  missing: ["ben"],
  checkedAt: "2026-11-05T10:00:00.000Z",
};

test("a running contest is labelled LIVE, a finished one as final, and both name the class and the missing", () => {
  const live = ranklistHtml(RANK_DATA);
  assert.match(live, /LIVE/);
  assert.match(live, /🥇 tourist/);
  assert.match(live, /#12 amy/);
  assert.match(live, /Not in the official standings: ben/);
  assert.match(ranklistHtml({ ...RANK_DATA, contest: { ...RANK_DATA.contest, phase: "FINISHED" } }), /Final results/);
});

test("the summary gives each member their place, rating change and advice", () => {
  const html = summaryHtml({
    contest: { id: 2279, name: "Round 1000", phase: "FINISHED" },
    members: [
      { handle: "amy", rank: 3, solved: 3, points: 2500, ratingChange: 45, pending: false },
      { handle: "ben", rank: 40, solved: 0, points: 0, ratingChange: -30, pending: false },
      { handle: "cy", rank: 80, solved: 1, points: 500, ratingChange: null, pending: true },
    ],
    missing: ["dee"],
  });
  assert.match(html, /Final results/);
  assert.match(html, /rating \+45/);
  assert.match(html, /rating -30/);
  assert.match(html, /rating pending/);
  assert.match(html, /upsolve it tomorrow/);
  assert.match(html, /Not in the official standings: dee/);
});

import { pageLines, summaryPages } from "../src/formatting.js";

test("a class of sixty keeps the ranklist inside Telegram's 4096-character limit", () => {
  const members = Array.from({ length: 60 }, (_, i) => ({ rank: i + 1, handle: `student_${String(i).padStart(2, "0")}`, points: 100 - i, solved: 3 }));
  const html = ranklistHtml({ ...RANK_DATA, members, missing: [] });
  assert.ok(html.length <= 4096, `ranklist is ${html.length} characters`);
  assert.match(html, /#60 student_59/);
});

test("a class of sixty gets a summary split into pages that each fit Telegram, with every member present", () => {
  const members = Array.from({ length: 60 }, (_, i) => ({ handle: `student_${String(i).padStart(2, "0")}`, rank: i + 1, solved: 2, points: 300, ratingChange: 10, pending: false }));
  const pages = summaryPages({ contest: { id: 1, name: "Round 1000", phase: "FINISHED" }, members, missing: [] });
  assert.ok(pages.length > 1);
  for (const page of pages) assert.ok(page.length <= 4096, `page is ${page.length} characters`);
  const joined = pages.join("\n");
  for (const m of members) assert.ok(joined.includes(m.handle), m.handle);
});

test("pageLines never splits a block, even when a single block is large", () => {
  assert.deepEqual(pageLines(["a".repeat(10), "b".repeat(10)], 15), ["a".repeat(10), "b".repeat(10)]);
});

import { cfcheckHtml } from "../src/formatting.js";

test("the API check shows the rank when Codeforces lists the handle, and says so when it does not", () => {
  const listed = cfcheckHtml(2283, "Tedacodder", {
    official: { status: "OK", comment: null, rows: [{ rank: 512, handle: "Tedacodder", type: "CONTESTANT" }] },
    unofficial: { status: "OK", comment: null, rows: [{ rank: 512, handle: "Tedacodder", type: "CONTESTANT" }] },
  });
  assert.match(listed, /Official standings: rank <b>512<\/b> \(CONTESTANT\)/);
  const missing = cfcheckHtml(2283, "Tedacodder", { official: { status: "OK", comment: null, rows: [] }, unofficial: { status: "FAILED", comment: "contestId: bad", rows: [] } });
  assert.match(missing, /Official standings: not listed/);
  assert.match(missing, /Codeforces returned an error \(contestId: bad\)/);
});

import { statsHtml } from "../src/formatting.js";

test("the owner's statistics show the numbers, and a zero active count has no divide-by-zero", () => {
  const html = statsHtml({ privateChats: 40, groups: 3, blocked: 2, activePrivate7d: 25, activeGroups7d: 2, accounts: 0, linked: 0, optedIn: 0, activeLearners7d: 0, handles: 9, rosterValid: 50, rosterPending: 4, sent24h: 120, failed24h: 1, blocked24h: 2, checkedAt: "2026-11-08T10:00:00.000Z" });
  assert.match(html, /Private chats: <b>40<\/b> · active this week: <b>25<\/b>/);
  assert.match(html, /Solved something this week: <b>0<\/b> \(0%\)/);
  assert.match(html, /Class members: <b>50<\/b> · queued checks: <b>4<\/b>/);
  assert.match(html, /Updated 2026-11-08 10:00 UTC/);
});
