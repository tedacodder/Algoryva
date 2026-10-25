import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const h = vi.hoisted(() => ({ headers: {} as Record<string, string> }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(h.headers) }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { seedBasics } from "@/lib/test-support/seed";
import { bearer, body, req } from "@/lib/test-support/http";
import { hashPassword } from "@/lib/auth/password";
import { createMobileSession } from "@/lib/api/mobile-auth";
import { authAttemptKeysFor, deleteAccount } from "@/lib/account/delete";
import { DELETE, GET } from "@/app/api/v1/me/route";

const PASSWORD = "correct horse battery";
let passwordHash = "";
beforeAll(async () => { passwordHash = await hashPassword(PASSWORD); });
beforeEach(() => { db.reset(); seedBasics(db, []); h.headers = {}; });

const addUser = (id: string, over: Record<string, unknown> = {}) => db.seed("user", [{ id, email: `${id}@example.test`, username: id, passwordHash, role: "USER", suspended: false, preferredLanguage: "python", emailVerifiedAt: null, pendingEmail: null, ...over }]);
const token = async (id: string) => (await createMobileSession(id, "d")).token;
const del = (t: string | null, b: unknown = { password: PASSWORD }) => DELETE(req("/api/v1/me", "DELETE", b, t ? bearer(t) : {}));

/** Rows that belong to user `id` in every user-owned table, to prove a deletion leaves nothing behind. */
function populate(id: string) {
  const U = { userId: id };
  db.seed("topicProgress", [{ ...U, topicId: "t_python-basics", completedAt: new Date() }]);
  db.seed("reviewItem", [{ id: `ri-${id}`, ...U, topicId: "t_python-basics", step: 0, dueAt: new Date() }]);
  db.seed("quizResult", [{ ...U, topicId: "t_python-basics", bestScore: 1, total: 1, attempts: 1 }]);
  db.seed("problemSolve", [{ ...U, problemId: "p1" }]);
  db.seed("activity", [{ id: `ac-${id}`, ...U, type: "review" }]);
  db.seed("mistake", [{ id: `m-${id}`, ...U }]);
  db.seed("note", [{ id: `n-${id}`, ...U, title: "t", body: "b", tags: [] }]);
  db.seed("revisit", [{ id: `rv-${id}`, ...U, problemId: "p1", outsideKey: null, dueAt: null, step: 0 }]);
  db.seed("syncEvent", [{ ...U, id: `e-${id}`, type: "note.delete", payloadHash: "h", outcome: { status: "accepted" } }]);
}
const owned = (id: string) => ["session", "topicProgress", "reviewItem", "quizResult", "problemSolve", "activity", "mistake", "note", "revisit", "syncEvent"].flatMap((t) => db.rows(t).filter((r) => r.userId === id));

describe("GET /me", () => {
  it("returns only the allowlisted user fields, no-store", async () => {
    addUser("u1");
    const r = await GET(req("/api/v1/me", "GET", undefined, bearer(await token("u1"))));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await body(r)).toEqual({ user: { id: "u1", email: "u1@example.test", username: "u1", emailVerified: false, preferredLanguage: "python" } });
  });
  it("401 without, with a bad, an expired or a suspended user's token", async () => {
    addUser("u1");
    const t = await token("u1");
    expect((await GET(req("/api/v1/me", "GET"))).status).toBe(401);
    expect((await GET(req("/api/v1/me", "GET", undefined, bearer("alv_" + "z".repeat(43))))).status).toBe(401);
    db.rows("session")[0].expiresAt = new Date(Date.now() - 1);
    expect((await GET(req("/api/v1/me", "GET", undefined, bearer(t)))).status).toBe(401);
    db.rows("session")[0].expiresAt = new Date(Date.now() + 1e6);
    db.rows("user")[0].suspended = true;
    expect((await GET(req("/api/v1/me", "GET", undefined, bearer(t)))).status).toBe(401);
  });
  it("is rate limited per user (300 per hour)", async () => {
    addUser("u1");
    const t = await token("u1");
    for (let i = 0; i < 300; i++) db.seed("authAttempt", [{ id: `r${i}`, key: "v1-read:u1", createdAt: new Date() }]);
    expect((await GET(req("/api/v1/me", "GET", undefined, bearer(t)))).status).toBe(429);
  });
});

