import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", async () => ({ db: (await import("./db")).realDb }));

import { realDb as db, resetDb } from "./db";
import { classroomReport, customRefFor, FETCH_BUDGET, groupProblemAction, rosterAction, ROSTER_MAX } from "@/lib/bot/classroom";
import { registerPrivate, setGroup, connectHandle, dueItems } from "@/lib/bot/community";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { hashTelegramId } from "@/lib/telegram/bot-auth";

const SECRET = "classroom-secret-0123456789abcdef-wxyz";
const GROUP = "-1009000000777";
const TA = "700000001";
const now = new Date();
const PROBLEMS = [
  { contestId: 1800, index: "A", name: "Easy One", rating: 900, tags: ["math"] },
  { contestId: 1801, index: "B", name: "Mid One", rating: 1100, tags: ["greedy"] },
];
const hash = (id: string) => hashTelegramId(SECRET, id);

async function seed() {
  await db.cfCache.deleteMany();
  await db.cfCache.create({ data: { key: "problemset", payload: PROBLEMS as unknown as Prisma.InputJsonValue, fetchedAt: now } });
  const t = Math.floor(now.getTime() / 1000);
  await db.cfCache.create({ data: { key: "contests", payload: [] as unknown as Prisma.InputJsonValue, fetchedAt: now } });
  void t;
}

/** A Codeforces stub that reports one accepted problem (1800/A) for every handle, and counts the calls it receives. */
function codeforcesStub() {
  const calls = { status: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/user.status")) {
        calls.status += 1;
        return Response.json({ status: "OK", result: [{ verdict: "OK", problem: { contestId: 1800, index: "A" } }] });
      }
      return Response.json({ status: "FAILED", comment: "unexpected" }, { status: 400 });
    }),
  );
  return calls;
}

beforeEach(async () => {
  vi.stubEnv("TELEGRAM_BOT_API_SECRET", SECRET);
  vi.stubEnv("TELEGRAM_CHAT_KEY", Buffer.alloc(32, 7).toString("base64"));
  await resetDb();
  await seed();
  vi.unstubAllGlobals();
  await setGroup(SECRET, chatKey(), GROUP, true);
});

describe("roster", () => {
  it("sets a roster, removes duplicates regardless of case, and lists it", async () => {
    const r = await rosterAction(SECRET, GROUP, "set", ["Tourist", "tourist", "jiangly", "ksun48"]);
    expect(r.count).toBe(3);
    expect(r.handles).toEqual(["Tourist", "jiangly", "ksun48"]);
    expect((await rosterAction(SECRET, GROUP, "remove", ["JIANGLY"])).handles).toEqual(["Tourist", "ksun48"]);
    expect((await rosterAction(SECRET, GROUP, "add", ["neal"])).count).toBe(3);
    expect((await rosterAction(SECRET, GROUP, "clear", [])).count).toBe(0);
  });

  it("refuses a roster over the limit and refuses a malformed handle", async () => {
    const many = Array.from({ length: ROSTER_MAX + 1 }, (_, i) => `student${i}`);
    await expect(rosterAction(SECRET, GROUP, "set", many)).rejects.toMatchObject({ code: "roster_too_large" });
    await expect(rosterAction(SECRET, GROUP, "set", ["bad handle!"])).rejects.toMatchObject({ code: "invalid_handle" });
  });

  it("only a group that was enabled can have a roster", async () => {
    await expect(rosterAction(SECRET, "-1000000000001", "list", [])).rejects.toMatchObject({ code: "group_not_enabled" });
  });
});

