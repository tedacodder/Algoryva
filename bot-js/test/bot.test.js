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
