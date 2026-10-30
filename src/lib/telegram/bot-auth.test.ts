import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { req } from "@/lib/test-support/http";
import { botSecret, canonicalString, deriveKey, hashTelegramId, readSignedJson, signRequest } from "@/lib/telegram/bot-auth";

const SECRET = "bot-secret-for-tests-0123456789abcdef";
const PATH = "/api/internal/bot/v1/identity";
const nonce = () => randomBytes(18).toString("base64url");
const nowSec = () => Math.floor(Date.now() / 1000);
const NOW = Date.now();

/** A correctly signed request. Options let a test break exactly one part of it. */
function signed(body: string, opts: { secret?: string; ts?: number; n?: string; method?: string; path?: string; sig?: string } = {}) {
  const ts = String(opts.ts ?? nowSec());
  const n = opts.n ?? nonce();
  const method = opts.method ?? "POST";
  const sig = opts.sig ?? signRequest(opts.secret ?? SECRET, ts, n, method, opts.path ?? PATH, Buffer.from(body));
  return req(PATH, method, body, { "x-algoryva-bot-timestamp": ts, "x-algoryva-bot-nonce": n, "x-algoryva-bot-signature": sig });
}

async function expectUnauthorized(p: Promise<unknown>) {
  await expect(p).rejects.toMatchObject({ status: 401, code: "unauthorized", message: "The request is not authorized." });
}

beforeEach(() => { db.reset(); vi.stubEnv("TELEGRAM_BOT_API_SECRET", SECRET); });

describe("signing primitives", () => {
  it("the canonical string changes when any signed field changes", () => {
    const base = canonicalString("1700000000", "n".repeat(22), "POST", "/p", Buffer.from("{}"));
    expect(canonicalString("1700000001", "n".repeat(22), "POST", "/p", Buffer.from("{}"))).not.toBe(base);
    expect(canonicalString("1700000000", "m".repeat(22), "POST", "/p", Buffer.from("{}"))).not.toBe(base);
    expect(canonicalString("1700000000", "n".repeat(22), "GET", "/p", Buffer.from("{}"))).not.toBe(base);
    expect(canonicalString("1700000000", "n".repeat(22), "POST", "/q", Buffer.from("{}"))).not.toBe(base);
    expect(canonicalString("1700000000", "n".repeat(22), "POST", "/p", Buffer.from("{ }"))).not.toBe(base);
  });

  it("keys are separated by purpose, so the signing key is never used to hash Telegram ids", () => {
    expect(deriveKey(SECRET, "request-signing").equals(deriveKey(SECRET, "telegram-id"))).toBe(false);
    expect(hashTelegramId(SECRET, "123456")).not.toBe(signRequest(SECRET, "1", "x".repeat(22), "POST", "/", Buffer.from("123456")));
  });

  it("does not expose the Telegram id in its hash", () => {
    expect(hashTelegramId(SECRET, "987654321")).not.toContain("987654321");
  });

  it("refuses to run without a strong secret, and the error names no value", () => {
    expect(() => botSecret({})).toThrow(expect.objectContaining({ status: 503, code: "bot_api_disabled" }));
    try { botSecret({ TELEGRAM_BOT_API_SECRET: "short-secret" }); } catch (e) {
      expect(JSON.stringify(e)).not.toContain("short-secret");
      expect((e as { status: number }).status).toBe(503);
    }
  });
});

