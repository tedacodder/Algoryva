import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrations";
import { openTestDb } from "../test-support/node-sqlite";
import { seedContent, T0 } from "../test-support/seed";
import { fakeApi, emptyState, type FakeApi } from "../test-support/fake-api";
import { enqueueLocal } from "../learner/apply";
import { createSyncEngine } from "../sync/engine";
import { createAccountService } from "./account";
import type { SqlDb } from "../db/sql";
import type { SyncState } from "../api/types";

let db: SqlDb & { close(): void };
let api: FakeApi;
let token: string | null;
let linkPending: boolean;
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
  await seedContent(db);
  api = fakeApi({ snapshot: { cursor: "C_ACCOUNT" } });
  token = null;
  linkPending = false;
});

function build() {
  const engine = createSyncEngine({
    db,
    api,
    isSignedIn: () => token !== null,
    linkPending: () => linkPending,
    now: () => T0,
    random: () => 0.5,
  });
  const account = createAccountService({
    db,
    api,
    session: {
      async startSession(t) { token = t; },
      async endSession() { token = null; },
    },
    engine,
    setLinkPending: (v) => { linkPending = v; },
    now: () => T0,
  });
  return { engine, account };
}
const pending = async () => (await db.getAllAsync("SELECT id FROM outbox")).length;
const serverState = (over: Partial<SyncState> = {}): SyncState => ({ ...emptyState(), ...over });
const completedOnServer = serverState({ topicProgress: [{ slug: "python-basics", completedAt: "2026-10-01T00:00:00.000Z" }] });

describe("sign-in", () => {
  it("an empty account takes the device's data without asking, and the device's unsent changes are sent", async () => {
    await enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0);
    const { account } = build();
    const out = await account.signIn({ email: "a@example.test", password: "x".repeat(12) });
    assert.deepEqual(out, { kind: "linked", userId: "user-1" });
    await new Promise((r) => setTimeout(r, 20)); // the background sync runs after linking
    assert.equal(await pending(), 0, "the device's change was sent to the account");
    assert.equal(api.calls.push.length, 1);
  });

  it("an account with data and no unsent changes on the device links without a question", async () => {
    api = fakeApi({ snapshot: { cursor: "C_ACCOUNT", state: completedOnServer } });
    const { account } = build();
    assert.deepEqual(await account.signIn({ email: "a@example.test", password: "x".repeat(12) }), { kind: "linked", userId: "user-1" });
    assert.equal((await db.getFirstAsync<{ completed_at: string }>("SELECT completed_at FROM progress WHERE topic_slug = 'python-basics'"))?.completed_at, "2026-10-01T00:00:00.000Z");
  });

  it("device changes AND account data: the user is asked, nothing is merged yet, and nothing is pushed", async () => {
    api = fakeApi({ snapshot: { cursor: "C_ACCOUNT", state: completedOnServer } });
    await enqueueLocal(db, { type: "note.create", payload: { id: id(), title: "Offline", body: "written offline", tags: [] } }, id(), T0);
    const { account } = build();
    const out = await account.signIn({ email: "a@example.test", password: "x".repeat(12) });
    assert.deepEqual(out, { kind: "choose", pending: 1, userId: "user-1" });
    assert.equal(linkPending, true);
    assert.equal(account.hasPendingChoice(), true);
    assert.equal(api.calls.push.length, 0, "no push before the user chooses");
    assert.equal(await pending(), 1);
  });

  it("choosing to combine keeps the device's changes, applies the account's data, and sends the changes", async () => {
    api = fakeApi({ snapshot: { cursor: "C_ACCOUNT", state: completedOnServer } });
    await enqueueLocal(db, { type: "note.create", payload: { id: "n-mine", title: "Offline", body: "written offline", tags: [] } }, id(), T0);
    const { account } = build();
    await account.signIn({ email: "a@example.test", password: "x".repeat(12) });
    await account.chooseLink("combine");
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(linkPending, false);
    assert.equal(await pending(), 0);
    assert.equal((await db.getAllAsync("SELECT topic_slug FROM progress WHERE topic_slug = 'python-basics'")).length, 1, "the account's data is here");
    assert.deepEqual((await db.getAllAsync<{ id: string }>("SELECT id FROM notes")).map((r) => r.id), ["n-mine"], "the device's note is here too");
  });

  it("choosing to use the account discards the device's unsent changes (only with the user's consent)", async () => {
    api = fakeApi({ snapshot: { cursor: "C_ACCOUNT", state: completedOnServer } });
    await enqueueLocal(db, { type: "note.create", payload: { id: "n-gone", title: "Offline", body: "written offline", tags: [] } }, id(), T0);
    const { account } = build();
    await account.signIn({ email: "a@example.test", password: "x".repeat(12) });
    await account.chooseLink("account");
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(await pending(), 0);
    assert.equal((await db.getAllAsync("SELECT id FROM notes")).length, 0, "the discarded note is gone from the device");
    assert.equal(api.calls.push.filter((b) => b.some((e) => e.type === "note.create")).length, 0, "and was never sent");
  });

  it("a wrong password or server error leaves the device signed out and the data untouched", async () => {
    await enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0);
    api.login = async () => { throw new Error("invalid"); };
    const { account } = build();
    await assert.rejects(account.signIn({ email: "a@example.test", password: "bad" }));
    assert.equal(token, null);
    assert.equal(await pending(), 1);
  });
});