describe("group problem", () => {
  it("sets a valid problem, refuses an unknown one, and resets to the default", async () => {
    const set = await groupProblemAction(SECRET, GROUP, "1800/A", now);
    expect(set).toEqual({ ref: "1800/A", name: "Easy One" });
    expect(await customRefFor((await db.telegramRecipient.findUniqueOrThrow({ where: { chatHash: hash(GROUP) } })).id)).toBe("1800/A");
    await expect(groupProblemAction(SECRET, GROUP, "9999/Z", now)).rejects.toMatchObject({ code: "problem_not_found" });
    await expect(groupProblemAction(SECRET, GROUP, "../etc", now)).rejects.toMatchObject({ code: "invalid_problem" });
    expect(await groupProblemAction(SECRET, GROUP, null, now)).toEqual({ ref: null, name: null });
  });

  it("the group's own problem replaces the default in the scheduled daily message", async () => {
    await groupProblemAction(SECRET, GROUP, "1801/B", now);
    await dueItems(chatKey(), now);
    const row = await db.notificationDelivery.findFirst({ where: { kind: "daily_cf", recipient: { chatHash: hash(GROUP) } } });
    expect(row?.ref).toBe("1801/B");
  });
});

describe("report", () => {
  it("lists registered, solved, unsolved, and not-registered students for the group's problem", async () => {
    await groupProblemAction(SECRET, GROUP, "1800/A", now);
    await rosterAction(SECRET, GROUP, "set", ["alice_cf", "bob_cf", "carol_cf"]);
    // alice and bob ran /connect in a private chat; carol never did.
    await registerPrivate(SECRET, chatKey(), TA);
    await db.cfCache.create({ data: { key: "user:alice_cf", payload: { handle: "alice_cf", rating: null } as unknown as Prisma.InputJsonValue, fetchedAt: now } });
    await connectHandle(SECRET, chatKey(), TA, "private", "alice_cf", now);
    await db.cfCache.create({ data: { key: "solved:alice_cf", payload: ["1800/A"] as unknown as Prisma.InputJsonValue, fetchedAt: now } });
    await db.cfHandle.create({ data: { recipientId: (await db.telegramRecipient.findUniqueOrThrow({ where: { chatHash: hash(TA) } })).id, handle: "bob_cf" } });
    await db.cfCache.create({ data: { key: "solved:bob_cf", payload: [] as unknown as Prisma.InputJsonValue, fetchedAt: now } });

    const report = await classroomReport(SECRET, GROUP, now);
    expect(report.problem).toEqual({ ref: "1800/A", name: "Easy One" });
    expect(report.rosterCount).toBe(3);
    expect(report.registered).toBe(2);
    expect(report.notRegistered).toEqual(["carol_cf"]);
    expect(report.solved).toEqual(["alice_cf"]);
    expect(report.unsolved).toEqual(["bob_cf"]);
  });

  it("checks at most the budget of uncached handles per report, and marks the rest as still checking", async () => {
    const calls = codeforcesStub();
    const names = Array.from({ length: FETCH_BUDGET + 3 }, (_, i) => `member${i}`);
    await rosterAction(SECRET, GROUP, "set", names);
    for (const name of names) {
      await db.cfHandle.create({ data: { recipientId: (await db.telegramRecipient.findUniqueOrThrow({ where: { chatHash: hash(GROUP) } })).id, handle: name } });
    }
    await groupProblemAction(SECRET, GROUP, "1800/A", now);
    const first = await classroomReport(SECRET, GROUP, now);
    expect(calls.status).toBe(FETCH_BUDGET);
    expect(first.pending.length).toBe(3);
    const second = await classroomReport(SECRET, GROUP, now);
    expect(second.pending.length).toBe(0);
    expect(second.solved.length).toBe(FETCH_BUDGET + 3);
    vi.unstubAllGlobals();
  });

  it("without a roster, the group's own registered students are used, and the report says so", async () => {
    await groupProblemAction(SECRET, GROUP, "1800/A", now);
    await connectHandle(SECRET, chatKey(), GROUP, "group", "tourist", now).catch(() => undefined);
    const report = await classroomReport(SECRET, GROUP, now);
    expect(report.usesConnectedFallback).toBe(true);
  });
});
