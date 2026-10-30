import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { hashTelegramId } from "@/lib/telegram/bot-auth";

/** Link tokens are valid for 15 minutes and work once. */
export const LINK_TTL_MS = 15 * 60_000;
const TOKEN_BYTES = 32; // 256 bits, which is 43 characters in base64url
const PRUNE_AFTER_MS = 24 * 3_600_000;

export type ConfirmReason = "invalid_or_expired" | "account_has_other_telegram" | "telegram_in_use";
export type ConfirmResult = { ok: true } | { ok: false; reason: ConfirmReason };

/** Only the hash of a token is stored, so a database copy cannot be used to confirm a link. */
export function hashLinkToken(token: string): string {
  return createHash("sha256").update(`telegram-link-token-v1:${token}`).digest("hex");
}

class ChallengeSpent extends Error {}

const isUniqueViolation = (e: unknown): boolean => typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

/**
 * Issues a new link token for a Telegram user. Any earlier unused token for the same user is retired, so only the most recent
 * link works. Returns the raw token once; it is never stored.
 */
export async function createLinkChallenge(secret: string, telegramId: string, now: Date): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; reason: "already_linked" }> {
  const telegramHash = hashTelegramId(secret, telegramId);
  if (await db.telegramLink.findUnique({ where: { telegramHash } })) return { ok: false, reason: "already_linked" };
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
  await db.$transaction(async (tx) => {
    await tx.telegramLinkChallenge.updateMany({ where: { telegramHash, usedAt: null }, data: { usedAt: now } });
    await tx.telegramLinkChallenge.create({ data: { telegramHash, tokenHash: hashLinkToken(token), expiresAt } });
    await tx.telegramLinkChallenge.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - PRUNE_AFTER_MS) } } });
  });
  return { ok: true, token, expiresAt };
}

/** The Algoryva username a Telegram user is linked to, or unlinked. Returns nothing else. */
export async function telegramStatus(secret: string, telegramId: string): Promise<{ linked: true; username: string } | { linked: false }> {
  const link = await db.telegramLink.findUnique({ where: { telegramHash: hashTelegramId(secret, telegramId) }, select: { user: { select: { username: true } } } });
  return link ? { linked: true, username: link.user.username } : { linked: false };
}

/**
 * Spends a token and links the signed-in account to the Telegram user it was issued for. Every check that can fail is made
 * before the token is spent, except the database uniqueness checks, which run inside the same transaction as the spend, so a
 * failure rolls the spend back.
 */
export async function confirmLink(token: string, userId: string, now: Date): Promise<ConfirmResult> {
  const fail = (reason: ConfirmReason): ConfirmResult => ({ ok: false, reason });
  const challenge = await db.telegramLinkChallenge.findUnique({ where: { tokenHash: hashLinkToken(token) } });
  if (!challenge || challenge.usedAt || challenge.expiresAt.getTime() <= now.getTime()) return fail("invalid_or_expired");

  const mine = await db.telegramLink.findUnique({ where: { userId } });
  if (mine && mine.telegramHash !== challenge.telegramHash) return fail("account_has_other_telegram");
  if (!mine && (await db.telegramLink.findUnique({ where: { telegramHash: challenge.telegramHash } }))) return fail("telegram_in_use");

  try {
    await db.$transaction(async (tx) => {
      const spent = await tx.telegramLinkChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: now } });
      if (spent.count !== 1) throw new ChallengeSpent();
      if (!mine) await tx.telegramLink.create({ data: { userId, telegramHash: challenge.telegramHash } });
      // The chat that asked for the link is now this account's chat: attach its community subscription (if any) to the account.
      await tx.telegramRecipient.updateMany({ where: { chatHash: challenge.telegramHash }, data: { userId } });
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof ChallengeSpent) return fail("invalid_or_expired");
    if (isUniqueViolation(e)) {
      // A concurrent request linked one of the two sides first. Work out which side it was.
      const owner = await db.telegramLink.findUnique({ where: { telegramHash: challenge.telegramHash } });
      return fail(owner ? "telegram_in_use" : "account_has_other_telegram");
    }
    throw e;
  }
}

/** Removes the link for one Telegram user (used by the bot's /unlink). Idempotent. */
export async function unlinkByTelegram(secret: string, telegramId: string): Promise<{ unlinked: boolean }> {
  const hash = hashTelegramId(secret, telegramId);
  // The community subscription stays, but it is no longer tied to an account, so account deletion no longer removes it.
  await db.telegramRecipient.updateMany({ where: { chatHash: hash }, data: { userId: null } });
  const r = await db.telegramLink.deleteMany({ where: { telegramHash: hash } });
  return { unlinked: r.count > 0 };
}

/** Removes the link from the website side. Idempotent. */
export async function unlinkForUser(userId: string): Promise<{ unlinked: boolean }> {
  await db.telegramRecipient.updateMany({ where: { userId }, data: { userId: null } });
  const r = await db.telegramLink.deleteMany({ where: { userId } });
  return { unlinked: r.count > 0 };
}

/** The Algoryva account behind a linked chat, and whether it is suspended. Null when the chat is not linked. */
export async function linkedAccount(secret: string, telegramId: string): Promise<{ userId: string; suspended: boolean } | null> {
  const link = await db.telegramLink.findUnique({
    where: { telegramHash: hashTelegramId(secret, telegramId) },
    select: { userId: true, user: { select: { suspended: true } } },
  });
  return link ? { userId: link.userId, suspended: link.user.suspended } : null;
}

/** Turns the leaderboard on or off for a linked chat. Returns null when the chat is not linked. */
export async function setLeaderboardOptIn(secret: string, telegramId: string, optIn: boolean): Promise<{ leaderboardOptIn: boolean } | null> {
  const r = await db.telegramLink.updateMany({ where: { telegramHash: hashTelegramId(secret, telegramId) }, data: { leaderboardOptIn: optIn } });
  return r.count === 1 ? { leaderboardOptIn: optIn } : null;
}

/** The linked account for a chat. Throws 403 when the chat is unlinked or the account is suspended, with one message for both. */
export async function requireLinkedUserId(secret: string, telegramId: string): Promise<string> {
  const account = await linkedAccount(secret, telegramId);
  if (!account || account.suspended) throw new ApiError(403, "not_linked", "This chat is not connected to an Algoryva account. Send /link to connect it.");
  return account.userId;
}
