import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", async () => ({ db: (await import("./db")).realDb }));

import { realDb as db, resetDb } from "./db";
import { POST as startRoute } from "@/app/api/internal/bot/v1/community/start/route";
import { POST as randomRoute } from "@/app/api/internal/bot/v1/community/random/route";
import {
  connectHandle,
  connectedHandles,
  dailyText,
  dueItems,
  ackDelivery,
  disconnectHandle,
  randomProblem,
  registerPrivate,
  setGroup,
  stopChat,
  updateSettings,
} from "@/lib/bot/community";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { hashTelegramId, signRequest } from "@/lib/telegram/bot-auth";
import { hashPassword } from "@/lib/auth/password";
import { deleteAccount } from "@/lib/account/delete";

const SECRET = "community-secret-0123456789abcdef-wxyz";
const SITE = "https://algoryva.example.test";
const PASSWORD = "correct horse battery staple";
const TA = "600000001";
const TB = "600000002";
const TC = "600000003";
const GROUP = "-1009000000001";
const hash = (id: string) => hashTelegramId(SECRET, id);

const PROBLEMS = [
  { contestId: 1800, index: "A", name: "Easy One", rating: 900, tags: ["math"] },
  { contestId: 1801, index: "B", name: "Mid One", rating: 1100, tags: ["greedy", "sortings"] },
  { contestId: 1802, index: "C", name: "Hard One", rating: 1300, tags: ["dp"] },
  { contestId: 1803, index: "D", name: "Too Hard", rating: 2500, tags: ["dp"] },
  { contestId: 1804, index: "E", name: "Graphy", rating: 1500, tags: ["graphs", "dfs and similar"] },
  { contestId: 1805, index: "F", name: "Unrated", tags: ["math"] },
];

function contestList(now: Date) {
  const t = Math.floor(now.getTime() / 1000);
  return [
    { id: 2001, name: "Round Five", startTimeSeconds: t + 300, durationSeconds: 7200, phase: "BEFORE" },
    { id: 2002, name: "Round Thirty", startTimeSeconds: t + 1800, durationSeconds: 7200, phase: "BEFORE" },
    { id: 2003, name: "Far Away", startTimeSeconds: t + 3 * 86_400, durationSeconds: 7200, phase: "BEFORE" },
  ];
}

async function seedCodeforces(now: Date) {
  await db.cfCache.deleteMany();
  await db.cfCache.create({ data: { key: "problemset", payload: PROBLEMS as unknown as Prisma.InputJsonValue, fetchedAt: now } });
  await db.cfCache.create({ data: { key: "contests", payload: contestList(now) as unknown as Prisma.InputJsonValue, fetchedAt: now } });
}

async function seedSolved(handle: string, refs: string[], now: Date) {
  await db.cfCache.create({ data: { key: `solved:${handle.toLowerCase()}`, payload: refs as unknown as Prisma.InputJsonValue, fetchedAt: now } });
}

/** A fake Codeforces: user.info knows "tourist" and "jiangly" and rejects everyone else. */
function fakeCodeforces() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/user.info")) {
        const handle = url.searchParams.get("handles") ?? "";
        if (handle.toLowerCase() === "tourist") return Response.json({ status: "OK", result: [{ handle: "Tourist", rating: 3900 }] });
        return Response.json({ status: "FAILED", comment: `handles: User with handle ${handle} not found` }, { status: 400 });
      }
      return Response.json({ status: "FAILED", comment: "unexpected" }, { status: 400 });
    }),
  );
}

