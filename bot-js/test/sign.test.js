import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { signRequest, signedHeaders, newNonce } from "../src/sign.js";

const SECRET = "cross-language-vector-secret-0123456789";

test("matches the Python and website test vector", async () => {
  const body = new TextEncoder().encode('{"telegramId":"123456789"}');
  const sig = await signRequest(SECRET, "1761408000", "cHl0aG9uLW5vbmNlLTAwMDAwMDAw", "POST", "/api/internal/bot/v1/identity", body);
  assert.equal(sig, "95a4338808cf3c7b52a030d41a68ac1ed0f367b28395024ceebfeac889aedd9b");
});

test("agrees with an independent Node implementation on fresh inputs", async () => {
  const body = new TextEncoder().encode(JSON.stringify({ chatId: "-1009000000001", enable: true }));
  const nonce = newNonce();
  const ours = await signRequest(SECRET, "1761408123", nonce, "post", "/api/internal/bot/v1/community/group", body);
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonical = ["algoryva-bot-v1", "1761408123", nonce, "POST", "/api/internal/bot/v1/community/group", bodyHash].join("\n");
  const derived = createHmac("sha256", SECRET).update("algoryva-derive-v1:request-signing").digest();
  assert.equal(ours, createHmac("sha256", derived).update(canonical).digest("hex"));
});

test("headers have the shape the website accepts, and nonces differ", async () => {
  const headers = await signedHeaders(SECRET, "POST", "/p", new Uint8Array(), 1761408000_000);
  assert.equal(headers["x-algoryva-bot-timestamp"], "1761408000");
  assert.match(headers["x-algoryva-bot-nonce"], /^[A-Za-z0-9_-]{22,64}$/);
  assert.match(headers["x-algoryva-bot-signature"], /^[0-9a-f]{64}$/);
  const nonces = new Set(Array.from({ length: 200 }, () => newNonce()));
  assert.equal(nonces.size, 200);
});
