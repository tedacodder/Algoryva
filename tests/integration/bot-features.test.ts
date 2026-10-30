import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", async () => ({ db: (await import("./db")).realDb }));

import { realDb as db, resetDb } from "./db";
import { POST as daily } from "@/app/api/internal/bot/v1/daily/route";
import { POST as progress } from "@/app/api/internal/bot/v1/progress/route";
import { POST as leaderboard } from "@/app/api/internal/bot/v1/leaderboard/route";
import { POST as optIn } from "@/app/api/internal/bot/v1/leaderboard/opt-in/route";
import { POST as submissionStatus } from "@/app/api/internal/bot/v1/submission-status/route";
import { signRequest, hashTelegramId } from "@/lib/telegram/bot-auth";
import { scoreWeek, DAILY_CAP } from "@/lib/bot/leaderboard";
import { deleteAccount } from "@/lib/account/delete";
import { hashPassword } from "@/lib/auth/password";

const SECRET = "features-secret-0123456789abcdef-xyzw";
const SITE = "https://algoryva.example.test";
const T = { alice: "400000001", bob: "400000002", carol: "400000003" };
const PASSWORD = "correct horse battery staple";

/** A correctly signed request. A fresh Request is built per call because a body can be read once. */
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

const P = {
  daily: "/api/internal/bot/v1/daily",
  progress: "/api/internal/bot/v1/progress",
  leaderboard: "/api/internal/bot/v1/leaderboard",
  optIn: "/api/internal/bot/v1/leaderboard/opt-in",
  status: "/api/internal/bot/v1/submission-status",
};

async function problem(slug: string, opts: { kind?: "INTERNAL" | "EXTERNAL"; status?: "PUBLISHED" | "DRAFT"; difficulty?: "EASY" | "MEDIUM" | "HARD"; hidden?: boolean } = {}) {
  const hidden = opts.hidden ?? true;
  return db.problem.create({
    data: {
      slug,
      title: `Problem ${slug}`,
      kind: opts.kind ?? "INTERNAL",
      difficulty: opts.difficulty ?? "EASY",
      status: opts.status ?? "PUBLISHED",
      testCases: {
        create: [
          { input: "1 2", expected: "3", isSample: true },
          ...(hidden ? [{ input: "SECRET-HIDDEN-INPUT", expected: "SECRET-HIDDEN-EXPECTED", isSample: false }] : []),
        ],
      },
    },
  });
}

async function user(id: string, username: string, telegramId?: string, extra: { suspended?: boolean; optIn?: boolean } = {}) {
  await db.user.create({ data: { id, email: `${username}@example.test`, username, passwordHash: await hashPassword(PASSWORD), suspended: extra.suspended ?? false } });
  if (telegramId) {
    await db.telegramLink.create({ data: { userId: id, telegramHash: hashTelegramId(SECRET, telegramId), leaderboardOptIn: extra.optIn ?? false } });
  }
}

const solve = (userId: string, problemId: string, verification: "OUTPUT_MATCHED" | "SELF_REPORTED" | "LEGACY_UNVERIFIED", solvedAt = new Date()) =>
  db.problemSolve.create({ data: { userId, problemId, verification, solvedAt } });

beforeEach(async () => {
  vi.stubEnv("TELEGRAM_BOT_API_SECRET", SECRET);
  vi.stubEnv("SITE_URL", SITE);
  await resetDb();
  await user("u-alice", "alice", T.alice);
  await user("u-bob", "bob", T.bob, { optIn: true });
  await user("u-carol", "carol");
});

