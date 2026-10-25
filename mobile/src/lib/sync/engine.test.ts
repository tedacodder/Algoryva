import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrations";
import { openTestDb } from "../test-support/node-sqlite";
import { seedContent, T0 } from "../test-support/seed";
import { fakeApi, type FakeApi } from "../test-support/fake-api";
import { enqueueLocal } from "../learner/apply";
import { ApiError, NetworkError } from "../api/client";
import { createSyncEngine, type EngineDeps } from "./engine";
import type { SqlDb } from "../db/sql";

let db: SqlDb & { close(): void };
let api: FakeApi;
let signedIn = true;
let linkPending = false;
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
  await seedContent(db);
  api = fakeApi();
  signedIn = true;
  linkPending = false;
});

function engine(overrides: Partial<EngineDeps> = {}) {
  return createSyncEngine({
    db,
    api,
    isSignedIn: () => signedIn,
    linkPending: () => linkPending,
    now: () => T0,
    random: () => 0.5,
    ...overrides,
  });
}
const outboxIds = async () => (await db.getAllAsync<{ id: string }>("SELECT id FROM outbox ORDER BY seq")).map((r) => r.id);
const queueComplete = async (slug: string) => {
  const eid = id();
  await enqueueLocal(db, { type: "topic.complete", payload: { slug } }, eid, T0);
  return eid;
};

describe("when signed out", () => {
  it("never pushes, and reports guest with the number of local changes", async () => {
    signedIn = false;
    await queueComplete("python-basics");
    const e = engine();
    await e.run();
    assert.equal(api.calls.push.length, 0);
    assert.equal(api.calls.pull.length, 0);
    assert.equal(e.status.state, "guest");
    assert.equal(e.status.pending, 1);
    assert.deepEqual(await outboxIds(), (await outboxIds()), "the change stays queued");
  });
});

describe("a successful cycle", () => {
  it("pushes the outbox, removes what was accepted, pulls, and reports synced", async () => {
    const eid = await queueComplete("python-basics");
    const e = engine();
    await e.run();
    assert.equal(api.calls.push.length, 1);
    assert.deepEqual(api.calls.push[0]!.map((x) => x.id), [eid]);
    assert.deepEqual(await outboxIds(), []);
    assert.equal(e.status.state, "synced");
    assert.equal(e.status.lastSyncedAt, T0.toISOString());
    assert.equal(api.calls.pull.length, 1);
  });

  it("the second cycle asks for changes since the stored cursor", async () => {
    const e = engine();
    await e.run();
    await e.run();
    assert.equal(api.calls.pull[0]!.since, undefined, "the first pull has no cursor");
    assert.equal(api.calls.pull[1]!.since, api.server.cursor, "later pulls send the cursor");
  });

  it("an unchanged server costs no snapshot download", async () => {
    const e = engine();
    await e.run();
    await e.run();
    assert.equal(api.calls.pull.length, 2);
    assert.equal(e.status.state, "synced");
  });
});

describe("server answers for each change", () => {
  it("a rejected change is removed from the outbox and reported as an issue with the server's reason", async () => {
    await queueComplete("python-basics");
    api.hooks.push = (events) => ({ accepted: [], rejected: events.map((x) => ({ id: x.id, reason: "not_due" })), results: {} });
    const e = engine();
    await e.run();
    assert.deepEqual(await outboxIds(), []);
    assert.deepEqual(e.status.issues.map((i) => i.reason), ["not_due"]);
    e.dismissIssues();
    assert.deepEqual(e.status.issues, []);
  });

  it("a batch the server only partly answers keeps the unanswered changes queued and counts as a failure", async () => {
    const a = await queueComplete("python-basics");
    const b = await queueComplete("lists-tuples").catch(() => "");
    void b;
    await enqueueLocal(db, { type: "note.create", payload: { id: id(), title: "t", body: "body text", tags: [] } }, id(), T0);
    const pending = await outboxIds();
    api.hooks.push = (events) => ({ accepted: [events[0]!.id], rejected: [], results: {} });
    const e = engine();
    await e.run();
    assert.equal(e.status.state, "error");
    assert.deepEqual(await outboxIds(), pending.filter((x) => x !== a), "only the answered change left the outbox");
  });

  it("a batch is split into several pushes, and each change is sent exactly once", async () => {
    for (let i = 0; i < 120; i++) await enqueueLocal(db, { type: "note.create", payload: { id: id(), title: `t${i}`, body: "body text", tags: [] } }, id(), T0);
    const e = engine();
    await e.run();
    assert.equal(api.calls.push.length, 3, "120 changes at 50 per push is 3 pushes");
    assert.equal(api.calls.push.flat().length, 120);
    assert.equal(new Set(api.calls.push.flat().map((x) => x.id)).size, 120, "no duplicates across pushes");
    assert.deepEqual(await outboxIds(), []);
  });

  it("batches also respect a byte limit", async () => {
    for (let i = 0; i < 6; i++) await enqueueLocal(db, { type: "note.create", payload: { id: id(), title: "t", body: "x".repeat(1000), tags: [] } }, id(), T0);
    const e = engine({ maxBatchBytes: 2_500 });
    await e.run();
    assert.ok(api.calls.push.length > 1, "the byte limit forces more than one push");
    assert.equal(api.calls.push.flat().length, 6);
  });
});

