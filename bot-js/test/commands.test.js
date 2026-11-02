import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, SECTIONS, commandByName } from "../src/commands.js";

test("every command has a usage that starts with a slash and a one-line summary", () => {
  for (const c of COMMANDS) {
    assert.match(c.usage, /^\//, c.name);
    assert.ok(c.summary.length > 10 && c.summary.length < 140, `${c.name} summary length`);
  }
});

test("every command belongs to a section that exists", () => {
  const ids = new Set(SECTIONS.map((s) => s.id));
  for (const c of COMMANDS) assert.ok(ids.has(c.section), c.name);
});

test("roster has every subcommand, so /roster alone can list them", () => {
  const roster = commandByName("roster");
  assert.deepEqual(roster.subcommands.map((s) => s.usage.split(" ")[1]), ["list", "add", "remove", "set", "clear"]);
  assert.equal(roster.subcommands.find((s) => s.usage.includes("list")).admin, false);
  assert.ok(roster.subcommands.filter((s) => s.usage.includes("add") || s.usage.includes("set")).every((s) => s.admin === true));
});

test("setdaily and leaderboard list every form they accept", () => {
  assert.equal(commandByName("setdaily").subcommands.length, 4);
  assert.deepEqual(commandByName("leaderboard").examples, ["/leaderboard", "/leaderboard month", "/leaderboard all"]);
});

test("the group-only commands are marked as group-only", () => {
  for (const name of ["enable", "disable", "roster", "setdaily", "report", "leaderboard"]) assert.equal(commandByName(name).where, "group", name);
});