describe("daily challenge", () => {
  it("gives a published, original problem with a hidden test, and never sends hidden data", async () => {
    await problem("easy-one");
    await problem("sample-only", { hidden: false });
    await problem("external-one", { kind: "EXTERNAL" });
    await problem("draft-one", { status: "DRAFT" });
    const res = await daily(signed(P.daily, { telegramId: T.alice }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem.slug).toBe("easy-one");
    expect(body.problem.samples).toEqual([{ input: "1 2", expected: "3" }]);
    const text = JSON.stringify(body);
    expect(text).not.toContain("SECRET-HIDDEN");
    expect(Object.keys(body.problem).sort()).toEqual(["difficulty", "samples", "slug", "title", "url"]);
  });

  it("returns the same problem all day, and stores exactly one assignment for that user and day", async () => {
    await problem("a");
    await problem("b");
    await problem("c");
    const first = await (await daily(signed(P.daily, { telegramId: T.alice }))).json();
    const second = await (await daily(signed(P.daily, { telegramId: T.alice }))).json();
    expect(second.problem.slug).toBe(first.problem.slug);
    expect(await db.challengeAssignment.count({ where: { userId: "u-alice" } })).toBe(1);
  });

  it("two simultaneous requests for the same day agree and store one row", async () => {
    await problem("a");
    await problem("b");
    const results = await Promise.all([
      (await daily(signed(P.daily, { telegramId: T.alice }))).json(),
      (await daily(signed(P.daily, { telegramId: T.alice }))).json(),
    ]);
    expect(results[0].problem.slug).toBe(results[1].problem.slug);
    expect(await db.challengeAssignment.count({ where: { userId: "u-alice" } })).toBe(1);
  });

  it("skips a problem the student has already solved", async () => {
    const easy = await problem("easy-one");
    await problem("easy-two");
    await solve("u-alice", easy.id, "OUTPUT_MATCHED");
    const body = await (await daily(signed(P.daily, { telegramId: T.alice }))).json();
    expect(body.problem.slug).toBe("easy-two");
  });

  it("gives a new problem on the next UTC day", async () => {
    await problem("a");
    await problem("b");
    const day1 = await (await daily(signed(P.daily, { telegramId: T.alice }))).json();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(Date.now() + 26 * 3_600_000));
      const day2 = await (await daily(signed(P.daily, { telegramId: T.alice }))).json();
      expect(day2.day).not.toBe(day1.day);
    } finally {
      vi.useRealTimers();
    }
    expect(await db.challengeAssignment.count({ where: { userId: "u-alice" } })).toBe(2);
  });

  it("returns null when there is nothing to assign, instead of a broken problem", async () => {
    const body = await (await daily(signed(P.daily, { telegramId: T.alice }))).json();
    expect(body.problem).toBeNull();
  });

  it("refuses an unlinked chat and a suspended account with the same message", async () => {
    await problem("a");
    const unlinked = await daily(signed(P.daily, { telegramId: "400000999" }));
    expect(unlinked.status).toBe(403);
    await db.user.update({ where: { id: "u-alice" }, data: { suspended: true } });
    const suspended = await daily(signed(P.daily, { telegramId: T.alice }));
    expect(suspended.status).toBe(403);
    expect((await suspended.json()).error.code).toBe("not_linked");
  });
});

describe("progress", () => {
  it("reports the solve breakdown by verification, and the same XP the website computes", async () => {
    const a = await problem("a", { difficulty: "EASY" });
    const b = await problem("b", { difficulty: "MEDIUM" });
    const c = await problem("c", { difficulty: "EASY" });
    await solve("u-alice", a.id, "OUTPUT_MATCHED");
    await solve("u-alice", b.id, "SELF_REPORTED");
    await solve("u-alice", c.id, "LEGACY_UNVERIFIED");
    const body = await (await progress(signed(P.progress, { telegramId: T.alice }))).json();
    expect(body.solved).toEqual({ total: 3, outputMatched: 1, selfReported: 1, legacyUnverified: 1 });
    // Website XP: easy 10 each, medium 25. Every solve counts, which is the website's behaviour and is documented in the audit.
    expect(body.xp).toBe(10 + 25 + 10);
    expect(body.streak).toEqual({ current: expect.any(Number), longest: expect.any(Number) });
    expect(body.badges).toContain("First Solve");
  });

  it("refuses an unlinked chat", async () => {
    expect((await progress(signed(P.progress, { telegramId: T.carol }))).status).toBe(403);
  });
});