describe("DELETE /me", () => {
  it("requires a token and a password in a strict body", async () => {
    addUser("u1");
    const t = await token("u1");
    expect((await del(null)).status).toBe(401);
    expect((await del(t, {})).status).toBe(400);
    expect((await del(t, { password: PASSWORD, confirm: true })).status).toBe(400);
    expect((await DELETE(req("/api/v1/me", "DELETE", "x", { ...bearer(t), "content-type": "text/plain" }))).status).toBe(415);
    expect(db.rows("user")).toHaveLength(1);
  });

  it("a wrong password is 403, is counted, and deletes nothing; the 6th attempt in an hour is 429", async () => {
    addUser("u1"); populate("u1");
    const t = await token("u1");
    for (let i = 0; i < 5; i++) {
      const r = await del(t, { password: "not the password" });
      expect(r.status).toBe(403);
      expect(await body(r)).toEqual({ error: { code: "invalid_password", message: "Your password is incorrect." } });
    }
    expect(db.rows("authAttempt").filter((a) => a.key === "delete-account:u1")).toHaveLength(5);
    const limited = await del(t);
    expect(limited.status).toBe(429); // even the right password is refused while limited
    expect(db.rows("user")).toHaveLength(1);
    expect(owned("u1").length).toBeGreaterThan(5);
  });

  it("deletes the account and all its data, and the same token is rejected afterwards", async () => {
    addUser("u1"); addUser("u2"); populate("u1"); populate("u2");
    const t = await token("u1"); const t2 = await token("u2");
    const r = await del(t);
    expect(r.status).toBe(200);
    expect(await body(r)).toEqual({ deleted: true });
    expect(db.rows("user").map((u) => u.id)).toEqual(["u2"]);
    expect(owned("u1")).toEqual([]);
    expect(owned("u2").length).toBeGreaterThan(5); // another user's data is untouched
    expect((await GET(req("/api/v1/me", "GET", undefined, bearer(t)))).status).toBe(401); // the deleted account's token is dead
    expect((await GET(req("/api/v1/me", "GET", undefined, bearer(t2)))).status).toBe(200);
  });

  it("removes the account-linked AuthAttempt rows (email- and id-keyed) in the same transaction, and keeps unrelated ones", async () => {
    addUser("u1", { pendingEmail: "new-address@example.test" });
    const keep = ["login-email:someone-else@example.test", "login-ip:203.0.113.9", "check:u2:p1"];
    const drop = ["login-email:u1@example.test", "register-email:u1@example.test", "forgot-email:u1@example.test", "login-email:new-address@example.test", "verify:u1", "email-change:u1", "check:u1:p1", "check:u1:p2", "v1-push:u1", "v1-read:u1"];
    db.seed("authAttempt", [...keep, ...drop].map((key, i) => ({ id: `a${i}`, key, createdAt: new Date() })));
    const t = await token("u1");
    const before = db.transactions;
    expect((await del(t)).status).toBe(200);
    expect(db.transactions).toBe(before + 1); // one transaction
    expect(db.rows("authAttempt").map((a) => a.key).sort()).toEqual([...keep].sort());
  });

  it("rolls back everything if the user delete fails", async () => {
    addUser("u1"); populate("u1");
    db.seed("authAttempt", [{ id: "a1", key: "verify:u1", createdAt: new Date() }]);
    const t = await token("u1");
    db.failNext("user.delete");
    expect((await del(t)).status).toBe(500);
    expect(db.rows("user")).toHaveLength(1);
    expect(db.rows("authAttempt").some((a) => a.key === "verify:u1")).toBe(true);
    expect(owned("u1").length).toBeGreaterThan(5);
  });
});

