import { test } from "node:test";
import assert from "node:assert/strict";
import { createBot } from "../src/bot.js";
import { SiteError } from "../src/site.js";
import * as T from "../src/texts.js";

const BOT_INFO = { id: 1, is_bot: true, first_name: "CF", username: "cf_daily_bot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false };

function makeHarness({ memberStatus = "member", siteOverrides = {} } = {}) {
  const sent = [];
  const telegramCalls = [];
  const site = {
    calls: [],
    start: async (chatId) => (site.calls.push(["start", chatId]), { created: true, text: "🧠 Daily text" }),
    daily: async (chatId) => (site.calls.push(["daily", chatId]), { text: "🧠 Daily text" }),
    contests: async (chatId) => (site.calls.push(["contests", chatId]), { text: "🏆 Contests text" }),
    random: async (chatId, filter) => (site.calls.push(["random", chatId, filter]), { text: "🎲 Random text" }),
    connect: async (chatId, type, handle) => (site.calls.push(["connect", chatId, type, handle]), { handle: "Tourist", rating: 3900 }),
    disconnect: async () => ({ removed: 1 }),
    me: async () => ({ handles: [{ handle: "Tourist", rating: 3900, solved: 12 }] }),
    group: async (chatId, enable) => (site.calls.push(["group", chatId, enable]), { enabled: enable }),
    settings: async (chatId, patch) => (site.calls.push(["settings", chatId, patch]), { updated: true }),
    stop: async (chatId) => (site.calls.push(["stop", chatId]), { stopped: true }),
    due: async () => ({ items: [] }),
    ack: async () => ({ ok: true }),
    leaderboard: async (chatId, period) => (site.calls.push(["leaderboard", chatId, period]), {
      period, rosterCount: 2, registered: 2, notRegistered: [], pending: [], checkedAt: "2026-10-31T12:00:00.000Z",
      rows: [
        { rank: 1, handle: "tourist", rating: 3900, solved: 12, activeDays: 6, consistency: 86, score: 24 },
        { rank: 2, handle: "jiangly", rating: null, solved: 5, activeDays: 2, consistency: 29, score: 9 },
      ],
    }),
    roster: async (chatId, action, handles) => (site.calls.push(["roster", chatId, action, handles]), { count: (handles ?? []).length, handles: handles ?? [] }),
    groupProblem: async (chatId, problem) => (site.calls.push(["groupProblem", chatId, problem]), problem ? { ref: problem, name: "Easy One" } : { ref: null, name: null }),
    groupReport: async (chatId) => (site.calls.push(["groupReport", chatId]), { problem: { ref: "1800/A", name: "Easy One" }, rosterCount: 2, registered: 2, notRegistered: [], solved: ["alice"], unsolved: ["bob"], pending: [], usesConnectedFallback: false }),
    ...siteOverrides,
  };
  const bot = createBot({ token: "123456789:AAFakeTokenOnlyForBotUnitTests0123456789", site, botInfo: BOT_INFO });
  bot.api.config.use(async (prev, method, payload) => {
    telegramCalls.push({ method, payload });
    if (method === "getChatMember") return { ok: true, result: { status: memberStatus, user: { id: 42, is_bot: false, first_name: "Amy" } } };
    if (method === "sendMessage") {
      sent.push(payload);
      return { ok: true, result: { message_id: sent.length, date: 0, chat: { id: payload.chat_id, type: "private" } } };
    }
    return { ok: true, result: true };
  });
  let id = 1;
  const update = ({ text, chatType = "private", chatId = 1001 }) => {
    const isCommand = text.startsWith("/");
    return {
      update_id: id++,
      message: {
        message_id: id,
        date: Math.floor(Date.now() / 1000),
        chat: chatType === "private" ? { id: chatId, type: "private", first_name: "Amy" } : { id: chatId, type: "supergroup", title: "CP Group" },
        from: { id: 42, is_bot: false, first_name: "Amy" },
        text,
        ...(isCommand ? { entities: [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }] } : {}),
      },
    };
  };
  return { bot, site, sent, telegramCalls, update };
}

test("/start in a private chat subscribes, sends the menu keyboard and today's problem", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/start" }));
  assert.deepEqual(h.site.calls[0], ["start", "1001"]);
  assert.match(h.sent[0].text, /Welcome aboard/);
  assert.equal(h.sent[0].parse_mode, "HTML");
  assert.equal(h.sent[0].reply_markup.keyboard.length, 3);
});

test("/random with a band and tags asks the website for exactly that filter", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/random 1200-1600 dp graphs" }));
  assert.deepEqual(h.site.calls[0], ["random", "1001", { minRating: 1200, maxRating: 1600, tags: ["dp", "graphs"] }]);
  assert.match(h.sent[0].text, /Random text/);
});