describe("weekly leaderboard", () => {
  it("lists only accounts that opted in, and counts only output-matched solves", async () => {
    const a = await problem("a", { difficulty: "EASY" });
    const b = await problem("b", { difficulty: "MEDIUM" });
    await solve("u-bob", a.id, "OUTPUT_MATCHED");
    await solve("u-bob", b.id, "SELF_REPORTED");
    await solve("u-alice", a.id, "OUTPUT_MATCHED"); // alice has not opted in
    const body = await (await leaderboard(signed(P.leaderboard, { telegramId: T.bob }))).json();
    expect(body.entries).toEqual([{ rank: 1, username: "bob", score: 1, solved: 1 }]);
  });

  it("does not show a legacy or self-reported solve, even for an opted-in account", async () => {
    const a = await problem("a", { difficulty: "HARD" });
    await solve("u-bob", a.id, "LEGACY_UNVERIFIED");
    const body = await (await leaderboard(signed(P.leaderboard, { telegramId: T.bob }))).json();
    expect(body.entries).toEqual([]);
  });

  it("caps the points one student can take in a single day", async () => {
    const ps = await Promise.all(Array.from({ length: DAILY_CAP + 3 }, (_, i) => problem(`e${i}`, { difficulty: "EASY" })));
    for (const p of ps) await solve("u-bob", p.id, "OUTPUT_MATCHED");
    const body = await (await leaderboard(signed(P.leaderboard, { telegramId: T.bob }))).json();
    expect(body.entries[0]).toMatchObject({ score: DAILY_CAP, solved: DAILY_CAP });
  });

  it("opting out removes the caller from the board; opting in adds them", async () => {
    const a = await problem("a", { difficulty: "EASY" });
    await solve("u-bob", a.id, "OUTPUT_MATCHED");
    expect(await (await optIn(signed(P.optIn, { telegramId: T.bob, optIn: false }))).json()).toEqual({ leaderboardOptIn: false });
    expect((await (await leaderboard(signed(P.leaderboard, { telegramId: T.bob }))).json()).entries).toEqual([]);
    expect(await (await optIn(signed(P.optIn, { telegramId: T.bob, optIn: true }))).json()).toEqual({ leaderboardOptIn: true });
    expect((await (await leaderboard(signed(P.leaderboard, { telegramId: T.bob }))).json()).entries).toHaveLength(1);
  });

  it("refuses to show the board to an unlinked chat, and an unlinked chat cannot opt anyone in", async () => {
    expect((await leaderboard(signed(P.leaderboard, { telegramId: T.carol }))).status).toBe(403);
    expect((await optIn(signed(P.optIn, { telegramId: T.carol, optIn: true }))).status).toBe(403);
  });

  it("hides a suspended account from the board", async () => {
    const a = await problem("a", { difficulty: "EASY" });
    await solve("u-bob", a.id, "OUTPUT_MATCHED");
    await db.user.update({ where: { id: "u-bob" }, data: { suspended: true } });
    expect((await (await leaderboard(signed(P.leaderboard, { telegramId: T.alice }))).json()).entries).toEqual([]);
  });

  it("breaks ties on username, so the order is deterministic", () => {
    const now = Date.now();
    const rows = [
      { userId: "x", username: "zed", solvedAt: new Date(now), difficulty: "EASY" },
      { userId: "y", username: "amy", solvedAt: new Date(now), difficulty: "EASY" },
    ];
    expect(scoreWeek(rows).map((r) => r.username)).toEqual(["amy", "zed"]);
  });
});

describe("submission status", () => {
  it("returns the stored outcome of the caller's own submission", async () => {
    const cid = "11111111-2222-4333-8444-555555555555";
    await db.syncEvent.create({ data: { userId: "u-alice", id: cid, type: "submission", payloadHash: "h", outcome: { verdict: "accepted", allPass: true, solved: true } } });
    const body = await (await submissionStatus(signed(P.status, { telegramId: T.alice, clientId: cid }))).json();
    expect(body).toEqual({ status: "done", verdict: "accepted", allPass: true, solved: true });
  });

  it("reports a pending submission as pending", async () => {
    const cid = "11111111-2222-4333-8444-666666666666";
    await db.syncEvent.create({ data: { userId: "u-alice", id: cid, type: "submission", payloadHash: "h", outcome: { status: "pending" } } });
    expect(await (await submissionStatus(signed(P.status, { telegramId: T.alice, clientId: cid }))).json()).toEqual({ status: "pending" });
  });

  it("another student's submission id is simply not found", async () => {
    const cid = "11111111-2222-4333-8444-777777777777";
    await db.syncEvent.create({ data: { userId: "u-alice", id: cid, type: "submission", payloadHash: "h", outcome: { verdict: "accepted", allPass: true, solved: true } } });
    const res = await submissionStatus(signed(P.status, { telegramId: T.bob, clientId: cid }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });

  it("rejects a malformed id before any lookup", async () => {
    expect((await submissionStatus(signed(P.status, { telegramId: T.alice, clientId: "not-a-uuid" }))).status).toBe(400);
  });
});

describe("deletion", () => {
  it("deleting an account removes its daily assignments", async () => {
    await problem("a");
    await daily(signed(P.daily, { telegramId: T.alice }));
    expect(await db.challengeAssignment.count({ where: { userId: "u-alice" } })).toBe(1);
    await deleteAccount("u-alice", PASSWORD);
    expect(await db.challengeAssignment.count({ where: { userId: "u-alice" } })).toBe(0);
  });
});
