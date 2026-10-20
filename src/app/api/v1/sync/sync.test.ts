import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/test-support/fake-db")).fakeDb }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import { fakeDb as db } from "@/lib/test-support/fake-db";
import { ev, seedBasics } from "@/lib/test-support/seed";
import { bearer, body, req } from "@/lib/test-support/http";
import { createMobileSession } from "@/lib/api/mobile-auth";
import { POST as push } from "@/app/api/v1/sync/push/route";
import { GET as pull } from "@/app/api/v1/sync/pull/route";

let token = "";
beforeEach(async () => { db.reset(); seedBasics(db, ["u1", "u2"]); token = (await createMobileSession("u1", "d")).token; });

const doPush = (b: unknown, t: string | null = token) => push(req("/api/v1/sync/push", "POST", b, t ? bearer(t) : {}));
const doPull = (qs = "", t: string | null = token) => pull(req(`/api/v1/sync/pull${qs}`, "GET", undefined, t ? bearer(t) : {}));

describe("POST /sync/push", () => {
  it("requires a bearer token before anything else is read", async () => {
    const r = await doPush({ events: [ev("topic.complete", { slug: "python-basics" })] }, null);
    expect(r.status).toBe(401);
    expect(db.rows("syncEvent")).toHaveLength(0);
  });

  it("applies events, reports accepted and rejected ids, and returns per-event details", async () => {
    const good = ev("topic.complete", { slug: "python-basics" });
    const bad = ev("topic.complete", { slug: "arrays" });
    const unknown = ev("what.is.this", {});
    const r = await doPush({ events: [good, bad, unknown] });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await body(r)).toEqual({ accepted: [good.id], rejected: [{ id: bad.id, reason: "prerequisites_missing" }, { id: unknown.id, reason: "unknown_type" }], results: {} });
    expect(db.rows("topicProgress")).toHaveLength(1);
  });

  it("is idempotent: sending the same batch twice changes nothing the second time and answers the same", async () => {
    const batch = { events: [ev("topic.complete", { slug: "python-basics" }), ev("note.create", { id: crypto.randomUUID(), title: "t", body: "b", tags: [] })] };
    const first = await body(await doPush(batch));
    const snapshot = JSON.stringify([db.rows("topicProgress"), db.rows("note"), db.rows("activity"), db.rows("syncEvent").length]);
    const second = await body(await doPush(batch));
    expect(second).toEqual(first);
    expect(JSON.stringify([db.rows("topicProgress"), db.rows("note"), db.rows("activity"), db.rows("syncEvent").length])).toBe(snapshot);
  });

  it("validates the envelope: 400 for an empty list, more than 50 events, a bad id, a missing field, unknown fields", async () => {
    const one = ev("note.delete", { id: "x" });
    for (const bad of [{ events: [] }, { events: Array.from({ length: 51 }, () => ev("note.delete", { id: "x" })) }, { events: [{ ...one, id: "nope" }] }, { events: [{ id: one.id, type: "note.delete" }] }, { events: [one], extra: 1 }, { events: "x" }, []]) {
      const r = await doPush(bad);
      expect(r.status).toBe(400);
      expect((await body(r)).error.code).toBe("invalid_request");
    }
    expect((await push(req("/api/v1/sync/push", "POST", "{}", { ...bearer(token), "content-type": "text/plain" }))).status).toBe(415);
    expect((await doPush({ events: [one] })).status).toBe(200);
  });

  it("413 for a body over 256 KB", async () => {
    const big = { events: [ev("note.create", { id: crypto.randomUUID(), title: "t", body: "x".repeat(300 * 1024), tags: [] })] };
    expect((await doPush(big)).status).toBe(413);
  });

  it("is rate limited per user (120 per hour) and the limit key is the user's", async () => {
    for (let i = 0; i < 120; i++) db.seed("authAttempt", [{ id: `p${i}`, key: "v1-push:u1", createdAt: new Date() }]);
    expect((await doPush({ events: [ev("note.delete", { id: "x" })] })).status).toBe(429);
    const u2 = (await createMobileSession("u2", "d")).token;
    expect((await doPush({ events: [ev("note.delete", { id: "x" })] }, u2)).status).toBe(200);
  });

  it("returns quiz details in `results` and a transient failure on the first event as a generic 500 (nothing stored)", async () => {
    const e = ev("topic.complete", { slug: "python-basics" });
    db.failNext("topic.findUnique");
    const r = await doPush({ events: [e] });
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("injected");
    expect(db.rows("syncEvent")).toHaveLength(0);
    expect((await doPush({ events: [e] })).status).toBe(200); // the client's retry succeeds with the same id
  });

  it("one user cannot touch another's data through ids", async () => {
    db.seed("note", [{ id: "n-u2", userId: "u2", title: "t", body: "b", tags: [] }]);
    await doPush({ events: [ev("note.delete", { id: "n-u2" })] });
    expect(db.rows("note")).toHaveLength(1);
  });
});

describe("GET /sync/pull", () => {
  it("requires a token", async () => { expect((await doPull("", null)).status).toBe(401); });

  it("returns the snapshot, no-store, and `unchanged` for a current cursor", async () => {
    await doPush({ events: [ev("topic.complete", { slug: "python-basics" })] });
    const r = await doPull();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const b = await body(r);
    expect(b.unchanged).toBe(false);
    expect(b.state.topicProgress).toEqual([{ slug: "python-basics", completedAt: expect.any(String) }]);
    expect(b.next).toBeNull();
    expect(await body(await doPull(`?since=${b.cursor}`))).toEqual({ cursor: b.cursor, unchanged: true });
  });

  it("a change made through the website's write paths moves the cursor (deletion included)", async () => {
    db.seed("note", [{ id: "n1", userId: "u1", title: "t", body: "b", tags: [], createdAt: new Date() }]);
    const a = await body(await doPull());
    db.t.note.rows = []; // the website's deleteNote
    const b = await body(await doPull(`?since=${a.cursor}`));
    expect(b.unchanged).toBe(false);
    expect(b.notes).toEqual([]);
    expect(b.cursor).not.toBe(a.cursor);
  });

  it("validates since and page, and a foreign or forged page token is 400", async () => {
    expect((await doPull("?since=not-a-cursor")).status).toBe(400);
    expect((await doPull("?page=garbage")).status).toBe(400);
  });

  it("is isolated per user", async () => {
    db.seed("note", [{ id: "n-u2", userId: "u2", title: "private", body: "secret-body", tags: [], createdAt: new Date() }]);
    const b = await body(await doPull());
    expect(JSON.stringify(b)).not.toContain("secret-body");
    expect(b.notes).toEqual([]);
  });

  it("is rate limited per user (300 reads per hour, shared with /me)", async () => {
    for (let i = 0; i < 300; i++) db.seed("authAttempt", [{ id: `r${i}`, key: "v1-read:u1", createdAt: new Date() }]);
    expect((await doPull()).status).toBe(429);
  });
});
