import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const session = vi.hoisted(() => ({ user: null as null | { id: string; username: string } }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async () => {
    if (!session.user) throw new Error("no session");
    return session.user;
  },
  getCurrentUser: async () => session.user,
}));
vi.mock("@/lib/db", async () => ({ db: (await import("./db")).realDb }));

import { realDb as db, resetDb } from "./db";
import { POST as createChallenge } from "@/app/api/internal/bot/v1/link-challenges/route";
import { POST as identity } from "@/app/api/internal/bot/v1/identity/route";
import { POST as unlinkRoute } from "@/app/api/internal/bot/v1/unlink/route";
import { confirmTelegramLink, unlinkTelegram } from "@/app/telegram/link/actions";
import { confirmLink, hashLinkToken, LINK_TTL_MS } from "@/lib/telegram/link";
import { hashTelegramId, signRequest } from "@/lib/telegram/bot-auth";
import { deleteAccount } from "@/lib/account/delete";
import { hashPassword } from "@/lib/auth/password";

const SECRET = "integration-secret-0123456789abcdef-xyz";
const SITE = "https://algoryva.example.test";
const PASSWORD = "correct horse battery staple";
const T_A = "300000001";
const T_B = "300000002";
const PATH = {
  challenge: "/api/internal/bot/v1/link-challenges",
  identity: "/api/internal/bot/v1/identity",
  unlink: "/api/internal/bot/v1/unlink",
};

/** A correctly signed bot request. Build a fresh one for every call: a Request body can only be read once. */
function botRequest(path: string, telegramId: string, nonce: string = randomBytes(18).toString("base64url")): Request {
  const body = JSON.stringify({ telegramId });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = signRequest(SECRET, ts, nonce, "POST", path, Buffer.from(body));
  return new Request(`${SITE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-algoryva-bot-timestamp": ts, "x-algoryva-bot-nonce": nonce, "x-algoryva-bot-signature": sig },
    body,
  });
}

async function issueToken(telegramId: string): Promise<string> {
  const res = await createChallenge(botRequest(PATH.challenge, telegramId));
  expect(res.status).toBe(201);
  const { linkUrl } = await res.json();
  return linkUrl.split("#")[1];
}

function confirmForm(token: string): FormData {
  const f = new FormData();
  f.set("token", token);
  return f;
}

async function makeUser(id: string, username: string) {
  return db.user.create({ data: { id, email: `${username}@example.test`, username, passwordHash: await hashPassword(PASSWORD) } });
}

beforeEach(async () => {
  vi.stubEnv("TELEGRAM_BOT_API_SECRET", SECRET);
  vi.stubEnv("SITE_URL", SITE);
  await resetDb();
  await makeUser("user-alice", "alice");
  await makeUser("user-bob", "bob");
  session.user = { id: "user-alice", username: "alice" };
});

describe("account linking, end to end on PostgreSQL", () => {
  it("links the signed-in account; the bot then recognises the chat, and the stored row holds only hashes", async () => {
    const token = await issueToken(T_A);
    const result = await confirmTelegramLink(undefined, confirmForm(token));
    expect(result?.ok).toBe(true);

    const rows = await db.telegramLink.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("user-alice");
    expect(rows[0].telegramHash).toBe(hashTelegramId(SECRET, T_A));
    expect(JSON.stringify(rows)).not.toContain(T_A);

    const status = await (await identity(botRequest(PATH.identity, T_A))).json();
    expect(status).toEqual({ linked: true, username: "alice" });
  });

  it("refuses an expired token and leaves the link unchanged", async () => {
    const token = await issueToken(T_A);
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + LINK_TTL_MS + 60_000);
      const result = await confirmTelegramLink(undefined, confirmForm(token));
      expect(result?.ok).toBe(false);
      expect(result?.message).toMatch(/expired or was already used/);
    } finally {
      vi.useRealTimers();
    }
    expect(await db.telegramLink.count()).toBe(0);
  });

  it("a token works once: a second use is refused", async () => {
    const token = await issueToken(T_A);
    expect((await confirmTelegramLink(undefined, confirmForm(token)))?.ok).toBe(true);
    const again = await confirmTelegramLink(undefined, confirmForm(token));
    expect(again?.ok).toBe(false);
    expect(await db.telegramLink.count()).toBe(1);
  });

  it("a malformed token is refused before any database lookup", async () => {
    const result = await confirmTelegramLink(undefined, confirmForm("not-a-real-token"));
    expect(result?.ok).toBe(false);
    expect(await db.telegramLinkChallenge.count({ where: { usedAt: null } })).toBe(0);
  });

  it("when two requests race to spend one token, exactly one links the account", async () => {
    const token = await issueToken(T_A);
    const results = await Promise.all([confirmLink(token, "user-alice", new Date()), confirmLink(token, "user-bob", new Date())]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.telegramLink.count()).toBe(1);
    const spent = await db.telegramLinkChallenge.findUnique({ where: { tokenHash: hashLinkToken(token) } });
    expect(spent?.usedAt).not.toBeNull();
  });

  it("a second challenge retires the first, so only the latest link works", async () => {
    const first = await issueToken(T_A);
    const second = await issueToken(T_A);
    expect((await confirmTelegramLink(undefined, confirmForm(first)))?.ok).toBe(false);
    expect((await confirmTelegramLink(undefined, confirmForm(second)))?.ok).toBe(true);
  });

  it("refuses to link a Telegram account that another Algoryva account already holds", async () => {
    const token = await issueToken(T_A);
    await db.telegramLink.create({ data: { userId: "user-bob", telegramHash: hashTelegramId(SECRET, T_A) } });
    const result = await confirmTelegramLink(undefined, confirmForm(token));
    expect(result?.ok).toBe(false);
    expect(result?.message).toMatch(/linked to a different Algoryva account/);
    expect((await db.telegramLink.findUnique({ where: { telegramHash: hashTelegramId(SECRET, T_A) } }))?.userId).toBe("user-bob");
  });

  it("refuses a second Telegram account for an account that is already linked, and does not spend the token", async () => {
    await confirmTelegramLink(undefined, confirmForm(await issueToken(T_A)));
    const forB = await issueToken(T_B);
    const result = await confirmTelegramLink(undefined, confirmForm(forB));
    expect(result?.ok).toBe(false);
    expect(result?.message).toMatch(/already linked to a different Telegram account/);
    const row = await db.telegramLinkChallenge.findUnique({ where: { tokenHash: hashLinkToken(forB) } });
    expect(row?.usedAt).toBeNull();
  });
});

describe("replay protection on PostgreSQL", () => {
  it("the same signed request, sent twice, is accepted once", async () => {
    const nonce = randomBytes(18).toString("base64url");
    expect((await identity(botRequest(PATH.identity, T_A, nonce))).status).toBe(200);
    expect((await identity(botRequest(PATH.identity, T_A, nonce))).status).toBe(401);
    expect(await db.botNonce.count({ where: { nonce } })).toBe(1);
  });

  it("a forged request with a reused nonce does not consume that nonce", async () => {
    const nonce = randomBytes(18).toString("base64url");
    const forged = new Request(`${SITE}${PATH.identity}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-algoryva-bot-timestamp": String(Math.floor(Date.now() / 1000)), "x-algoryva-bot-nonce": nonce, "x-algoryva-bot-signature": "0".repeat(64) },
      body: JSON.stringify({ telegramId: T_A }),
    });
    expect((await identity(forged)).status).toBe(401);
    expect(await db.botNonce.count({ where: { nonce } })).toBe(0);
    expect((await identity(botRequest(PATH.identity, T_A, nonce))).status).toBe(200);
  });

  it("an unsigned request is refused and records nothing", async () => {
    const res = await identity(new Request(`${SITE}${PATH.identity}`, { method: "POST", body: JSON.stringify({ telegramId: T_A }) }));
    expect(res.status).toBe(401);
    expect(await db.botNonce.count()).toBe(0);
  });
});