test("/random with an upside-down band is refused before any website call", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/random 1600-1200" }));
  assert.equal(h.site.calls.length, 0);
  assert.match(h.sent[0].text, /must not be above/);
});

test("the Random button uses the default band", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "🎲 Random" }));
  assert.deepEqual(h.site.calls[0], ["random", "1001", { minRating: 800, maxRating: 2000, tags: [] }]);
});

test("a group member who is not an admin cannot enable the group", async () => {
  const h = makeHarness({ memberStatus: "member" });
  await h.bot.handleUpdate(h.update({ text: "/enable", chatType: "group", chatId: -1009000000001 }));
  assert.equal(h.site.calls.some((c) => c[0] === "group"), false);
  assert.equal(h.sent[0].text, T.NOT_ADMIN);
});

test("a group admin can enable and disable the group", async () => {
  const h = makeHarness({ memberStatus: "administrator" });
  await h.bot.handleUpdate(h.update({ text: "/enable", chatType: "group", chatId: -1009000000001 }));
  await h.bot.handleUpdate(h.update({ text: "/disable", chatType: "group", chatId: -1009000000001 }));
  assert.deepEqual(h.site.calls.filter((c) => c[0] === "group"), [["group", "-1009000000001", true], ["group", "-1009000000001", false]]);
});

test("connecting a handle passes the chat type, and the website's error becomes a friendly line", async () => {
  const h = makeHarness({ siteOverrides: { connect: async () => { throw new SiteError(404, "handle_not_found"); } } });
  await h.bot.handleUpdate(h.update({ text: "/connect nobody_here_123" }));
  assert.equal(h.sent[0].text, T.errorText("handle_not_found").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]));
});

test("a successful connect says so", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/connect tourist" }));
  assert.deepEqual(h.site.calls[0], ["connect", "1001", "private", "tourist"]);
  assert.match(h.sent[0].text, /Connected Tourist/);
});

test("an unexpected error shows the generic line and never the raw error text", async () => {
  const h = makeHarness({ siteOverrides: { daily: async () => { throw new Error("secret internal detail"); } } });
  await h.bot.handleUpdate(h.update({ text: "/daily" }));
  assert.equal(h.sent[0].text, T.GENERIC);
  assert.ok(!h.sent[0].text.includes("secret internal detail"));
});

test("buttons are ignored in groups, where Telegram does not deliver them", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "🎲 Random", chatType: "group", chatId: -1009000000001 }));
  assert.equal(h.site.calls.length, 0);
});

test("/stop calls the website and confirms", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/stop" }));
  assert.deepEqual(h.site.calls[0], ["stop", "1001"]);
  assert.match(h.sent[0].text, /Stopped/);
});

test("/roster set by a non-admin is refused before any website call", async () => {
  const h = makeHarness({ memberStatus: "member" });
  await h.bot.handleUpdate(h.update({ text: "/roster set tourist jiangly", chatType: "group", chatId: -1009000000777 }));
  assert.equal(h.site.calls.some((c) => c[0] === "roster"), false);
  assert.equal(h.sent[0].text, T.NOT_ADMIN);
});

test("/roster set by an admin sends the handles, and anyone can list", async () => {
  const admin = makeHarness({ memberStatus: "administrator" });
  await admin.bot.handleUpdate(admin.update({ text: "/roster set tourist, jiangly", chatType: "group", chatId: -1009000000777 }));
  assert.deepEqual(admin.site.calls[0], ["roster", "-1009000000777", "set", ["tourist", "jiangly"]]);
  const member = makeHarness({ memberStatus: "member" });
  await member.bot.handleUpdate(member.update({ text: "/roster list", chatType: "group", chatId: -1009000000777 }));
  assert.deepEqual(member.site.calls[0], ["roster", "-1009000000777", "list", []]);
});

test("/setdaily accepts a short form and the admin gets the new problem", async () => {
  const h = makeHarness({ memberStatus: "administrator" });
  await h.bot.handleUpdate(h.update({ text: "/setdaily 1800C", chatType: "group", chatId: -1009000000777 }));
  assert.deepEqual(h.site.calls[0], ["groupProblem", "-1009000000777", "1800/C"]);
  assert.match(h.sent[0].text, /Send \/daily to post it now/);
});

test("/setdaily with nonsense replies with usage and calls nothing", async () => {
  const h = makeHarness({ memberStatus: "administrator" });
  await h.bot.handleUpdate(h.update({ text: "/setdaily banana", chatType: "group", chatId: -1009000000777 }));
  assert.equal(h.site.calls.length, 0);
  assert.match(h.sent[0].text, /Use: \/setdaily/);
});

