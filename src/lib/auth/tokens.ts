import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const sha = (t: string) => createHash("sha256").update(t).digest("hex");

export type TokenType = "reset" | "verify" | "change-email";

export async function createToken(userId: string, type: TokenType, ttlMs: number) {
  const raw = randomBytes(32).toString("hex");
  await db.verificationToken.create({ data: { userId, type, tokenHash: sha(raw), expiresAt: new Date(Date.now() + ttlMs) } });
  return raw;
}

/** Single use: returns the user id only for the caller that flips usedAt. */
export async function consumeToken(raw: string, type: TokenType): Promise<string | null> {
  if (!raw) return null;
  const t = await db.verificationToken.findUnique({ where: { tokenHash: sha(raw) } });
  if (!t || t.type !== type || t.usedAt || t.expiresAt < new Date()) return null;
  const r = await db.verificationToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  return r.count === 1 ? t.userId : null;
}
