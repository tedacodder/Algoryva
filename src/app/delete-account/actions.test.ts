import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ requireUser: vi.fn(), destroySession: vi.fn(async () => {}) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`NEXT_REDIRECT:${to}`); } }));
vi.mock("@/lib/auth/session", () => ({ requireUser: m.requireUser, destroySession: m.destroySession }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { seedBasics } from "@/lib/test-support/seed";
import { hashPassword } from "@/lib/auth/password";
import { deleteMyAccount } from "@/app/delete-account/actions";

const PASSWORD = "correct horse battery";
let passwordHash = "";
beforeAll(async () => { passwordHash = await hashPassword(PASSWORD); });
beforeEach(() => {
  db.reset(); seedBasics(db, []); m.destroySession.mockClear();
  db.seed("user", [{ id: "u1", email: "u1@example.test", username: "u1", passwordHash, role: "USER", suspended: false, pendingEmail: null }]);
  db.seed("note", [{ id: "n1", userId: "u1", title: "t", body: "b", tags: [] }]);
  m.requireUser.mockResolvedValue({ id: "u1" });
});
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

describe("deleteMyAccount (website)", () => {
  it("needs the confirmation box and a password, and does not touch the account without them", async () => {
    expect(await deleteMyAccount(undefined, form({ password: PASSWORD }))).toEqual({ error: "Tick the box to confirm that you understand this is permanent." });
    expect(await deleteMyAccount(undefined, form({ confirm: "yes" }))).toEqual({ error: "Enter your password." });
    expect(db.rows("user")).toHaveLength(1);
  });
  it("a wrong password is refused and counted under the same key as the API", async () => {
    expect(await deleteMyAccount(undefined, form({ confirm: "yes", password: "nope nope nope" }))).toEqual({ error: "Your password is incorrect." });
    expect(db.rows("authAttempt").map((a) => a.key)).toEqual(["delete-account:u1"]);
    expect(db.rows("user")).toHaveLength(1);
  });
  it("is limited to 5 attempts per hour", async () => {
    for (let i = 0; i < 5; i++) db.seed("authAttempt", [{ id: `d${i}`, key: "delete-account:u1", createdAt: new Date() }]);
    expect(await deleteMyAccount(undefined, form({ confirm: "yes", password: PASSWORD }))).toEqual({ error: "Too many attempts. Try again later." });
    expect(db.rows("user")).toHaveLength(1);
  });
  it("deletes the account and its data, clears the cookie, and redirects to the confirmation", async () => {
    await expect(deleteMyAccount(undefined, form({ confirm: "yes", password: PASSWORD }))).rejects.toThrow("NEXT_REDIRECT:/delete-account?done=1");
    expect(db.rows("user")).toHaveLength(0);
    expect(db.rows("note")).toHaveLength(0);
    expect(m.destroySession).toHaveBeenCalledTimes(1);
  });
  it("never deletes the last administrator", async () => {
    db.rows("user")[0].role = "ADMIN";
    const r = await deleteMyAccount(undefined, form({ confirm: "yes", password: PASSWORD }));
    expect(r?.error).toMatch(/last administrator/);
    expect(db.rows("user")).toHaveLength(1);
    expect(m.destroySession).not.toHaveBeenCalled();
  });
});