test("/report in a group shows the class report, and refuses in a private chat", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/report", chatType: "group", chatId: -1009000000777 }));
  assert.deepEqual(h.site.calls[0], ["groupReport", "-1009000000777"]);
  assert.match(h.sent[0].text, /Class report/);
  assert.match(h.sent[0].text, /alice/);  // the label is bolded in HTML, so check the content
  const p = makeHarness();
  await p.bot.handleUpdate(p.update({ text: "/report" }));
  assert.equal(p.site.calls.some((c) => c[0] === "groupReport"), false);
});

test("/contests lists the contests soonest first, with local time and countdowns", async () => {
  const now = Math.floor(Date.now() / 1000);
  const contests = [
    { id: 2, name: "Later Round", startTimeSeconds: now + 3 * 86400, durationSeconds: 7200, url: "https://codeforces.com/contests/2" },
    { id: 1, name: "Sooner Round", startTimeSeconds: now + 5400, durationSeconds: 7200, url: "https://codeforces.com/contests/1" },
  ];
  const h = makeHarness({ siteOverrides: { contests: async () => ({ text: "x", contests }) } });
  await h.bot.handleUpdate(h.update({ text: "/contests" }));
  assert.match(h.sent[0].text, /Upcoming Codeforces contests/);
  assert.ok(h.sent[0].text.indexOf("Sooner Round") < h.sent[0].text.indexOf("Later Round"));
  assert.match(h.sent[0].text, /<blockquote>/);
});

test("the Next Contest button and /next send the single soonest contest", async () => {
  const now = Math.floor(Date.now() / 1000);
  const contests = [{ id: 1, name: "Only Round", startTimeSeconds: now + 3600, durationSeconds: 7200, url: "https://codeforces.com/contests/1" }];
  const h = makeHarness({ siteOverrides: { contests: async () => ({ text: "x", contests }) } });
  await h.bot.handleUpdate(h.update({ text: "⏰ Next Contest" }));
  assert.match(h.sent[0].text, /Next Codeforces contest/);
  assert.match(h.sent[0].text, /Only Round/);
  await h.bot.handleUpdate(h.update({ text: "/next" }));
  assert.match(h.sent[1].text, /Next Codeforces contest/);
});

test("a daily problem from the website is sent as a quote with a spoiler on its tags", async () => {
  const problem = { ref: "1800/A", name: "Easy One", rating: 900, tags: ["math"], url: "https://codeforces.com/problemset/problem/1800/A", day: "2026-10-28", group: false, personalized: false };
  const h = makeHarness({ siteOverrides: { daily: async () => ({ text: "plain", problem }) } });
  await h.bot.handleUpdate(h.update({ text: "/daily" }));
  assert.match(h.sent[0].text, /<blockquote>/);
  assert.match(h.sent[0].text, /<tg-spoiler>#math<\/tg-spoiler>/);
  assert.match(h.sent[0].text, /Easy One/);
});

test("/report sends the class report as formatted HTML", async () => {
  const h = makeHarness({ memberStatus: "member" });
  await h.bot.handleUpdate(h.update({ text: "/report", chatType: "group", chatId: -1009000000777 }));
  assert.match(h.sent[0].text, /<b>Class report<\/b>/);
  assert.match(h.sent[0].text, /<blockquote>/);
});

function callbackUpdate(data, chatId = -1009000000777, messageId = 77) {
  return {
    update_id: 990,
    callback_query: {
      id: "cb1", from: { id: 42, is_bot: false, first_name: "Amy" }, chat_instance: "1", data,
      message: { message_id: messageId, date: 0, chat: { id: chatId, type: "supergroup", title: "CP" }, from: { id: 1, is_bot: true, first_name: "CF" }, text: "x" },
    },
  };
}

test("/roster with no words shows its subcommands, and needs no admin", async () => {
  const h = makeHarness({ memberStatus: "member" });
  await h.bot.handleUpdate(h.update({ text: "/roster", chatType: "group", chatId: -1009000000777 }));
  assert.match(h.sent[0].text, /Subcommands/);
  assert.match(h.sent[0].text, /\/roster add/);
});

test("/setdaily with no problem shows its card", async () => {
  const h = makeHarness({ memberStatus: "administrator" });
  await h.bot.handleUpdate(h.update({ text: "/setdaily", chatType: "group", chatId: -1009000000777 }));
  assert.equal(h.site.calls.length, 0);
  assert.match(h.sent[0].text, /Subcommands/);
});

test("/help with a command name shows that command, and an unknown name is handled", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/help roster" }));
  assert.match(h.sent[0].text, /Subcommands/);
  await h.bot.handleUpdate(h.update({ text: "/help nonsense" }));
  assert.match(h.sent[1].text, /no command called/);
  await h.bot.handleUpdate(h.update({ text: "/help" }));
  assert.match(h.sent[2].text, /Send \/help followed by a command name/);
});

