import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "../db/migrations";
import { openTestDb } from "../test-support/node-sqlite";
import { sampleContent } from "../test-support/fixtures";
import { ApiError, NetworkError } from "../api/client";
import { ContentUnavailableError, refreshContent, type ContentClient } from "./refresh";
import { loadTopics, readContentState } from "./repository";
import type { SqlDb } from "../db/sql";

let db: SqlDb & { close(): void };
beforeEach(async () => {
  db = openTestDb();
  await migrate(db);
});
const now = () => new Date("2026-10-20T10:00:00Z");

/** A fake server holding one version. It answers 304 when the caller already has its ETag, as the real route does. */
function server(version: string) {
  const calls: (string | undefined)[] = [];
  const client: ContentClient = {
    async getContent(etag) {
      calls.push(etag);
      const tag = `"${version}"`;
      if (etag === tag) return { status: "unchanged" };
      return { status: "ok", etag: tag, data: sampleContent(version) };
    },
  };
  return { client, calls, set(v: string) { version = v; } };
}
const offline: ContentClient = { async getContent() { throw new NetworkError("unreachable"); } };

describe("refreshContent", () => {
  it("first run downloads the content and stores it", async () => {
    const s = server("v1");
    const r = await refreshContent(db, s.client, now);
    assert.equal(r.status, "updated");
    assert.equal(r.state.version, "v1");
    assert.equal((await loadTopics(db)).length, 2);
    assert.deepEqual(s.calls, [undefined], "the first request has no ETag");
  });

  it("later runs send the stored ETag and store nothing when the server is unchanged", async () => {
    const s = server("v1");
    await refreshContent(db, s.client, now);
    const before = await readContentState(db);
    const r = await refreshContent(db, s.client, () => new Date("2027-01-01T00:00:00Z"));
    assert.equal(r.status, "current");
    assert.deepEqual(s.calls, [undefined, '"v1"']);
    assert.deepEqual(await readContentState(db), before, "fetched_at must not change on a 304");
  });

  it("downloads the new version when the server changes", async () => {
    const s = server("v1");
    await refreshContent(db, s.client, now);
    s.set("v2");
    const r = await refreshContent(db, s.client, now);
    assert.equal(r.status, "updated");
    assert.equal(r.state.version, "v2");
    assert.equal(r.state.etag, '"v2"');
  });

  it("offline with content stored: keeps working from the stored content", async () => {
    await refreshContent(db, server("v1").client, now);
    const r = await refreshContent(db, offline, now);
    assert.equal(r.status, "offline");
    assert.equal(r.state.version, "v1");
    assert.equal((await loadTopics(db)).length, 2);
  });

  it("first run offline cannot succeed: asks for internet once", async () => {
    await assert.rejects(refreshContent(db, offline, now), ContentUnavailableError);
    assert.equal(await readContentState(db), null);
  });

  it("a server error is not treated as offline: it is rethrown and the stored content is left alone", async () => {
    await refreshContent(db, server("v1").client, now);
    const broken: ContentClient = { async getContent() { throw new ApiError(500, "internal", "Something went wrong.") } };
    await assert.rejects(refreshContent(db, broken, now), ApiError);
    assert.equal((await readContentState(db))?.version, "v1");
  });

  it("an unchanged answer with nothing stored is reported as an error, not silently accepted", async () => {
    const liar: ContentClient = { async getContent() { return { status: "unchanged" }; } };
    await assert.rejects(refreshContent(db, liar, now), /no content is stored/);
  });
});