describe("readSignedJson", () => {
  it("accepts a correctly signed request and returns its body", async () => {
    await expect(readSignedJson(signed(JSON.stringify({ telegramId: "123456" })), 8192)).resolves.toEqual({ telegramId: "123456" });
  });

  it("rejects a tampered body, a wrong secret, a wrong method, and a wrong path, all with the same message", async () => {
    const good = JSON.stringify({ telegramId: "123456" });
    const sig = signRequest(SECRET, String(nowSec()), nonce(), "POST", PATH, Buffer.from(good));
    const tampered = req(PATH, "POST", JSON.stringify({ telegramId: "654321" }), { "x-algoryva-bot-timestamp": String(nowSec()), "x-algoryva-bot-nonce": nonce(), "x-algoryva-bot-signature": sig });
    await expectUnauthorized(readSignedJson(tampered, 8192));
    await expectUnauthorized(readSignedJson(signed(good, { secret: "a-different-secret-entirely-0123456789" }), 8192));
    const otherPath = signed(good, { path: "/api/internal/bot/v1/unlink" });
    await expectUnauthorized(readSignedJson(otherPath, 8192));
  });

  it("rejects a method mismatch between what was signed and what was sent", async () => {
    // Signed as GET (no body is possible on GET), then sent as POST with the same headers and body.
    const body = JSON.stringify({ telegramId: "123456" });
    const ts = String(nowSec());
    const n = nonce();
    const sig = signRequest(SECRET, ts, n, "GET", PATH, Buffer.from(body));
    const sentAsPost = req(PATH, "POST", body, { "x-algoryva-bot-timestamp": ts, "x-algoryva-bot-nonce": n, "x-algoryva-bot-signature": sig });
    await expectUnauthorized(readSignedJson(sentAsPost, 8192));
  });

  it("rejects stale and future timestamps outside the five-minute window", async () => {
    const body = JSON.stringify({ telegramId: "123456" });
    await expectUnauthorized(readSignedJson(signed(body, { ts: nowSec() - 301 }), 8192));
    await expectUnauthorized(readSignedJson(signed(body, { ts: nowSec() + 301 }), 8192));
    await expect(readSignedJson(signed(body, { ts: nowSec() - 299 }), 8192)).resolves.toBeDefined();
  });

  it("rejects malformed headers without reading the body", async () => {
    await expectUnauthorized(readSignedJson(req(PATH, "POST", "{}", { "x-algoryva-bot-timestamp": "yesterday", "x-algoryva-bot-nonce": nonce(), "x-algoryva-bot-signature": "0".repeat(64) }), 8192));
    await expectUnauthorized(readSignedJson(req(PATH, "POST", "{}", {}), 8192));
  });

  it("refuses a replayed request, and a failed attempt does not use up its nonce", async () => {
    const n = nonce();
    const body = JSON.stringify({ telegramId: "123456" });
    // A forged request reusing the nonce fails the signature check and must not consume the nonce.
    await expectUnauthorized(readSignedJson(signed(body, { n, sig: "f".repeat(64) }), 8192));
    await expect(readSignedJson(signed(body, { n }), 8192)).resolves.toBeDefined();
    // The same valid request again is a replay.
    await expectUnauthorized(readSignedJson(signed(body, { n }), 8192));
  });

  it("refuses bodies over the limit, even when correctly signed", async () => {
    const big = JSON.stringify({ telegramId: "123456", pad: "x".repeat(9000) });
    await expect(readSignedJson(signed(big), 8192)).rejects.toMatchObject({ status: 413, code: "payload_too_large" });
  });

  it("returns 400 for a correctly signed body that is not a JSON object", async () => {
    await expect(readSignedJson(signed("[1,2,3]"), 8192)).rejects.toMatchObject({ status: 400, code: "invalid_request" });
    await expect(readSignedJson(signed("not json"), 8192)).rejects.toMatchObject({ status: 400, code: "invalid_request" });
  });

  it("stores the nonce it accepted, so the table records replay protection", async () => {
    const n = nonce();
    await readSignedJson(signed("{}", { n }), 8192, undefined, NOW);
    expect(db.rows("botNonce").some((r) => r.nonce === n)).toBe(true);
  });

  it("is wired to the test secret through the environment, not a hard-coded value", async () => {
    vi.stubEnv("TELEGRAM_BOT_API_SECRET", "");
    await expect(readSignedJson(signed("{}"), 8192)).rejects.toMatchObject({ status: 503, code: "bot_api_disabled" });
  });
});

describe("cross-language test vector", () => {
  // The Python bot (algoryva-bot) pins the same vector. If either implementation changes the signed string, both suites fail.
  it("produces the signature and Telegram id hash the bot client expects", () => {
    const secret = "cross-language-vector-secret-0123456789";
    const body = Buffer.from('{"telegramId":"123456789"}');
    expect(signRequest(secret, "1761408000", "cHl0aG9uLW5vbmNlLTAwMDAwMDAw", "POST", "/api/internal/bot/v1/identity", body))
      .toBe("95a4338808cf3c7b52a030d41a68ac1ed0f367b28395024ceebfeac889aedd9b");
    expect(hashTelegramId(secret, "123456789")).toBe("bdb514175eb262f81469c54652b96ead474d57654acc87e0c395d792ec380e95");
  });
});
