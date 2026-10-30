import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { req } from "@/lib/test-support/http";
import { signRequest, hashTelegramId } from "@/lib/telegram/bot-auth";
import { POST as createChallenge } from "@/app/api/internal/bot/v1/link-challenges/route";
import { POST as identity } from "@/app/api/internal/bot/v1/identity/route";
import { POST as unlink } from "@/app/api/internal/bot/v1/unlink/route";

const SECRET = "route-secret-for-tests-0123456789abcdefghij";
const SITE = "https://algoryva.example.test";
const T = "200000001";
const nonce = () => randomBytes(18).toString("base64url");

/** Builds a correctly signed bot request for `path`. */
function signed(path: string, body: unknown, opts: { secret?: string; n?: string } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const n = opts.n ?? nonce();
  const sig = signRequest(opts.secret ?? SECRET, ts, n, "POST", path, Buffer.from(text));
  return req(path, "POST", text, { "x-algoryva-bot-timestamp": ts, "x-algoryva-bot-nonce": n, "x-algoryva-bot-signature": sig });
}

const P = { challenge: "/api/internal/bot/v1/link-challenges", identity: "/api/internal/bot/v1/identity", unlink: "/api/internal/bot/v1/unlink" };

beforeEach(() => {
  db.reset();
  vi.stubEnv("TELEGRAM_BOT_API_SECRET", SECRET);
  vi.stubEnv("SITE_URL", SITE);
  db.seed("user", [{ id: "alice", email: "alice@example.test", username: "alice", passwordHash: "x", role: "USER", suspended: false, preferredLanguage: "python", emailVerifiedAt: null, pendingEmail: null }]);
});

describe("POST link-challenges", () => {
  it("issues a link URL whose token sits in the fragment, with no-store caching", async () => {
    const res = await createChallenge(signed(P.challenge, { telegramId: T }));
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["expiresAt", "linkUrl"]);
    expect(body.linkUrl.startsWith(`${SITE}/telegram/link#`)).toBe(true);
    expect(body.linkUrl.split("#")[1]).toHaveLength(43);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("refuses unknown fields and never echoes the value sent", async () => {
    const res = await createChallenge(signed(P.challenge, { telegramId: T, extra: "secret-value-xyz" }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain("secret-value-xyz");
  });

  it("refuses a malformed Telegram id before any lookup", async () => {
    const res = await createChallenge(signed(P.challenge, { telegramId: "abc-not-a-number" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when the Telegram account is already linked", async () => {
    db.seed("telegramLink", [{ userId: "alice", telegramHash: hashTelegramId(SECRET, T) }]);
    const res = await createChallenge(signed(P.challenge, { telegramId: T }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("already_linked");
  });

  it("allows five challenges per Telegram id per hour, then rate-limits", async () => {
    for (let i = 0; i < 5; i++) expect((await createChallenge(signed(P.challenge, { telegramId: T }))).status).toBe(201);
    const blocked = await createChallenge(signed(P.challenge, { telegramId: T }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("refuses to run when SITE_URL is not a safe origin, so no link can point elsewhere", async () => {
    vi.stubEnv("SITE_URL", "http://evil.example.test");
    const res = await createChallenge(signed(P.challenge, { telegramId: T }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("bot_api_misconfigured");
  });

  it("refuses everything, with no detail, when the secret is missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_API_SECRET", "");
    const res = await createChallenge(signed(P.challenge, { telegramId: T }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("bot_api_disabled");
  });
});

describe("POST identity", () => {
  it("returns only linked and username for a linked chat", async () => {
    db.seed("telegramLink", [{ userId: "alice", telegramHash: hashTelegramId(SECRET, T) }]);
    const body = await (await identity(signed(P.identity, { telegramId: T }))).json();
    expect(body).toEqual({ linked: true, username: "alice" });
  });

  it("returns only linked: false for an unlinked chat", async () => {
    expect(await (await identity(signed(P.identity, { telegramId: T }))).json()).toEqual({ linked: false });
  });

  it("refuses an unsigned request and records no nonce", async () => {
    const unsigned = req(P.identity, "POST", JSON.stringify({ telegramId: T }), {});
    const res = await identity(unsigned);
    expect(res.status).toBe(401);
    expect(db.rows("botNonce")).toHaveLength(0);
  });

  it("refuses a replayed request", async () => {
    const n = nonce();
    db.seed("telegramLink", [{ userId: "alice", telegramHash: hashTelegramId(SECRET, T) }]);
    expect((await identity(signed(P.identity, { telegramId: T }, { n }))).status).toBe(200);
    // Same nonce again, freshly signed: the signature is valid, but the nonce has been used, so it is a replay.
    expect((await identity(signed(P.identity, { telegramId: T }, { n }))).status).toBe(401);
  });
});

describe("POST unlink", () => {
  it("is idempotent: first call unlinks, second call reports nothing to unlink", async () => {
    db.seed("telegramLink", [{ userId: "alice", telegramHash: hashTelegramId(SECRET, T) }]);
    expect(await (await unlink(signed(P.unlink, { telegramId: T }))).json()).toEqual({ unlinked: true });
    expect(await (await unlink(signed(P.unlink, { telegramId: T }))).json()).toEqual({ unlinked: false });
    expect(db.rows("telegramLink")).toHaveLength(0);
  });
});