describe("sign-out", () => {
  it("with unsent changes, asks first and changes nothing", async () => {
    token = "alv_x";
    await enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0);
    const { account } = build();
    assert.deepEqual(await account.signOut({ discardPending: false }), { kind: "needs-confirmation", pending: 1 });
    assert.equal(token, "alv_x");
    assert.equal(await pending(), 1);
  });

  it("keeping the unsent changes: the account's data leaves the device, the changes stay as this device's own", async () => {
    token = "alv_x";
    api = fakeApi({ snapshot: { cursor: "C_ACCOUNT", state: completedOnServer } });
    const { engine, account } = build();
    await engine.run();
    await enqueueLocal(db, { type: "note.create", payload: { id: "n-device", title: "Mine", body: "device note", tags: [] }, }, id(), T0);
    assert.equal((await db.getAllAsync("SELECT topic_slug FROM progress")).length, 1);
    const out = await account.signOut({ discardPending: true });
    assert.deepEqual(out, { kind: "signed-out" });
    assert.equal(token, null);
    assert.equal(api.calls.logout, 1);
    assert.equal((await db.getAllAsync("SELECT topic_slug FROM progress")).length, 0, "account progress is removed from the device");
    assert.equal(await pending(), 0);
  });

  it("with nothing unsent, signs out at once", async () => {
    token = "alv_x";
    const { account } = build();
    assert.deepEqual(await account.signOut({ discardPending: false }), { kind: "signed-out" });
    assert.equal(token, null);
  });

  it("a logout request that fails still signs the device out", async () => {
    token = "alv_x";
    api.logout = async () => { throw new Error("offline"); };
    const { account } = build();
    await account.signOut({ discardPending: false });
    assert.equal(token, null);
  });
});

describe("forced sign-out (the server rejected the session)", () => {
  it("removes account data from the device but keeps unsent changes", async () => {
    api = fakeApi({ snapshot: { cursor: "C_ACCOUNT", state: completedOnServer } });
    const { engine, account } = build();
    token = "alv_x";
    await engine.run();
    await enqueueLocal(db, { type: "note.create", payload: { id: "n-keep", title: "Keep", body: "unsent", tags: [] } }, id(), T0);
    await account.handleSessionLost();
    assert.equal((await db.getAllAsync("SELECT topic_slug FROM progress")).length, 0);
    assert.deepEqual((await db.getAllAsync<{ id: string }>("SELECT id FROM notes")).map((r) => r.id), ["n-keep"]);
    assert.equal(await pending(), 1);
  });
});

describe("account deletion", () => {
  it("deletes on the server, then removes every trace of the account and its unsent changes from the device", async () => {
    api = fakeApi({ snapshot: { cursor: "C_ACCOUNT", state: completedOnServer } });
    const { engine, account } = build();
    token = "alv_x";
    await engine.run();
    await enqueueLocal(db, { type: "note.create", payload: { id: "n-del", title: "Del", body: "unsent", tags: [] } }, id(), T0);
    await account.deleteAccount("correct horse battery");
    assert.deepEqual(api.calls.delete, ["correct horse battery"]);
    assert.equal(token, null);
    for (const t of ["progress", "solves", "revisits", "mistakes", "notes", "outbox", "sync_state"]) {
      assert.equal((await db.getAllAsync(`SELECT 1 FROM ${t}`)).length, 0, `${t} must be empty`);
    }
  });

  it("if the server refuses (wrong password), nothing is removed on the device", async () => {
    api.deleteAccount = async () => { throw new Error("invalid_password"); };
    token = "alv_x";
    await enqueueLocal(db, { type: "topic.complete", payload: { slug: "python-basics" } }, id(), T0);
    const { account } = build();
    await assert.rejects(account.deleteAccount("nope"));
    assert.equal(token, "alv_x");
    assert.equal(await pending(), 1);
  });
});