describe("unlinking on PostgreSQL", () => {
  it("unlinking from the bot removes the link; the chat is then unknown; a second unlink reports nothing to remove", async () => {
    await confirmTelegramLink(undefined, confirmForm(await issueToken(T_A)));
    expect(await (await unlinkRoute(botRequest(PATH.unlink, T_A))).json()).toEqual({ unlinked: true });
    expect(await (await identity(botRequest(PATH.identity, T_A))).json()).toEqual({ linked: false });
    expect(await (await unlinkRoute(botRequest(PATH.unlink, T_A))).json()).toEqual({ unlinked: false });
  });

  it("disconnecting from the website removes the link for that account only", async () => {
    await confirmTelegramLink(undefined, confirmForm(await issueToken(T_A)));
    session.user = { id: "user-bob", username: "bob" };
    await confirmTelegramLink(undefined, confirmForm(await issueToken(T_B)));
    session.user = { id: "user-alice", username: "alice" };
    const result = await unlinkTelegram();
    expect(result?.ok).toBe(true);
    const remaining = await db.telegramLink.findMany({ select: { userId: true } });
    expect(remaining.map((r) => r.userId)).toEqual(["user-bob"]);
  });
});

describe("account deletion on PostgreSQL", () => {
  it("deleting the account removes its Telegram link in the database, and the chat is no longer recognised", async () => {
    await confirmTelegramLink(undefined, confirmForm(await issueToken(T_A)));
    expect(await db.telegramLink.count({ where: { userId: "user-alice" } })).toBe(1);

    const result = await deleteAccount("user-alice", PASSWORD);
    expect(result).toEqual({ ok: true });

    expect(await db.user.count({ where: { id: "user-alice" } })).toBe(0);
    expect(await db.telegramLink.count({ where: { userId: "user-alice" } })).toBe(0);
    expect(await (await identity(botRequest(PATH.identity, T_A))).json()).toEqual({ linked: false });
  });

  it("deleting one account leaves another account's link intact", async () => {
    await confirmTelegramLink(undefined, confirmForm(await issueToken(T_A)));
    session.user = { id: "user-bob", username: "bob" };
    await confirmTelegramLink(undefined, confirmForm(await issueToken(T_B)));
    await deleteAccount("user-alice", PASSWORD);
    expect((await db.telegramLink.findMany({ select: { userId: true } })).map((r) => r.userId)).toEqual(["user-bob"]);
  });
});