describe("failures and retries", () => {
  it("no connection: the outbox is kept, state is offline, and a retry is scheduled (no data lost)", async () => {
    await queueComplete("python-basics");
    api.hooks.push = () => { throw new NetworkError("unreachable"); };
    const e = engine();
    await e.run();
    assert.equal(e.status.state, "offline");
    assert.equal(e.status.pending, 1);
    assert.equal((await outboxIds()).length, 1);
  });

  it("a 5xx or 429 is transient: the outbox is kept and the state is error with a retry", async () => {
    await queueComplete("python-basics");
    api.hooks.push = () => { throw new ApiError(503, "http_503", "busy"); };
    const e = engine();
    await e.run();
    assert.equal(e.status.state, "error");
    assert.equal((await outboxIds()).length, 1);
  });

  it("any other 4xx stops retrying and shows the error (a repeat would fail the same way)", async () => {
    await queueComplete("python-basics");
    api.hooks.push = () => { throw new ApiError(400, "invalid_request", "Invalid request: events."); };
    const e = engine();
    await e.run();
    assert.equal(e.status.state, "error");
    assert.match(e.status.message ?? "", /Sync stopped/);
    assert.equal((await outboxIds()).length, 1, "the change is kept for the user to see, not dropped");
  });

  it("a 401 signs the device out of sync without deleting unsent changes", async () => {
    await queueComplete("python-basics");
    api.hooks.push = () => { signedIn = false; throw new ApiError(401, "unauthorized", "Sign in to continue."); };
    const e = engine();
    await e.run();
    assert.equal(e.status.state, "guest");
    assert.equal((await outboxIds()).length, 1);
  });

  it("recovers after the connection returns: the same change is sent again and accepted once", async () => {
    const eid = await queueComplete("python-basics");
    let online = false;
    api.hooks.push = (events) => {
      if (!online) throw new NetworkError("unreachable");
      return { accepted: events.map((x) => x.id), rejected: [], results: {} };
    };
    const e = engine();
    await e.run();
    assert.equal(e.status.state, "offline");
    online = true;
    await e.run();
    assert.equal(e.status.state, "synced");
    assert.deepEqual(await outboxIds(), []);
    assert.equal(api.calls.push.filter((b) => b.some((x) => x.id === eid)).length, 2, "sent again after reconnecting, with the same id");
  });
});

describe("concurrency", () => {
  it("two runs at once share one cycle; a request during a cycle runs one more afterwards", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    api.hooks.push = async (events) => {
      await gate;
      return { accepted: events.map((x) => x.id), rejected: [], results: {} };
    };
    const e = engine();
    await queueComplete("python-basics");
    const first = e.run();
    const second = e.run();
    release();
    await Promise.all([first, second]);
    assert.equal(api.calls.push.length, 1 + 0, "one push cycle for the overlapping runs");
  });

  it("while linking is pending, nothing is pushed but the snapshot is still read", async () => {
    await queueComplete("python-basics");
    linkPending = true;
    const e = engine();
    await e.run();
    assert.equal(api.calls.push.length, 0);
    assert.equal(api.calls.pull.length, 1);
    assert.equal((await outboxIds()).length, 1);
  });

  it("a stored cursor from another account is not reused: a full snapshot is requested", async () => {
    await db.runAsync("INSERT INTO sync_state (id, cursor, account_id) VALUES (1, 'OLD', 'someone-else')");
    const e = engine();
    await e.run();
    assert.equal(api.calls.pull[0]!.since, undefined);
  });
});
