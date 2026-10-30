import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { seedBasics } from "@/lib/test-support/seed";
import { hashPassword } from "@/lib/auth/password";
import { deleteAccount } from "@/lib/account/delete";
import { hashTelegramId } from "@/lib/telegram/bot-auth";
import { confirmLink, createLinkChallenge, hashLinkToken, LINK_TTL_MS, telegramStatus, unlinkByTelegram, unlinkForUser } from "@/lib/telegram/link";

const SECRET = "link-secret-for-tests-0123456789abcdefgh";
const T_A = "100000001";
const T_B = "100000002";
const PASSWORD = "correct horse battery";
const T0 = new Date("2026-10-25T12:00:00Z");
let passwordHash = "";

async function addUser(id: string) {
  db.seed("user", [{ id, email: `${id}@example.test`, username: id, passwordHash, role: "USER", suspended: false, preferredLanguage: "python", emailVerifiedAt: null, pendingEmail: null }]);
}
const issue = async (telegramId: string, at = T0) => {
  const r = await createLinkChallenge(SECRET, telegramId, at);
  if (!r.ok) throw new Error(`expected a token, got ${r.reason}`);
  return r.token;
};

beforeEach(async () => {
  db.reset();
  seedBasics(db, []);
  if (!passwordHash) passwordHash = await hashPassword(PASSWORD);
  await addUser("alice");
  await addUser("bob");
});

describe("issuing a link token", () => {
  it("stores only hashes: neither the token nor the Telegram id appears in any stored row", async () => {
    const token = await issue(T_A);
    const dump = JSON.stringify(db.rows("telegramLinkChallenge"));
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(T_A);
    expect(db.rows("telegramLinkChallenge")[0].tokenHash).toBe(hashLinkToken(token));
    expect(db.rows("telegramLinkChallenge")[0].telegramHash).toBe(hashTelegramId(SECRET, T_A));
  });

  it("gives a 256-bit token that expires after 15 minutes", async () => {
    const r = await createLinkChallenge(SECRET, T_A, T0);
    expect(r.ok && r.token.length).toBe(43);
    expect(r.ok && r.expiresAt.getTime()).toBe(T0.getTime() + LINK_TTL_MS);
  });

  it("retires an earlier unused token, so only the most recent link works", async () => {
    const first = await issue(T_A);
    const second = await issue(T_A, new Date(T0.getTime() + 1000));
    expect(await confirmLink(first, "alice", new Date(T0.getTime() + 2000))).toEqual({ ok: false, reason: "invalid_or_expired" });
    expect(await confirmLink(second, "alice", new Date(T0.getTime() + 2000))).toEqual({ ok: true });
  });

  it("refuses to issue a token for a Telegram id that is already linked", async () => {
    const token = await issue(T_A);
    await confirmLink(token, "alice", T0);
    expect(await createLinkChallenge(SECRET, T_A, T0)).toEqual({ ok: false, reason: "already_linked" });
  });
});

describe("confirming a link", () => {
  it("links the signed-in account, and the token then cannot be used again", async () => {
    const token = await issue(T_A);
    expect(await confirmLink(token, "alice", T0)).toEqual({ ok: true });
    expect(db.rows("telegramLink")).toEqual([expect.objectContaining({ userId: "alice", telegramHash: hashTelegramId(SECRET, T_A) })]);
    expect(await confirmLink(token, "alice", T0)).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("rejects an expired token", async () => {
    const token = await issue(T_A);
    expect(await confirmLink(token, "alice", new Date(T0.getTime() + LINK_TTL_MS))).toEqual({ ok: false, reason: "invalid_or_expired" });
    expect(db.rows("telegramLink")).toHaveLength(0);
  });

  it("rejects a token that was never issued", async () => {
    expect(await confirmLink("A".repeat(43), "alice", T0)).toEqual({ ok: false, reason: "invalid_or_expired" });
  });

  it("refuses when the account is already linked to a different Telegram account, and does not spend the token", async () => {
    await confirmLink(await issue(T_A), "alice", T0);
    const forB = await issue(T_B);
    expect(await confirmLink(forB, "alice", T0)).toEqual({ ok: false, reason: "account_has_other_telegram" });
    expect(db.rows("telegramLinkChallenge").find((r) => r.tokenHash === hashLinkToken(forB))?.usedAt).toBeFalsy();
  });

  it("refuses when the Telegram account is linked to a different Algoryva account, and does not spend the token", async () => {
    // Issuing a token for an already-linked chat is refused up front, so this state is reached only by a race: a token was
    // issued, and another account claimed the same Telegram hash before it was spent. Seed that state directly.
    const token = await issue(T_A);
    db.seed("telegramLink", [{ userId: "bob", telegramHash: hashTelegramId(SECRET, T_A) }]);
    expect(await confirmLink(token, "alice", T0)).toEqual({ ok: false, reason: "telegram_in_use" });
    expect(db.rows("telegramLink").map((r) => r.userId)).toEqual(["bob"]);
    expect(db.rows("telegramLinkChallenge")[0].usedAt).toBeNull();
  });

  it("when two confirmations race for one token, exactly one links", async () => {
    const token = await issue(T_A);
    const results = await Promise.all([confirmLink(token, "alice", T0), confirmLink(token, "alice", T0)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "invalid_or_expired" }]);
    expect(db.rows("telegramLink")).toHaveLength(1);
  });
});

describe("status, unlinking and deletion", () => {
  it("reports only the username for a linked Telegram id, and nothing for an unlinked one", async () => {
    expect(await telegramStatus(SECRET, T_A)).toEqual({ linked: false });
    await confirmLink(await issue(T_A), "alice", T0);
    const status = await telegramStatus(SECRET, T_A);
    expect(status).toEqual({ linked: true, username: "alice" });
    expect(Object.keys(status).sort()).toEqual(["linked", "username"]);
  });

  it("unlinking by Telegram id is idempotent, and the chat stops being recognised", async () => {
    await confirmLink(await issue(T_A), "alice", T0);
    expect(await unlinkByTelegram(SECRET, T_A)).toEqual({ unlinked: true });
    expect(await unlinkByTelegram(SECRET, T_A)).toEqual({ unlinked: false });
    expect(await telegramStatus(SECRET, T_A)).toEqual({ linked: false });
  });

  it("unlinking from the website removes the link for that account only", async () => {
    await confirmLink(await issue(T_A), "alice", T0);
    await confirmLink(await issue(T_B), "bob", T0);
    expect(await unlinkForUser("alice")).toEqual({ unlinked: true });
    expect(db.rows("telegramLink").map((r) => r.userId)).toEqual(["bob"]);
  });

  it("deleting the account removes its Telegram link through the existing deletion routine", async () => {
    await confirmLink(await issue(T_A), "alice", T0);
    const r = await deleteAccount("alice", PASSWORD);
    expect(r).toEqual({ ok: true });
    expect(db.rows("telegramLink").filter((x) => x.userId === "alice")).toHaveLength(0);
    expect(await telegramStatus(SECRET, T_A)).toEqual({ linked: false });
  });

  it("the Telegram id is never stored in any linking table", async () => {
    await confirmLink(await issue(T_A), "alice", T0);
    const all = JSON.stringify([db.rows("telegramLink"), db.rows("telegramLinkChallenge")]);
    expect(all).not.toContain(T_A);
    expect(createHash("sha256").update(T_A).digest("hex")).not.toBe(db.rows("telegramLink")[0].telegramHash);
  });
});
