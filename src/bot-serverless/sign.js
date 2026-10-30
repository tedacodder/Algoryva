// Request signing with Web Crypto only (available in Node 20+, Deno, Bun and edge runtimes). Must match the website's signing exactly:
//   canonical = "algoryva-bot-v1" \n timestamp \n nonce \n METHOD \n path \n sha256(body)
//   signature = HMAC-SHA256(derive("request-signing"), canonical), hex
const enc = new TextEncoder();

async function hmac(keyBytes, messageBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, messageBytes));
}

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const toBase64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function deriveKey(secret, purpose) {
  return hmac(enc.encode(secret), enc.encode(`algoryva-derive-v1:${purpose}`));
}

export function newNonce() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(18))); // 24 characters, inside the accepted 22 to 64 range
}

export async function signRequest(secret, timestamp, nonce, method, path, bodyBytes) {
  const bodyHash = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bodyBytes)));
  const canonical = ["algoryva-bot-v1", timestamp, nonce, method.toUpperCase(), path, bodyHash].join("\n");
  return toHex(await hmac(await deriveKey(secret, "request-signing"), enc.encode(canonical)));
}

export async function signedHeaders(secret, method, path, bodyBytes, nowMs = Date.now()) {
  const timestamp = String(Math.floor(nowMs / 1000));
  const nonce = newNonce();
  return {
    "x-algoryva-bot-timestamp": timestamp,
    "x-algoryva-bot-nonce": nonce,
    "x-algoryva-bot-signature": await signRequest(secret, timestamp, nonce, method, path, bodyBytes),
  };
}
