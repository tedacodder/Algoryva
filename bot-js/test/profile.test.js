import { test } from "node:test";
import assert from "node:assert/strict";
import { DESCRIPTION, SHORT_DESCRIPTION, botCommands, applyProfile, readToken } from "../src/profile.js";

test("the description fits Telegram's limit and names the support email", () => {
  assert.ok(DESCRIPTION.length <= 512, `description is ${DESCRIPTION.length} characters`);
  assert.match(DESCRIPTION, /Algoryva@gmail\.com/);
  assert.match(DESCRIPTION, /\/start/);
});

test("the short description fits Telegram's limit", () => {
  assert.ok(SHORT_DESCRIPTION.length <= 120);
});

test("every command in the menu is valid for Telegram", () => {
  const commands = botCommands();
  assert.ok(commands.length > 0 && commands.length <= 100);
  for (const c of commands) {
    assert.match(c.command, /^[a-z0-9_]{1,32}$/, c.command);
    assert.ok(c.description.length >= 3 && c.description.length <= 256, `${c.command} description`);
  }
  assert.ok(commands.some((c) => c.command === "leaderboard"));
  assert.ok(commands.some((c) => c.command === "support"));
});

test("applying the profile sets the description, the short description and the command menu", async () => {
  const calls = [];
  const api = { setMyDescription: async (p) => calls.push(["description", p]), setMyShortDescription: async (p) => calls.push(["short", p]), setMyCommands: async (p) => calls.push(["commands", p]) };
  const result = await applyProfile(api);
  assert.deepEqual(calls.map((c) => c[0]), ["description", "short", "commands"]);
  assert.equal(result.commands, botCommands().length);
});

test("the profile reads only BOT_TOKEN, and refuses a missing or malformed token", () => {
  assert.equal(readToken({ BOT_TOKEN: "8942912394:AAHfakeTokenForTestingOnly_0123456789" }), "8942912394:AAHfakeTokenForTestingOnly_0123456789");
  assert.throws(() => readToken({}), /BOT_TOKEN is missing/);
  assert.throws(() => readToken({ BOT_TOKEN: "not-a-token" }), /BOT_TOKEN is missing/);
});