test("/leaderboard posts a checking message, then edits it into the table", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/leaderboard", chatType: "group", chatId: -1009000000777 }));
  assert.match(h.sent[0].text, /Checking Codeforces/);
  assert.deepEqual(h.site.calls[0], ["leaderboard", "-1009000000777", "week"]);
  const edit = h.telegramCalls.find((c) => c.method === "editMessageText");
  assert.ok(edit, "the message is edited in place");
  assert.match(edit.payload.text, /🥇 <b>tourist<\/b>/);
  assert.equal(edit.payload.parse_mode, "HTML");
});

test("/leaderboard refused in a private chat, and an unknown period shows the card", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/leaderboard" }));
  assert.match(h.sent[0].text, /works in your group chat/);
  const g = makeHarness();
  await g.bot.handleUpdate(g.update({ text: "/leaderboard year", chatType: "group", chatId: -1009000000777 }));
  assert.match(g.sent[0].text, /Subcommands|Usage|leaderboard/);
  assert.equal(g.site.calls.length, 0);
});

test("the Refresh button edits the same message with the next batch", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(callbackUpdate("lb:month"));
  assert.ok(h.telegramCalls.some((c) => c.method === "answerCallbackQuery"));
  assert.deepEqual(h.site.calls[0], ["leaderboard", "-1009000000777", "month"]);
  const edits = h.telegramCalls.filter((c) => c.method === "editMessageText");
  assert.ok(edits.length >= 2, "checking state, then the table");
  assert.equal(edits.at(-1).payload.message_id, 77);
  assert.match(edits.at(-1).payload.text, /Group leaderboard/);
  // The checking state keeps the buttons, so the table never loses its controls.
  assert.ok(edits[0].payload.reply_markup, "the checking message keeps its buttons");
});

test("a website error during a refresh is shown in place, as a friendly line", async () => {
  const h = makeHarness({ siteOverrides: { leaderboard: async () => { throw new SiteError(409, "group_not_enabled"); } } });
  await h.bot.handleUpdate(callbackUpdate("lb:week"));
  const last = h.telegramCalls.filter((c) => c.method === "editMessageText").at(-1);
  assert.match(last.payload.text, /admin needs to send \/enable/);
});

test("/support replies with the support email", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/support" }));
  assert.match(h.sent[0].text, /Algoryva@gmail\.com/);
});

function groupCallbackUpdate(data, chatId = -1009000000777) {
  return {
    update_id: 991,
    callback_query: {
      id: "gcb1", from: { id: 42, is_bot: false, first_name: "Amy" }, chat_instance: "1", data,
      message: { message_id: 88, date: 0, chat: { id: chatId, type: "supergroup", title: "CP" }, from: { id: 1, is_bot: true, first_name: "CF" }, text: "x" },
    },
  };
}

test("a group's replies carry the group buttons, so the group can use them", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(h.update({ text: "/contests", chatType: "group", chatId: -1009000000777 }));
  const sent = h.telegramCalls.filter((c) => c.method === "sendMessage").at(-1);
  const rows = sent.payload.reply_markup.inline_keyboard.flat().map((b) => b.callback_data ?? b.url);
  assert.ok(rows.includes("gm:random") && rows.includes("gm:contests") && rows.includes("gm:next") && rows.includes("gm:leaderboard"));
});

test("the group Contests button answers in the group with the contest list", async () => {
  const now = Math.floor(Date.now() / 1000);
  const contests = [{ id: 1, name: "Group Round", startTimeSeconds: now + 3600, durationSeconds: 7200, url: "https://codeforces.com/contests/1" }];
  const h = makeHarness({ siteOverrides: { contests: async () => ({ text: "x", contests }) } });
  await h.bot.handleUpdate(groupCallbackUpdate("gm:contests"));
  assert.ok(h.telegramCalls.some((c) => c.method === "answerCallbackQuery"));
  assert.match(h.sent.at(-1).text, /Group Round/);
});

test("the group Random and Next Contest buttons work the same way", async () => {
  const now = Math.floor(Date.now() / 1000);
  const contests = [{ id: 2, name: "Next One", startTimeSeconds: now + 900, durationSeconds: 7200, url: "https://codeforces.com/contests/2" }];
  const h = makeHarness({ siteOverrides: { contests: async () => ({ text: "x", contests }) } });
  await h.bot.handleUpdate(groupCallbackUpdate("gm:next"));
  assert.match(h.sent.at(-1).text, /Next Codeforces contest/);
  await h.bot.handleUpdate(groupCallbackUpdate("gm:random"));
  assert.ok(h.site.calls.some((c) => c[0] === "random"));
});

test("the group Leaderboard button starts the checking message and fills in the table", async () => {
  const h = makeHarness();
  await h.bot.handleUpdate(groupCallbackUpdate("gm:leaderboard"));
  assert.match(h.sent[0].text, /Checking Codeforces/);
  const edit = h.telegramCalls.find((c) => c.method === "editMessageText");
  assert.match(edit.payload.text, /Group leaderboard/);
});

