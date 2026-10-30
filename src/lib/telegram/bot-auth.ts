import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";

/**
 * Server-to-server authentication for the Telegram bot's internal API. Every request is signed with a key derived from
 * TELEGRAM_BOT_API_SECRET; the bot process holds that secret and no database credentials. The bot is never a website user:
 * it can only call the fixed routes under /api/internal/bot/v1, and every route is scoped to the Telegram user it names.
 *
 * Signed string (each field on its own line, so no field can be confused with another):
 *   algoryva-bot-v1 \n <timestamp> \n <nonce> \n <METHOD> \n <path> \n <sha256 hex of the raw body>
 * Checks, in order: header format, timestamp window (±5 minutes), body size, signature (constant time), then the nonce
 * is recorded. A nonce is consumed only by a request whose signature is valid, so unauthenticated callers cannot fill the table.
 */

export const BOT_TIMESTAMP_HEADER = "x-algoryva-bot-timestamp";
export const BOT_NONCE_HEADER = "x-algoryva-bot-nonce";
export const BOT_SIGNATURE_HEADER = "x-algoryva-bot-signature";
export const MAX_SKEW_SECONDS = 300;
const MIN_SECRET_LENGTH = 32;

const TIMESTAMP_RE = /^[0-9]{10}$/;
const NONCE_RE = /^[A-Za-z0-9_-]{22,64}$/;
const SIGNATURE_RE = /^[0-9a-f]{64}$/;

export type BotEnv = { readonly TELEGRAM_BOT_API_SECRET?: string; readonly [key: string]: string | undefined };

const unauthorized = () => new ApiError(401, "unauthorized", "The request is not authorized.");

/** The shared secret, or a 503 that names no value. Routes refuse to run without a strong secret. */
export function botSecret(env: BotEnv = process.env): string {
  const secret = env.TELEGRAM_BOT_API_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) throw new ApiError(503, "bot_api_disabled", "The bot API is not configured.");
  return secret;
}

/** One key per purpose, derived from the single secret, so a signing key is never reused for hashing Telegram ids. */
export function deriveKey(secret: string, purpose: "request-signing" | "telegram-id"): Buffer {
  return createHmac("sha256", secret).update(`algoryva-derive-v1:${purpose}`).digest();
}

export function canonicalString(timestamp: string, nonce: string, method: string, path: string, body: Uint8Array): string {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  return ["algoryva-bot-v1", timestamp, nonce, method.toUpperCase(), path, bodyHash].join("\n");
}

export function signRequest(secret: string, timestamp: string, nonce: string, method: string, path: string, body: Uint8Array): string {
  return createHmac("sha256", deriveKey(secret, "request-signing")).update(canonicalString(timestamp, nonce, method, path, body)).digest("hex");
}

/** HMAC of a Telegram user id. The id itself is never stored, and this value cannot be reversed without the secret. */
export function hashTelegramId(secret: string, telegramId: string): string {
  return createHmac("sha256", deriveKey(secret, "telegram-id")).update(telegramId).digest("hex");
}

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Reads the raw body with a hard limit counted on the bytes actually received (a Content-Length header can be wrong). */
async function readRaw(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError(413, "payload_too_large", "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new ApiError(413, "payload_too_large", "The request is too large."); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Authenticates a signed bot request and returns its parsed JSON body. Throws ApiError on any failure. The failure message is
 * the same for every authentication problem, so a caller learns nothing about which check failed.
 */
export async function readSignedJson(request: Request, maxBytes: number, env: BotEnv = process.env, now: number = Date.now()): Promise<unknown> {
  const secret = botSecret(env);
  const timestamp = request.headers.get(BOT_TIMESTAMP_HEADER) ?? "";
  const nonce = request.headers.get(BOT_NONCE_HEADER) ?? "";
  const signature = request.headers.get(BOT_SIGNATURE_HEADER) ?? "";
  if (!TIMESTAMP_RE.test(timestamp) || !NONCE_RE.test(nonce) || !SIGNATURE_RE.test(signature)) throw unauthorized();
  if (Math.abs(now / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) throw unauthorized();

  const path = new URL(request.url).pathname;
  const body = await readRaw(request, maxBytes);
  const expected = signRequest(secret, timestamp, nonce, request.method, path, body);
  if (!sameHex(signature, expected)) throw unauthorized();

  // Recorded only after the signature is valid. createMany with skipDuplicates is an atomic insert on the primary key,
  // so two identical requests racing each other cannot both succeed.
  const { count } = await db.botNonce.createMany({ data: [{ nonce }], skipDuplicates: true });
  if (count === 0) throw unauthorized();
  if (Math.random() < 0.02) await db.botNonce.deleteMany({ where: { createdAt: { lt: new Date(now - 2 * MAX_SKEW_SECONDS * 1000) } } });

  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new ApiError(400, "invalid_request", "The request body must be a JSON object.");
  }
}
