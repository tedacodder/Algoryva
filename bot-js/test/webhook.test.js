import { test } from "node:test";
import assert from "node:assert/strict";
import { createBot } from "../src/bot.js";
import { createWebhookHandler } from "../src/webhook.js";
import { createDeliverHandler, deliverDue } from "../src/deliver.js";
import { GrammyError } from "grammy";

const SECRET_TOKEN = "webhook-secret-0123456789";
const CRON = "cron-secret-0123456789abcdefghijklmnop";
const BOT_INFO = { id: 1, is_bot: true, first_name: "CF", username: "cf_daily_bot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false };
const update = { update_id: 9, message: { message_id: 1, date: 0, chat: { id: 1001, type: "private", first_name: "A" }, from: { id: 42, is_bot: false, first_name: "A" }, text: "/help", entities: [{ type: "bot_command", offset: 0, length: 5 }] } };

function bareBot(calls) {
  const bot = createBot({ token: "123456789:AAFakeTokenOnlyForBotUnitTests0123456789", site: {}, botInfo: BOT_INFO });
  bot.api.config.use(async (prev, method, payload) => {
    calls.push({ method, payload });
    return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1001, type: "private" } } };
  });
  return bot;
}

test("the webhook refuses an update without the secret token, and accepts one with it", async () => {
  const calls = [];
  const handler = createWebhookHandler({ bot: bareBot(calls), secretToken: SECRET_TOKEN });
  const body = JSON.stringify(update);
  const denied = await handler(new Request("https://example.test/", { method: "POST", headers: { "content-type": "application/json" }, body }));
  assert.equal(denied.status, 401);
  assert.equal(calls.length, 0);
  const ok = await handler(new Request("https://example.test/", { method: "POST", headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET_TOKEN }, body }));
  assert.equal(ok.status, 200);
  assert.equal(calls.find((c) => c.method === "sendMessage")?.payload.parse_mode, "HTML");
});

function fakeSite(items) {
  const acks = [];
  return { acks, due: async () => ({ items }), ack: async (id, outcome) => acks.push([id, outcome]) };
}

test("delivery sends each due message, records blocked chats, and acknowledges every one", async () => {
  const calls = [];
  const bot = bareBot(calls);
  bot.api.config.use(async (prev, method, payload) => {
    calls.push({ method, payload });
    if (payload.chat_id === 1002) return { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" };
    return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1001, type: "private" } } };
  });
  const site = fakeSite([
    { deliveryId: "d1", chatId: "1001", text: "🧠 Hello" },
    { deliveryId: "d2", chatId: "1002", text: "🧠 Hello again" },
  ]);
  const counts = await deliverDue({ bot, site });
  assert.deepEqual(counts, { sent: 1, blocked: 1, failed: 0 });
  assert.deepEqual(site.acks, [["d1", "sent"], ["d2", "blocked"]]);
});

test("a rate-limited send is marked failed, so the website retries it later", async () => {
  const bot = bareBot([]);
  bot.api.config.use(async () => ({ ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 0 } }));
  const site = fakeSite([{ deliveryId: "d1", chatId: "1001", text: "x" }]);
  const counts = await deliverDue({ bot, site });
  assert.deepEqual(counts, { sent: 0, blocked: 0, failed: 1 });
  assert.deepEqual(site.acks, [["d1", "failed"]]);
});

test("the delivery endpoint refuses a wrong or missing bearer token", async () => {
  const handler = createDeliverHandler({ bot: bareBot([]), site: fakeSite([]), cronSecret: CRON });
  assert.equal((await handler(new Request("https://example.test/", { method: "POST" }))).status, 401);
  assert.equal((await handler(new Request("https://example.test/", { method: "POST", headers: { authorization: "Bearer wrong" } }))).status, 401);
  const ok = await handler(new Request("https://example.test/", { method: "POST", headers: { authorization: `Bearer ${CRON}` } }));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { sent: 0, blocked: 0, failed: 0 });
});

test("GrammyError is available for the error mapping used above", () => {
  assert.equal(typeof GrammyError, "function");
});
