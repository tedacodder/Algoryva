import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ headers: {} as Record<string, string>, devices: [] as string[], sentVerification: vi.fn(async () => true), sentSignIn: vi.fn(async () => true) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(h.headers) }));
vi.mock("@/lib/auth/account-mail", () => ({ sendVerificationEmail: h.sentVerification, sendNewSignInEmail: h.sentSignIn }));
vi.mock("@/lib/auth/session", () => ({ knownDevices: async () => h.devices }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { seedBasics } from "@/lib/test-support/seed";
import { bearer, body, req } from "@/lib/test-support/http";
import { hashPassword } from "@/lib/auth/password";
import { hashMobileToken } from "@/lib/api/mobile-auth";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { GET as me } from "@/app/api/v1/me/route";

const PASSWORD = "correct horse battery";
let passwordHash = "";
beforeAll(async () => { passwordHash = await hashPassword(PASSWORD); });
beforeEach(() => { db.reset(); seedBasics(db, []); h.headers = {}; h.devices = []; h.sentVerification.mockClear(); h.sentSignIn.mockClear(); vi.unstubAllEnvs(); });

const addUser = (over: Record<string, unknown> = {}) => db.seed("user", [{ id: "u1", email: "ana@example.test", username: "ana", passwordHash, role: "USER", suspended: false, preferredLanguage: "python", emailVerifiedAt: null, pendingEmail: null, ...over }]);
const doRegister = (b: unknown) => register(req("/api/v1/auth/register", "POST", b));
const doLogin = (b: unknown) => login(req("/api/v1/auth/login", "POST", b));
const attempts = (prefix: string) => db.rows("authAttempt").filter((a) => String(a.key).startsWith(prefix)).length;

describe("POST /auth/register", () => {
  const good = { email: "New@Example.test", username: "newuser", password: PASSWORD };

  it("creates the account with the website's normalisation, a hashed password, and a mobile token", async () => {
    const r = await doRegister({ ...good, deviceName: "Pixel 7" });
    expect(r.status).toBe(201);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const b = await body(r);
    expect(b.token).toMatch(/^alv_[A-Za-z0-9_-]{43}$/);
    expect(new Date(b.expiresAt).getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect(b.user).toEqual({ id: expect.any(String), email: "new@example.test", username: "newuser", emailVerified: false, preferredLanguage: expect.any(String) });
    expect(JSON.stringify(b)).not.toMatch(/passwordHash|scrypt/);
    const user = db.rows("user")[0];
    expect(user.passwordHash).not.toBe(PASSWORD);
    expect(db.rows("session")[0]).toMatchObject({ userId: user.id, tokenHash: hashMobileToken(b.token), device: "Algoryva app on Pixel 7" });
    expect(h.sentVerification).toHaveBeenCalledWith(user.id, "new@example.test");
  });

  it("applies the website's validation rules and returns its messages", async () => {
    for (const bad of [{ ...good, email: "nope" }, { ...good, username: "x" }, { ...good, password: "short" }]) {
      const r = await doRegister(bad);
      expect(r.status).toBe(400);
      expect((await body(r)).error.code).toBe("invalid_request");
    }
    expect(db.rows("user")).toHaveLength(0);
  });

  it("rejects unknown fields, non-JSON bodies and non-objects", async () => {
    expect((await doRegister({ ...good, role: "ADMIN" })).status).toBe(400);
    expect((await register(req("/api/v1/auth/register", "POST", "plain", { "content-type": "text/plain" }))).status).toBe(415);
    expect((await doRegister([])).status).toBe(400);
  });

  it("409 for a taken email or username, with the website's message; a race on the unique index is also 409", async () => {
    addUser();
    const r = await doRegister({ ...good, email: "ana@example.test" });
    expect(r.status).toBe(409);
    expect(await body(r)).toEqual({ error: { code: "account_exists", message: "That email or username is already in use." } });
    expect((await doRegister({ ...good, username: "ana" })).status).toBe(409);
    db.t.user.rows = [];
    db.user.create = (async () => { throw Object.assign(new Error("dup"), { code: "P2002" }); }) as typeof db.user.create;
    expect((await doRegister(good)).status).toBe(409);
  });

  it("uses the website's per-email key and limit (30/hour) and returns 429 with Retry-After", async () => {
    for (let i = 0; i < 30; i++) await doRegister({ ...good, username: `user${i}`.padEnd(5, "x"), password: "short" }); // validation fails before the limiter
    expect(attempts("register-email:")).toBe(0);
    for (let i = 0; i < 30; i++) db.seed("authAttempt", [{ id: `a${i}`, key: "register-email:new@example.test", createdAt: new Date() }]);
    const r = await doRegister(good);
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("3600");
    expect(await body(r)).toEqual({ error: { code: "rate_limited", message: "Too many sign-up attempts. Try again later." } });
    expect(db.rows("user")).toHaveLength(0);
  });

  it("adds the website's per-IP key only when a trusted proxy IP exists, and never otherwise", async () => {
    await doRegister(good);
    expect(db.rows("authAttempt").map((a) => a.key)).toEqual(["register-email:new@example.test"]);
    db.reset(); seedBasics(db, []);
    vi.stubEnv("TRUST_PROXY", "true");
    h.headers = { "x-forwarded-for": "198.51.100.7" };
    await doRegister(good);
    expect(db.rows("authAttempt").map((a) => a.key).sort()).toEqual(["register-email:new@example.test", "register-ip:198.51.100.7"]);
  });

  it("a verification-mail failure does not block sign-up", async () => {
    h.sentVerification.mockRejectedValueOnce(new Error("smtp down"));
    expect((await doRegister(good)).status).toBe(201);
  });
});

describe("POST /auth/login", () => {
  it("signs in, returns a token and the allowlisted user, and stores only the hash", async () => {
    addUser();
    const r = await doLogin({ email: " ANA@example.test ", password: PASSWORD });
    expect(r.status).toBe(200);
    const b = await body(r);
    expect(b.user).toEqual({ id: "u1", email: "ana@example.test", username: "ana", emailVerified: false, preferredLanguage: "python" });
    expect(db.rows("session")[0].tokenHash).toBe(hashMobileToken(b.token));
    expect(JSON.stringify(db.rows("session"))).not.toContain(b.token);
    expect(attempts("login-email:")).toBe(0); // a success does not count against the limit, as on the website
  });

  it("gives the same 401 for an unknown email, a wrong password and a suspended account", async () => {
    addUser(); addUser({ id: "u2", email: "sus@example.test", username: "sus", suspended: true });
    const results = await Promise.all([doLogin({ email: "nobody@example.test", password: PASSWORD }), doLogin({ email: "ana@example.test", password: "wrong wrong wrong" }), doLogin({ email: "sus@example.test", password: PASSWORD })]);
    for (const r of results) {
      expect(r.status).toBe(401);
      expect(await body(r)).toEqual({ error: { code: "invalid_credentials", message: "Invalid email or password." } });
    }
    expect(db.rows("session")).toHaveLength(0);
  });

  it("records failures under the website's key and locks out at 5 per 15 minutes, for web and app alike", async () => {
    addUser();
    for (let i = 0; i < 5; i++) expect((await doLogin({ email: "ana@example.test", password: "wrong wrong wrong" })).status).toBe(401);
    expect(db.rows("authAttempt").map((a) => a.key)).toEqual(Array(5).fill("login-email:ana@example.test"));
    const locked = await doLogin({ email: "ana@example.test", password: PASSWORD }); // even the right password is refused
    expect(locked.status).toBe(429);
    expect(locked.headers.get("retry-after")).toBe("900");
    expect(await body(locked)).toEqual({ error: { code: "rate_limited", message: "Too many failed attempts. Try again in 15 minutes." } });
    expect(db.rows("session")).toHaveLength(0);
  });

  it("a lockout created by website attempts also blocks the app (same keys)", async () => {
    addUser();
    for (let i = 0; i < 5; i++) db.seed("authAttempt", [{ id: `w${i}`, key: "login-email:ana@example.test", createdAt: new Date() }]);
    expect((await doLogin({ email: "ana@example.test", password: PASSWORD })).status).toBe(429);
  });

  it("uses the per-IP key (20 per 15 minutes) only with a trusted proxy", async () => {
    addUser();
    vi.stubEnv("TRUST_PROXY", "true");
    h.headers = { "x-forwarded-for": "203.0.113.9" };
    await doLogin({ email: "ana@example.test", password: "wrong wrong wrong" });
    expect(db.rows("authAttempt").map((a) => a.key).sort()).toEqual(["login-email:ana@example.test", "login-ip:203.0.113.9"]);
    for (let i = 0; i < 20; i++) db.seed("authAttempt", [{ id: `i${i}`, key: "login-ip:203.0.113.9", createdAt: new Date() }]);
    expect((await doLogin({ email: "other@example.test", password: "x".repeat(12) })).status).toBe(429);
  });

  it("sends the new-device alert only for a device the account has not used (and not on the first sign-in)", async () => {
    addUser();
    h.devices = [];
    await doLogin({ email: "ana@example.test", password: PASSWORD });
    h.devices = ["Chrome on Windows"];
    await doLogin({ email: "ana@example.test", password: PASSWORD });
    expect(h.sentSignIn).toHaveBeenCalledTimes(1);
    expect(h.sentSignIn).toHaveBeenCalledWith("ana@example.test", "Algoryva Android app");
    h.devices = ["Algoryva Android app"];
    await doLogin({ email: "ana@example.test", password: PASSWORD });
    expect(h.sentSignIn).toHaveBeenCalledTimes(1);
  });

  it("validates input (website rules) and rejects unknown fields", async () => {
    // The website's parseLogin only requires a non-empty email and password (it does not check the email's shape).
    expect((await doLogin({ email: "", password: PASSWORD })).status).toBe(400);
    expect((await doLogin({ email: "a@b.co", password: "" })).status).toBe(400);
    expect((await doLogin({ email: "not-an-email", password: PASSWORD })).status).toBe(401);
    expect((await doLogin({ email: "a@b.co", password: PASSWORD, remember: true })).status).toBe(400);
    expect((await doLogin({ email: "a@b.co" })).status).toBe(400);
  });
});

describe("POST /auth/logout and token revocation", () => {
  it("revokes exactly this token; the token is then rejected everywhere; a second logout is 401", async () => {
    addUser();
    const t1 = (await body(await doLogin({ email: "ana@example.test", password: PASSWORD }))).token as string;
    const t2 = (await body(await doLogin({ email: "ana@example.test", password: PASSWORD }))).token as string;
    expect(db.rows("session")).toHaveLength(2);
    const out = await logout(req("/api/v1/auth/logout", "POST", undefined, bearer(t1)));
    expect(out.status).toBe(200);
    expect(await body(out)).toEqual({ ok: true });
    expect(db.rows("session")).toHaveLength(1);
    expect((await me(req("/api/v1/me", "GET", undefined, bearer(t1)))).status).toBe(401);
    expect((await me(req("/api/v1/me", "GET", undefined, bearer(t2)))).status).toBe(200);
    expect((await logout(req("/api/v1/auth/logout", "POST", undefined, bearer(t1)))).status).toBe(401);
  });
  it("requires a token", async () => {
    expect((await logout(req("/api/v1/auth/logout", "POST"))).status).toBe(401);
    expect((await logout(req("/api/v1/auth/logout", "POST", undefined, { authorization: "Bearer nope" }))).status).toBe(401);
  });
  it("is rate limited per user (60 per hour)", async () => {
    addUser();
    const t = (await body(await doLogin({ email: "ana@example.test", password: PASSWORD }))).token as string;
    for (let i = 0; i < 60; i++) db.seed("authAttempt", [{ id: `l${i}`, key: "v1-logout:u1", createdAt: new Date() }]);
    expect((await logout(req("/api/v1/auth/logout", "POST", undefined, bearer(t)))).status).toBe(429);
    expect(db.rows("session")).toHaveLength(1);
  });
});
