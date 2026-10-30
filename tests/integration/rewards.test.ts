import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", async () => ({ db: (await import("./db")).realDb }));

import { realDb as db, resetDb } from "./db";
import { awardPreviousWeek, previousWeek } from "@/lib/bot/rewards";
import { registerPrivate, dueItems, ackDelivery } from "@/lib/bot/community";
import { progressFor } from "@/lib/bot/progress";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { hashTelegramId } from "@/lib/telegram/bot-auth";
import { deleteAccount } from "@/lib/account/delete";
import { hashPassword } from "@/lib/auth/password";

const SECRET = "rewards-secret-0123456789abcdef-xyzw";
const PASSWORD = "correct horse battery staple";
const TA = "700000001";
const DAY = 86_400_000;

async function seedCodeforces(now: Date) {
  const problems = [{ contestId: 1800, index: "A", name: "Easy", rating: 900, tags: [] }];
  await db.cfCache.deleteMany();
  await db.cfCache.create({ data: { key: "problemset", payload: problems as unknown as Prisma.InputJsonValue, fetchedAt: now } });
  await db.cfCache.create({ data: { key: "contests", payload: [] as unknown as Prisma.InputJsonValue, fetchedAt: now } });
}

let problemCounter = 0;
/** One solve on a given day (0 = Monday of the rewarded week). Each solve uses its own problem, because a student solves a problem once. */
async function solve(userId: string, weekStartMs: number, day: number, difficulty: "EASY" | "MEDIUM" | "HARD", verification: "OUTPUT_MATCHED" | "SELF_REPORTED" = "OUTPUT_MATCHED", hour = 3) {
  const p = await db.problem.create({ data: { slug: `rw-${++problemCounter}`, title: `RW ${problemCounter}`, kind: "INTERNAL", difficulty, status: "PUBLISHED" } });
  await db.problemSolve.create({ data: { userId, problemId: p.id, verification, solvedAt: new Date(weekStartMs + day * DAY + hour * 3_600_000) } });
}

async function student(id: string, username: string, optIn: boolean, telegramId?: string) {
  await db.user.create({ data: { id, email: `${username}@example.test`, username, passwordHash: await hashPassword(PASSWORD) } });
  if (telegramId) await db.telegramLink.create({ data: { userId: id, telegramHash: hashTelegramId(SECRET, telegramId), leaderboardOptIn: optIn } });
}

beforeEach(async () => {
  vi.stubEnv("TELEGRAM_BOT_API_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://algoryva.example.test");
  vi.stubEnv("TELEGRAM_CHAT_KEY", Buffer.alloc(32, 7).toString("base64"));
  await resetDb();
  await seedCodeforces(new Date());
  problemCounter = 0;
});

/** The seeded week: alice (opted in, 4 solves on 4 days), bob (opted in, 5 solves on 5 days), carol (opted in, 3 solves), dan (not opted in, 5 days),
 *  eve (opted in, 2 solves), frank (only self-reported solves). */
async function seedWeek(now: Date) {
  const { start } = previousWeek(now);
  const ws = start.getTime();
  await student("u-alice", "alice", true, TA);
  // Opting in to the public board is stored on the Telegram link, so only linked students can be on it.
  await student("u-bob", "bob", true, "700000002");
  await student("u-carol", "carol", true, "700000003");
  await student("u-dan", "dan", false); // not linked, not opted in
  await student("u-eve", "eve", true, "700000004");
  await student("u-frank", "frank", true, "700000005");
  for (let d = 0; d < 4; d++) await solve("u-alice", ws, d, "MEDIUM");
  for (let d = 0; d < 5; d++) await solve("u-bob", ws, d, "EASY");
  for (let i = 0; i < 3; i++) await solve("u-carol", ws, 0, "EASY", "OUTPUT_MATCHED", 1 + i);
  for (let d = 0; d < 5; d++) await solve("u-dan", ws, d, "HARD");
  for (let d = 0; d < 2; d++) await solve("u-eve", ws, d, "EASY");
  for (let d = 0; d < 10; d++) await solve("u-frank", ws, d % 7, "EASY", "SELF_REPORTED");
}

describe("weekly awards", () => {
  it("awards the podium in board order, steady weeks, and nothing to non-qualifying students", async () => {
    const now = new Date();
    await seedWeek(now);
    expect(await awardPreviousWeek(now)).toBeGreaterThan(0);
    const rewards = await db.botReward.findMany({ orderBy: [{ kind: "asc" }], select: { userId: true, kind: true, detail: true } });
    const byKind = Object.fromEntries(rewards.map((r) => [`${r.kind}:${r.userId}`, r.detail]));
    expect(byKind["podium_1:u-alice"]).toBe("4 solves");
    expect(byKind["podium_2:u-bob"]).toBe("5 solves");
    expect(byKind["podium_3:u-carol"]).toBe("3 solves");
    expect(byKind["steady_week:u-bob"]).toBe("5 days");
    expect(byKind["steady_week:u-dan"]).toBe("5 days");
    // Not on the podium: dan did not opt in, eve is below the minimum, frank has only self-reported solves.
    expect(rewards.some((r) => r.kind.startsWith("podium") && r.userId === "u-dan")).toBe(false);
    expect(rewards.some((r) => r.userId === "u-eve" || r.userId === "u-frank")).toBe(false);
    // Four days is not enough for a steady week.
    expect(rewards.some((r) => r.kind === "steady_week" && r.userId === "u-alice")).toBe(false);
  });

  it("awards each week once: a second run writes nothing", async () => {
    const now = new Date();
    await seedWeek(now);
    await awardPreviousWeek(now);
    const before = await db.botReward.count();
    expect(await awardPreviousWeek(now)).toBe(0);
    expect(await db.botReward.count()).toBe(before);
    expect(await db.rewardPeriod.count()).toBe(1);
  });

  it("a week with no qualifying work still records the week, so the step does not rerun every minute", async () => {
    const now = new Date();
    expect(await awardPreviousWeek(now)).toBe(0);
    expect(await db.rewardPeriod.count()).toBe(1);
  });

  it("sends the reward privately to the linked chat only, and the due queue carries the words", async () => {
    const now = new Date();
    await seedWeek(now);
    await registerPrivate(SECRET, chatKey(), TA); // alice's chat is linked, so the reward reaches her
    await awardPreviousWeek(now);
    const items = (await dueItems(chatKey(), now)).filter((i) => i.text.includes("Weekly podium") || i.text.includes("Steady week"));
    expect(items).toHaveLength(1);
    expect(items[0].chatId).toBe(TA);
    expect(items[0].text).toContain("#1 on the Algoryva board");
    await ackDelivery(items[0].deliveryId, "sent", now);
    const again = (await dueItems(chatKey(), now)).filter((i) => i.text.includes("Weekly podium"));
    expect(again).toHaveLength(0);
  });

  it("shows the rewards in progress, with the week they were earned for", async () => {
    const now = new Date();
    await seedWeek(now);
    await awardPreviousWeek(now);
    const p = await progressFor("u-alice");
    expect(p.rewards).toEqual([{ kind: "podium_1", week: previousWeek(now).key, detail: "4 solves" }]);
  });

  it("deleting the account removes its rewards", async () => {
    const now = new Date();
    await seedWeek(now);
    await awardPreviousWeek(now);
    expect(await db.botReward.count({ where: { userId: "u-bob" } })).toBeGreaterThan(0);
    await deleteAccount("u-bob", PASSWORD);
    expect(await db.botReward.count({ where: { userId: "u-bob" } })).toBe(0);
  });
});
