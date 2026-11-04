import { test } from "node:test";
import assert from "node:assert/strict";
import { DESCRIPTION, SHORT_DESCRIPTION, privateMenu, groupMenu, applyProfile, readToken } from "../src/profile.js";

test("the About text fits Telegram's limit and is a single line", () => {
  assert.ok(SHORT_DESCRIPTION.length <= 120, `about is ${SHORT_DESCRIPTION.length} characters`);
  assert.ok(!SHORT_DESCRIPTION.includes("\n"));
});

test("the description fits Telegram's limit and names the support email", () => {
  assert.ok(DESCRIPTION.length <= 512, `description is ${DESCRIPTION.length} characters`);
  assert.match(DESCRIPTION, /Algoryva@gmail\.com/);
  assert.match(DESCRIPTION, /\/start/);
});

test("every menu entry is valid for Telegram", () => {
  for (const list of [privateMenu(), groupMenu()]) {
    assert.ok(list.length > 0 && list.length <= 100);
    for (const c of list) {
      assert.match(c.command, /^[a-z0-9_]{1,32}$/, c.command);
      assert.ok(c.description.length >= 3 && c.description.length <= 256, `${c.command} description`);
    }
  }
});

test("the ☰ menu lists the private commands, and groups get the group-relevant ones", () => {
  const priv = privateMenu().map((c) => c.command);
  const grp = groupMenu().map((c) => c.command);
  assert.ok(priv.includes("connect") && priv.includes("me") && priv.includes("start"));
  assert.ok(!grp.includes("connect") && !grp.includes("me"));
  assert.ok(grp.includes("leaderboard") && grp.includes("roster") && grp.includes("setdaily"));
});

test("applying the profile sets the texts, the scoped command lists, and the ☰ button", async () => {
  const calls = [];
  const api = {
    setMyDescription: async (p) => calls.push(["description", p]),
    setMyShortDescription: async (p) => calls.push(["short", p]),
    setMyCommands: async (list, opts) => calls.push(["commands", opts?.scope?.type ?? "default", list.length]),
    setChatMenuButton: async (p) => calls.push(["menu", p.menu_button.type]),
  };
  const result = await applyProfile(api);
  assert.deepEqual(calls.filter((c) => c[0] === "commands").map((c) => c[1]), ["default", "all_private_chats", "all_group_chats"]);
  assert.deepEqual(calls.at(-1), ["menu", "commands"]);
  assert.equal(result.privateCommands, privateMenu().length);
});

test("the profile reads only BOT_TOKEN, and refuses a missing or malformed token", () => {
  assert.equal(readToken({ BOT_TOKEN: "8942912394:AAHfakeTokenForTestingOnly_0123456789" }), "8942912394:AAHfakeTokenForTestingOnly_0123456789");
  assert.throws(() => readToken({}), /BOT_TOKEN is missing/);
  assert.throws(() => readToken({ BOT_TOKEN: "not-a-token" }), /BOT_TOKEN is missing/);
});
