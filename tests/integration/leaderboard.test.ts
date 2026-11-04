import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", async () => ({ db: (await import("./db")).realDb }));

import { realDb as db, resetDb } from "./db";
import { FETCH_BUDGET, groupLeaderboard } from "@/lib/bot/group-leaderboard";
import { setGroup, connectHandle } from "@/lib/bot/community";
import { registerPrivate } from "@/lib/bot/community";
import { rosterAction } from "@/lib/bot/classroom";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { POST as leaderboardRoute } from "@/app/api/internal/bot/v1/community/leaderboard/route";
import { signRequest } from "@/lib/telegram/bot-auth";

const SECRET = "leaderboard-secret-0123456789abcdef-wxyz";
const GROUP = "-1009000000555";
const NOW = new Date();
const T = Math.floor(NOW.getTime() / 1000);
const DAY = 86_400;

const accepted = (refs: string[], daysAgo: number[]) => refs.map((ref, i) => ({ ref, at: T - daysAgo[i] * DAY }));

async function seedAccepted(handle: string, list: { ref: string; at: number }[]) {
  await db.cfCache.create({ data: { key: `accepted:${handle.toLowerCase()}`, payload: list as unknown as Prisma.InputJsonValue, fetchedAt: NOW } });
}

/** user.info returns a rating for anyone; user.status fails, so uncached students stay pending. */
function codeforcesStub() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/user.info")) {
        return Response.json({ status: "OK", result: [{ handle: url.searchParams.get("handles"), rating: 1500 }] });
      }
      return Response.json({ status: "FAILED", comment: "unavailable" }, { status: 400 });
    }),
  );
}

beforeEach(async () => {
  vi.stubEnv("TELEGRAM_BOT_API_SECRET", SECRET);
  vi.stubEnv("SITE_URL", "https://algoryva.example.test");
  vi.stubEnv("TELEGRAM_CHAT_KEY", Buffer.alloc(32, 7).toString("base64"));
  await resetDb();
  await db.cfCache.deleteMany();
  codeforcesStub();
  await setGroup(SECRET, chatKey(), GROUP, true);
});

async function registerStudent(handle: string) {
  const id = randomBytes(4).toString("hex");
  await registerPrivate(SECRET, chatKey(), `8${id}`.replace(/\D/g, "1").padEnd(9, "1"));
  const chat = await db.telegramRecipient.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  await db.cfHandle.create({ data: { recipientId: chat.id, handle } });
}

describe("group leaderboard", () => {
  it("ranks the registered members for the period, and reports who is not registered", async () => {
    await rosterAction(SECRET, GROUP, "set", ["tourist", "jiangly", "ksun48"]);
    await registerStudent("tourist");
    await registerStudent("jiangly");
    await seedAccepted("tourist", accepted(["1/A", "1/B", "1/C"], [1, 1, 3]));
    await seedAccepted("jiangly", accepted(["2/A"], [2]));

    const board = await groupLeaderboard(SECRET, GROUP, "week", NOW);
    expect(board.rows.map((r) => [r.handle, r.solved])).toEqual([["tourist", 3], ["jiangly", 1]]);
    expect(board.rows[0].rank).toBe(1);
    expect(board.notRegistered).toEqual(["ksun48"]);
    expect(board.registered).toBe(2);
    expect(board.rosterCount).toBe(3);
    expect(board.pending).toEqual([]);
  });

  it("a member with no cached data and no budget left is reported as pending, not guessed", async () => {
    await rosterAction(SECRET, GROUP, "set", ["amy"]);
    await registerStudent("amy");
    const board = await groupLeaderboard(SECRET, GROUP, "week", NOW);
    expect(board.pending).toEqual(["amy"]);
    expect(board.rows).toEqual([]);
  });

  it("with no time left for Codeforces, nothing is fetched and every unchecked member is listed as pending", async () => {
    const names = ["ann1x", "ben2x", "cy3x"];
    await rosterAction(SECRET, GROUP, "set", names);
    for (const name of names) await registerStudent(name);
    const statusCalls = () => (fetch as unknown as { mock: { calls: [string | URL][] } }).mock.calls.filter(([u]) => String(u).includes("user.status")).length;
    const before = statusCalls();
    const board = await groupLeaderboard(SECRET, GROUP, "week", NOW, { budgetMs: 0 });
    expect(statusCalls() - before).toBe(0);
    expect(board.pending.length).toBe(names.length);
  });

  it("the period changes who counts: a solve 20 days ago is in 'month' but not 'week'", async () => {
    await rosterAction(SECRET, GROUP, "set", ["neal"]);
    await registerStudent("neal");
    await seedAccepted("neal", accepted(["3/A"], [20]));
    // A registered member with no solve in the period is still listed, with zeros, so the teacher sees who has not solved anything.
    expect((await groupLeaderboard(SECRET, GROUP, "week", NOW)).rows).toEqual([expect.objectContaining({ handle: "neal", solved: 0, score: 0 })]);
    expect((await groupLeaderboard(SECRET, GROUP, "month", NOW)).rows[0].solved).toBe(1);
  });

  it("falls back to the students who connected in this group when there is no roster", async () => {
    await connectHandle(SECRET, chatKey(), GROUP, "group", "tourist", NOW).catch(() => undefined);
    const board = await groupLeaderboard(SECRET, GROUP, "week", NOW);
    expect(board.usesConnectedFallback).toBe(true);
  });

  it("a chat that is not an enabled group is refused", async () => {
    await expect(groupLeaderboard(SECRET, "-1000000000999", "week", NOW)).rejects.toMatchObject({ code: "group_not_enabled" });
  });

  it("the route accepts a signed request and refuses an unsigned one", async () => {
    const body = JSON.stringify({ chatId: GROUP, period: "month" });
    const nonce = randomBytes(18).toString("base64url");
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signRequest(SECRET, ts, nonce, "POST", "/api/internal/bot/v1/community/leaderboard", Buffer.from(body));
    const ok = await leaderboardRoute(new Request("https://algoryva.example.test/api/internal/bot/v1/community/leaderboard", {
      method: "POST",
      headers: { "content-type": "application/json", "x-algoryva-bot-timestamp": ts, "x-algoryva-bot-nonce": nonce, "x-algoryva-bot-signature": sig },
      body,
    }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).period).toBe("month");
    const unsigned = await leaderboardRoute(new Request("https://algoryva.example.test/api/internal/bot/v1/community/leaderboard", { method: "POST", body }));
    expect(unsigned.status).toBe(401);
  });
});
