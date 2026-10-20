import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { seedBasics } from "@/lib/test-support/seed";
import { MOBILE_SESSION_TTL_MS, authenticate, bearerToken, createMobileSession, generateMobileToken, hashMobileToken, mobileDeviceLabel } from "@/lib/api/mobile-auth";

const webHash = (t: string) => createHash("sha256").update(t).digest("hex"); // what src/lib/auth/session.ts stores for a cookie
const withAuth = (token: string | null, scheme = "Bearer") => new Request("http://x/api/v1/me", { headers: token === null ? {} : { authorization: `${scheme} ${token}` } });
const code401 = { status: 401, code: "unauthorized" };

beforeEach(() => { db.reset(); seedBasics(db, ["u1"]); });

describe("token generation and hashing", () => {
  it("makes a 43-character base64url secret with a fixed prefix, from 32 random bytes", () => {
    const t = generateMobileToken();
    expect(t).toMatch(/^alv_[A-Za-z0-9_-]{43}$/);
    expect(new Set(Array.from({ length: 200 }, generateMobileToken)).size).toBe(200);
  });
  it("hashes with a domain prefix, so it never equals the website's hash of the same value", () => {
    const t = generateMobileToken();
    expect(hashMobileToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashMobileToken(t)).not.toBe(webHash(t));
    expect(hashMobileToken(t)).toBe(createHash("sha256").update("algoryva-mobile-v1:" + t).digest("hex"));
  });
});

describe("createMobileSession", () => {
  it("stores only the hash, a 30-day expiry and the device label", async () => {
    const before = Date.now();
    const { token, expiresAt } = await createMobileSession("u1", "Algoryva Android app");
    const row = db.rows("session")[0];
    expect(row).toMatchObject({ userId: "u1", tokenHash: hashMobileToken(token), device: "Algoryva Android app" });
    expect(JSON.stringify(row)).not.toContain(token);
    expect(MOBILE_SESSION_TTL_MS).toBe(30 * 86_400_000);
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(MOBILE_SESSION_TTL_MS - 1000);
    expect(expiresAt.getTime() - before).toBeLessThan(MOBILE_SESSION_TTL_MS + 5000);
    expect(row.expiresAt).toEqual(expiresAt);
  });
});

describe("bearerToken", () => {
  const good = "alv_" + "a".repeat(43);
  it("accepts only 'Bearer <well-formed token>'", () => {
    expect(bearerToken(withAuth(good))).toBe(good);
    for (const bad of [withAuth(good, "bearer"), withAuth(good, "Basic"), withAuth(null), withAuth("alv_short"), withAuth(good + "x"), withAuth("a".repeat(64)), withAuth("alv_" + "!".repeat(43)), new Request("http://x", { headers: { authorization: `Bearer  ${good}` } }), new Request("http://x", { headers: { authorization: good } })]) {
      expect(bearerToken(bad)).toBeNull();
    }
  });
});

describe("authenticate", () => {
  it("accepts a valid, unexpired token of an active user and returns an allowlisted user", async () => {
    const { token } = await createMobileSession("u1", "d");
    const r = await authenticate(withAuth(token));
    expect(r.user).toEqual({ id: "u1", email: "u1@example.test", username: "u1", role: "USER", preferredLanguage: "python", emailVerifiedAt: null });
    expect(r.tokenHash).toBe(hashMobileToken(token));
    expect(JSON.stringify(r)).not.toContain("passwordHash");
  });

  it("rejects every failure with the same 401: missing, malformed, unknown, expired, suspended", async () => {
    const { token } = await createMobileSession("u1", "d");
    const expired = await createMobileSession("u1", "d2");
    db.rows("session")[1].expiresAt = new Date(Date.now() - 1000);
    const messages = new Set<string>();
    const cases: Request[] = [withAuth(null), withAuth("garbage"), withAuth(generateMobileToken()), withAuth(expired.token)];
    for (const c of cases) { const e = await authenticate(c).catch((x) => x); expect(e).toMatchObject(code401); messages.add(e.message); }
    db.rows("user")[0].suspended = true;
    const s = await authenticate(withAuth(token)).catch((x) => x);
    expect(s).toMatchObject(code401); messages.add(s.message);
    expect(messages.size).toBe(1); // a caller learns nothing about why
  });

  it("a session row with the website's hash can never be used as a bearer token", async () => {
    const t = generateMobileToken(); // well-formed, but registered the way a WEB session would be
    db.seed("session", [{ id: "s", userId: "u1", tokenHash: webHash(t), expiresAt: new Date(Date.now() + 1e9), device: "web" }]);
    await expect(authenticate(withAuth(t))).rejects.toMatchObject(code401);
  });

  it("a mobile token's value cannot be found by the website's lookup (web hashes the bare value)", async () => {
    const { token } = await createMobileSession("u1", "d");
    expect(db.rows("session").some((s) => s.tokenHash === webHash(token))).toBe(false);
  });

  it("expiry is enforced on every request, including exactly at the expiry time", async () => {
    const { token } = await createMobileSession("u1", "d");
    db.rows("session")[0].expiresAt = new Date(Date.now() + 60_000);
    await expect(authenticate(withAuth(token))).resolves.toBeTruthy();
    db.rows("session")[0].expiresAt = new Date(Date.now());
    await expect(authenticate(withAuth(token))).rejects.toMatchObject(code401);
  });

  it("a deleted session (logout, password reset, suspension) stops working immediately", async () => {
    const { token } = await createMobileSession("u1", "d");
    db.t.session.rows = [];
    await expect(authenticate(withAuth(token))).rejects.toMatchObject(code401);
  });
});

describe("mobileDeviceLabel", () => {
  it("uses a fixed label, or a sanitised short name", () => {
    expect(mobileDeviceLabel()).toBe("Algoryva Android app");
    expect(mobileDeviceLabel("   ")).toBe("Algoryva Android app");
    expect(mobileDeviceLabel("Pixel 7")).toBe("Algoryva app on Pixel 7");
    expect(mobileDeviceLabel("<b>x</b>\n\t y")).toBe("Algoryva app on bx/b y");
    expect(mobileDeviceLabel("z".repeat(200)).length).toBe("Algoryva app on ".length + 40);
  });
});