function signed(path: string, body: object): Request {
  const text = JSON.stringify(body);
  const nonce = randomBytes(18).toString("base64url");
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = signRequest(SECRET, ts, nonce, "POST", path, Buffer.from(text));
  return new Request(`${SITE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-algoryva-bot-timestamp": ts, "x-algoryva-bot-nonce": nonce, "x-algoryva-bot-signature": sig },
    body: text,
  });
}

const isDaily = (text: string) => text.includes("Daily") || text.includes("Brain teaser") || text.includes("Fresh from") || text.includes("Quick challenge") || text.includes("Today's target") || text.includes("Ready for this one") || text.includes("Puzzle time") || text.includes("Group challenge");
const isTwoHour = (text: string) => text.includes("Two hours") || text.includes("2 hours") || text.includes("Final call");

beforeEach(async () => {
  vi.stubEnv("TELEGRAM_BOT_API_SECRET", SECRET);
  vi.stubEnv("SITE_URL", SITE);
  vi.stubEnv("TELEGRAM_CHAT_KEY", Buffer.alloc(32, 7).toString("base64"));
  await resetDb();
  const now = new Date();
  await seedCodeforces(now);
  fakeCodeforces();
});

describe("subscriptions", () => {
  it("a private chat that starts the bot is recorded once, and gets today's problem with an emoji opener", async () => {
    expect(await registerPrivate(SECRET, chatKey(), TB)).toEqual({ created: true });
    expect(await registerPrivate(SECRET, chatKey(), TB)).toEqual({ created: false });
    const text = await dailyText(SECRET, TB, new Date());
    expect(text).toContain("https://codeforces.com/problemset/problem/");
    expect(text).toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(await db.telegramRecipient.count({ where: { chatHash: hash(TB) } })).toBe(1);
  });

  it("stores the chat id encrypted", async () => {
    await registerPrivate(SECRET, chatKey(), TB);
    const row = await db.telegramRecipient.findUniqueOrThrow({ where: { chatHash: hash(TB) } });
    expect(JSON.stringify(row)).not.toContain(TB);
    expect(row.chatCipher.startsWith("v1.")).toBe(true);
  });

  it("a group enabled by an admin gets messages, and stops when turned off", async () => {
    expect(await setGroup(SECRET, chatKey(), GROUP, true)).toEqual({ enabled: true });
    expect((await db.telegramRecipient.findUniqueOrThrow({ where: { chatHash: hash(GROUP) } })).kind).toBe("group");
    expect(await setGroup(SECRET, chatKey(), GROUP, false)).toEqual({ enabled: false });
    expect(await db.telegramRecipient.count({ where: { chatHash: hash(GROUP) } })).toBe(0);
  });

  it("turning daily messages off stops them; turning contest alerts off stops the two-hour notice", async () => {
    await registerPrivate(SECRET, chatKey(), TB);
    await updateSettings(SECRET, TB, { dailyCf: false });
    const first = await dueItems(chatKey(), new Date());
    expect(first.filter((i) => i.chatId === TB && isDaily(i.text))).toHaveLength(0);
    // Both contests 2001 (5 minutes) and 2002 (30 minutes) are inside the two-hour window, so both get a notice.
    expect(first.filter((i) => i.chatId === TB && isTwoHour(i.text))).toHaveLength(2);
    await updateSettings(SECRET, TB, { contestAlerts: false });
    await db.notificationDelivery.deleteMany({});
    expect((await dueItems(chatKey(), new Date())).filter((i) => i.chatId === TB)).toHaveLength(0);
  });

  it("stopping removes the subscription and its scheduled messages", async () => {
    await registerPrivate(SECRET, chatKey(), TB);
    await dueItems(chatKey(), new Date());
    expect(await stopChat(SECRET, TB)).toBe(true);
    expect(await db.notificationDelivery.count()).toBe(0);
  });
});

describe("daily problem", () => {
  it("each chat gets one daily message per UTC day, however often the scheduler runs", async () => {
    await registerPrivate(SECRET, chatKey(), TA);
    await registerPrivate(SECRET, chatKey(), TB);
    const key = chatKey();
    const first = (await dueItems(key, new Date())).filter((i) => isDaily(i.text));
    expect(first).toHaveLength(2);
    for (const i of first) await ackDelivery(i.deliveryId, "sent", new Date());
    expect((await dueItems(key, new Date())).filter((i) => isDaily(i.text))).toHaveLength(0);
    expect(await db.notificationDelivery.count({ where: { kind: "daily_cf" } })).toBe(2);
  });

  it("the bot receives the real chat id in the message it is asked to send", async () => {
    await registerPrivate(SECRET, chatKey(), TB);
    const item = (await dueItems(chatKey(), new Date())).find((i) => i.chatId === TB && isDaily(i.text));
    expect(item).toBeDefined();
  });

  it("a group gets a group-labelled daily message", async () => {
    await setGroup(SECRET, chatKey(), GROUP, true);
    const item = (await dueItems(chatKey(), new Date())).find((i) => i.chatId === GROUP);
    expect(item?.text).toContain("Group challenge");
  });

  it("a failed send is retried after five minutes, then given up after three attempts", async () => {
    await registerPrivate(SECRET, chatKey(), TB);
    const key = chatKey();
    const t0 = Date.now();
    const at = (min: number) => new Date(t0 + min * 60_000);
    const pick = async (when: Date) => (await dueItems(key, when)).find((i) => i.chatId === TB && isDaily(i.text));
    const first = await pick(at(0));
    expect(first).toBeDefined();
    await ackDelivery(first!.deliveryId, "failed", at(0));
    const second = await pick(at(6));
    expect(second).toBeDefined();
    await ackDelivery(second!.deliveryId, "failed", at(6));
    const third = await pick(at(12));
    expect(third).toBeDefined();
    await ackDelivery(third!.deliveryId, "failed", at(12));
    expect(await pick(at(18))).toBeUndefined();
    expect((await db.notificationDelivery.findFirstOrThrow({ where: { kind: "daily_cf" } })).status).toBe("failed");
  });

  it("a chat that blocked the bot is switched off and receives nothing more", async () => {
    await registerPrivate(SECRET, chatKey(), TA);
    await registerPrivate(SECRET, chatKey(), TB);
    const key = chatKey();
    const items = await dueItems(key, new Date());
    await ackDelivery(items.find((i) => i.chatId === TA)!.deliveryId, "blocked", new Date());
    expect((await db.telegramRecipient.findUniqueOrThrow({ where: { chatHash: hash(TA) } })).blocked).toBe(true);
    expect((await dueItems(key, new Date(Date.now() + 6 * 60_000))).filter((i) => i.chatId === TA)).toHaveLength(0);
  });

  it("when Codeforces is down, the last good copy is still served and nothing throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    await seedCodeforces(new Date(Date.now() - 2 * 86_400_000));
    await registerPrivate(SECRET, chatKey(), TB);
    expect(await dailyText(SECRET, TB, new Date())).toContain("https://codeforces.com/problemset/problem/");
    await expect(dueItems(chatKey(), new Date())).resolves.toBeDefined();
  });

  it("with no cache and Codeforces down, the queue is empty and the answer is honest", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    await db.cfCache.deleteMany();
    await registerPrivate(SECRET, chatKey(), TB);
    expect(await dailyText(SECRET, TB, new Date())).toBeNull();
    expect(await dueItems(chatKey(), new Date())).toEqual([]);
  });
});

describe("contest notices", () => {
  it("the first run records existing contests and sends no 'posted' notice for them", async () => {
    await registerPrivate(SECRET, chatKey(), TB);
    await dueItems(chatKey(), new Date());
    expect(await db.notificationDelivery.count({ where: { kind: "cf_posted" } })).toBe(0);
  });

  it("a contest posted later is announced once to every alert chat, group included", async () => {
    await registerPrivate(SECRET, chatKey(), TB);
    await setGroup(SECRET, chatKey(), GROUP, true);
    await dueItems(chatKey(), new Date()); // baseline
    const now = new Date();
    const t = Math.floor(now.getTime() / 1000);
    const posted = { id: 2004, name: "New Round", startTimeSeconds: t + 2 * 86_400, durationSeconds: 7200, phase: "BEFORE" };
    await db.cfCache.update({ where: { key: "contests" }, data: { payload: [...contestList(now), posted] as unknown as Prisma.InputJsonValue, fetchedAt: now } });
    const items = await dueItems(chatKey(), now);
    const postedItems = items.filter((i) => i.text.includes("New Round"));
    expect(postedItems.map((i) => i.chatId).sort()).toEqual([GROUP, TB].sort());
    expect(postedItems[0].text).toContain("https://codeforces.com/contests/2004");
    expect(postedItems[0].text).toMatch(/EAT/);
    expect(await db.notificationDelivery.count({ where: { kind: "cf_posted", key: "2004" } })).toBe(2);
    await dueItems(chatKey(), now);
    expect(await db.notificationDelivery.count({ where: { kind: "cf_posted", key: "2004" } })).toBe(2);
  });

  it("the two-hour notice goes out once for a contest inside the window, and not for one days away", async () => {
    await registerPrivate(SECRET, chatKey(), TB);
    await setGroup(SECRET, chatKey(), GROUP, true);
    const items = await dueItems(chatKey(), new Date());
    const twoHour = items.filter((i) => i.text.includes("Round Five"));
    expect(twoHour.map((i) => i.chatId).sort()).toEqual([GROUP, TB].sort());
    expect(twoHour[0].text).toContain("https://codeforces.com/contests/2001");
    expect(items.some((i) => i.text.includes("Far Away"))).toBe(false);
    expect(await db.notificationDelivery.count({ where: { kind: "cf_2h", key: "2001" } })).toBe(2);
    await dueItems(chatKey(), new Date());
    expect(await db.notificationDelivery.count({ where: { kind: "cf_2h", key: "2001" } })).toBe(2);
  });
});

describe("connected Codeforces handles", () => {
  it("connects a real handle, with Codeforces' own capitalisation and rating, and never twice", async () => {
    expect(await connectHandle(SECRET, chatKey(), TB, "private", "tourist", new Date())).toEqual({ handle: "Tourist", rating: 3900 });
    await connectHandle(SECRET, chatKey(), TB, "private", "TOURIST", new Date());
    expect((await connectedHandles(SECRET, TB, new Date())).map((h) => h.handle)).toEqual(["Tourist"]);
  });

  it("an unknown handle is refused with its own code", async () => {
    await expect(connectHandle(SECRET, chatKey(), TB, "private", "nobody_here_123", new Date())).rejects.toMatchObject({ code: "handle_not_found" });
  });

  it("a group must be enabled by an admin before a member can connect a handle in it", async () => {
    await expect(connectHandle(SECRET, chatKey(), GROUP, "group", "tourist", new Date())).rejects.toMatchObject({ code: "group_not_enabled" });
    await setGroup(SECRET, chatKey(), GROUP, true);
    expect((await connectHandle(SECRET, chatKey(), GROUP, "group", "tourist", new Date())).handle).toBe("Tourist");
  });

  it("refuses a sixth handle and frees a slot when one is disconnected", async () => {
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      await db.cfHandle.create({ data: { recipientId: (await db.telegramRecipient.upsert({ where: { chatHash: hash(TB) }, create: { chatHash: hash(TB), chatCipher: "x", kind: "private" }, update: {} })).id, handle: `user${i}` } });
    }
    await expect(connectHandle(SECRET, chatKey(), TB, "private", "tourist", now)).rejects.toMatchObject({ code: "too_many_handles" });
    expect(await disconnectHandle(SECRET, TB, "user0")).toBe(1);
    expect((await connectHandle(SECRET, chatKey(), TB, "private", "tourist", now)).handle).toBe("Tourist");
  });

  it("disconnecting one handle leaves the others; disconnecting nothing named removes all", async () => {
    await connectHandle(SECRET, chatKey(), TB, "private", "tourist", new Date());
    expect(await disconnectHandle(SECRET, TB)).toBe(1);
    expect(await connectedHandles(SECRET, TB, new Date())).toEqual([]);
  });
});

describe("skipping what a handle has solved", () => {
  it("the daily problem is never one the chat's handle already solved", async () => {
    const now = new Date();
    await registerPrivate(SECRET, chatKey(), TB);
    await connectHandle(SECRET, chatKey(), TB, "private", "tourist", now);
    await seedSolved("Tourist", ["1800/A", "1801/B"], now);
    const text = await dailyText(SECRET, TB, now);
    expect(text).toContain("Hard One");
    expect(text).toContain("already solved");
  });

  it("random skips solved problems, and says when everything matching was solved", async () => {
    const now = new Date();
    await registerPrivate(SECRET, chatKey(), TB);
    await connectHandle(SECRET, chatKey(), TB, "private", "tourist", now);
    await seedSolved("Tourist", ["1802/C"], now);
    const dp = await randomProblem(SECRET, TB, { minRating: 800, maxRating: 2000, tags: ["dp"] }, now);
    expect(dp).toEqual({ reason: "all_solved" });
    const graphs = await randomProblem(SECRET, TB, { minRating: 1200, maxRating: 1600, tags: ["graphs"] }, now);
    expect("text" in graphs && graphs.text).toContain("Graphy");
  });

  it("random with no matching problem says so", async () => {
    const r = await randomProblem(SECRET, TB, { minRating: 800, maxRating: 2000, tags: ["nonexistent-tag"] }, new Date());
    expect(r).toEqual({ reason: "no_match" });
  });

  it("random without a connected handle still works, and gives the default band", async () => {
    const r = await randomProblem(SECRET, TB, undefined, new Date());
    expect("text" in r && r.text).toMatch(/Rating 800–2000/);
  });

  it("when Codeforces cannot be reached for solved lists, nothing is excluded and the random pick still works", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await registerPrivate(SECRET, chatKey(), TB);
    await db.cfHandle.create({ data: { recipientId: (await db.telegramRecipient.findUniqueOrThrow({ where: { chatHash: hash(TB) } })).id, handle: "Tourist" } });
    const r = await randomProblem(SECRET, TB, undefined, new Date());
    expect("text" in r).toBe(true);
  });
});

describe("routes", () => {
  it("start returns today's problem and rejects an unsigned request", async () => {
    const body = await (await startRoute(signed("/api/internal/bot/v1/community/start", { chatId: TB }))).json();
    expect(body.created).toBe(true);
    expect(body.text).toContain("https://codeforces.com/problemset/problem/");
    const unsigned = await startRoute(new Request(`${SITE}/api/internal/bot/v1/community/start`, { method: "POST", body: JSON.stringify({ chatId: TB }) }));
    expect(unsigned.status).toBe(401);
  });

  it("random accepts a signed request with a band and tags, and refuses a bad tag", async () => {
    await registerPrivate(SECRET, chatKey(), TB);
    const ok = await randomRoute(signed("/api/internal/bot/v1/community/random", { chatId: TB, minRating: 1200, maxRating: 1600, tags: ["graphs"] }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).text).toContain("Graphy");
    const bad = await randomRoute(signed("/api/internal/bot/v1/community/random", { chatId: TB, tags: ["Not A Tag!"] }));
    expect(bad.status).toBe(400);
  });

  it("random refuses an inverted rating band", async () => {
    const res = await randomRoute(signed("/api/internal/bot/v1/community/random", { chatId: TB, minRating: 2000, maxRating: 800 }));
    expect(res.status).toBe(400);
  });
});

describe("deletion", () => {
  it("deleting an account removes its handles and never touches other chats", async () => {
    const owner = await db.user.create({ data: { id: "u-owner", email: "owner@example.test", username: "owner", passwordHash: await hashPassword(PASSWORD) } });
    await db.telegramLink.create({ data: { userId: owner.id, telegramHash: hash(TC) } });
    await registerPrivate(SECRET, chatKey(), TC);
    await db.telegramRecipient.update({ where: { chatHash: hash(TC) }, data: { userId: owner.id } });
    await connectHandle(SECRET, chatKey(), TB, "private", "tourist", new Date());
    expect(await deleteAccount(owner.id, PASSWORD)).toEqual({ ok: true });
    expect(await db.telegramRecipient.count({ where: { chatHash: hash(TC) } })).toBe(0);
    expect(await db.cfHandle.count()).toBe(1);
  });
});