describe("last-administrator guard", () => {
  it("refuses to delete the only ADMIN, and allows it once another admin exists", async () => {
    addUser("a1", { role: "ADMIN" });
    const t = await token("a1");
    const r = await del(t);
    expect(r.status).toBe(409);
    expect((await body(r)).error.code).toBe("last_admin");
    expect(db.rows("user")).toHaveLength(1);
    addUser("a2", { role: "ADMIN" });
    expect((await del(t)).status).toBe(200);
    expect(db.rows("user").map((u) => u.id)).toEqual(["a2"]);
  });
  it("two admins deleting at the same moment cannot remove both (transactions are serialised and the guard re-counts)", async () => {
    addUser("a1", { role: "ADMIN" }); addUser("a2", { role: "ADMIN" });
    const [r1, r2] = await Promise.all([deleteAccount("a1", PASSWORD), deleteAccount("a2", PASSWORD)]);
    expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
    expect([r1, r2].find((r) => !r.ok)).toMatchObject({ reason: "last_admin" });
    expect(db.rows("user").filter((u) => u.role === "ADMIN")).toHaveLength(1);
  });
  it("a non-admin can always delete; and a demoted user is not blocked", async () => {
    addUser("a1", { role: "ADMIN" }); addUser("u1");
    expect(await deleteAccount("u1", PASSWORD)).toEqual({ ok: true });
  });
});

describe("deleteAccount service", () => {
  it("reports not_found for an unknown id and invalid_password without writing anything", async () => {
    expect(await deleteAccount("ghost", PASSWORD)).toEqual({ ok: false, reason: "not_found" });
    addUser("u1");
    expect(await deleteAccount("u1", "nope")).toEqual({ ok: false, reason: "invalid_password" });
    expect(db.transactions).toBe(0);
  });
  it("treats a concurrent deletion (P2025) as not_found", async () => {
    addUser("u1");
    db.user.delete = (async () => { throw Object.assign(new Error("gone"), { code: "P2025" }); }) as typeof db.user.delete;
    expect(await deleteAccount("u1", PASSWORD)).toEqual({ ok: false, reason: "not_found" });
  });
  it("lists the AuthAttempt keys the website and the API create for an account", () => {
    const k = authAttemptKeysFor({ id: "U", email: "e@x.test", pendingEmail: null });
    expect(k.exact).toEqual(expect.arrayContaining(["login-email:e@x.test", "register-email:e@x.test", "forgot-email:e@x.test", "verify:U", "email-change:U", "delete-account:U"]));
    expect(k.checkPrefix).toBe("check:U:");
  });
});

describe("revocation depends on existing website behaviour (guarded here so a change cannot silently break it)", () => {
  const src = (p: string) => readFileSync(new URL(`../../../../${p}`, import.meta.url), "utf8");
  it("password reset deletes every session of the user", () => {
    expect(src("app/auth-actions.ts")).toMatch(/db\.session\.deleteMany\(\{ where: \{ userId \} \}\)/);
  });
  it("suspending an account deletes every session of the user", () => {
    expect(src("app/admin/users/actions.ts")).toMatch(/suspended \? \[db\.session\.deleteMany\(\{ where: \{ userId: id \} \}\)\]/);
  });
  it("every user-owned table is ON DELETE CASCADE from User in the migrations (SQL text check, not a database run)", () => {
    const fs = require("node:fs") as typeof import("node:fs"); // eslint-disable-line @typescript-eslint/no-require-imports
    const dir = new URL("../../../../../prisma/migrations/", import.meta.url);
    const sql = fs.readdirSync(dir).filter((d) => !d.endsWith(".toml")).map((d) => fs.readFileSync(new URL(`${d}/migration.sql`, dir), "utf8")).join("\n");
    for (const t of ["Session", "TopicProgress", "ReviewItem", "QuizResult", "ProblemSolve", "Activity", "Mistake", "Note", "Revisit", "SyncEvent", "Submission", "ContestEntry", "VerificationToken"]) {
      expect(sql, `${t}.userId`).toMatch(new RegExp(`ALTER TABLE "${t}" ADD CONSTRAINT "${t}_userId_fkey" FOREIGN KEY \\("userId"\\) REFERENCES "User"\\("id"\\) ON DELETE CASCADE`));
    }
  });
});
