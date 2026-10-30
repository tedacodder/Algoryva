import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ApiError } from "@/lib/api/errors";

/**
 * Chat ids are encrypted at rest with AES-256-GCM. The key comes from TELEGRAM_CHAT_KEY (32 random bytes, base64). It is separate
 * from the bot API secret, so rotating one never breaks the other. Losing the key makes stored chats unreadable, so back it up.
 */
const ALG = "aes-256-gcm";

export type CipherEnv = { readonly TELEGRAM_CHAT_KEY?: string; readonly [key: string]: string | undefined };

export function chatKey(env: CipherEnv = process.env): Buffer {
  const raw = env.TELEGRAM_CHAT_KEY ?? "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw) throw new ApiError(503, "bot_api_disabled", "The bot API is not configured.");
  return key;
}

export function encryptChatId(key: Buffer, chatId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const body = Buffer.concat([cipher.update(chatId, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Throws when the value was tampered with, was made with another key, or is malformed. */
export function decryptChatId(key: Buffer, value: string): string {
  const [version, iv, tag, body] = value.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("malformed chat cipher");
  const decipher = createDecipheriv(ALG, key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
