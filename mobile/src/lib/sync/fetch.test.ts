import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fetchSnapshot } from "./fetch";
import { ApiError } from "../api/client";
import type { PullResponse, ServerNote } from "../api/types";
import { emptyState } from "../test-support/fake-api";

const note = (id: string): ServerNote => ({ id, title: id, body: "b", tags: [], createdAt: "2026-10-01T00:00:00.000Z" });
const stale = () => new ApiError(409, "state_changed", "changed");

describe("fetchSnapshot", () => {
  it("returns unchanged when the cursor still matches", async () => {
    const api = { pullSnapshot: async () => ({ cursor: "C1", unchanged: true }) as PullResponse };
    assert.deepEqual(await fetchSnapshot(api, "C1"), { kind: "unchanged" });
  });

  it("assembles every page of one snapshot, in order", async () => {
    const pages: Record<string, PullResponse> = {
      first: { cursor: "C1", unchanged: false, state: emptyState(), notes: [note("a")], mistakes: [], next: "P2" },
      P2: { cursor: "C1", unchanged: false, state: null, notes: [note("b")], mistakes: [], next: "P3" },
      P3: { cursor: "C1", unchanged: false, state: null, notes: [note("c")], mistakes: [], next: null },
    };
    const api = { pullSnapshot: async (_s?: string, page?: string) => pages[page ?? "first"]! };
    const r = await fetchSnapshot(api);
    assert.equal(r.kind, "complete");
    if (r.kind !== "complete") return;
    assert.deepEqual(r.notes.map((n) => n.id), ["a", "b", "c"]);
    assert.equal(r.cursor, "C1");
  });

  it("restarts from the first page when the data changes between pages, then succeeds", async () => {
    let attempt = 0;
    const api = {
      pullSnapshot: async (_s?: string, page?: string): Promise<PullResponse> => {
        if (page === undefined) {
          attempt++;
          return { cursor: attempt === 1 ? "C1" : "C2", unchanged: false, state: emptyState(), notes: [], mistakes: [], next: "P2" };
        }
        if (attempt === 1) throw stale(); // the server answers 409 when the snapshot moved on
        return { cursor: "C2", unchanged: false, state: null, notes: [note("z")], mistakes: [], next: null };
      },
    };
    const r = await fetchSnapshot(api);
    assert.equal(attempt, 2, "the second attempt starts over from the first page");
    assert.equal(r.kind === "complete" ? r.cursor : null, "C2");
  });

  it("a page whose cursor differs from the first page is treated as a change and restarts", async () => {
    let calls = 0;
    const api = {
      pullSnapshot: async (_s?: string, page?: string): Promise<PullResponse> => {
        calls++;
        if (page === undefined) return { cursor: calls < 3 ? "C1" : "C9", unchanged: false, state: emptyState(), notes: [], mistakes: [], next: "P2" };
        return { cursor: "C-OTHER", unchanged: false, state: null, notes: [], mistakes: [], next: null };
      },
    };
    await assert.rejects(fetchSnapshot(api), (e: unknown) => e instanceof ApiError && e.code === "state_changed");
  });

  it("gives up after the restart limit and throws, so nothing partial is ever returned", async () => {
    const api = {
      pullSnapshot: async (_s?: string, page?: string): Promise<PullResponse> => {
        if (page === undefined) return { cursor: "C1", unchanged: false, state: emptyState(), notes: [], mistakes: [], next: "P2" };
        throw stale();
      },
    };
    await assert.rejects(fetchSnapshot(api), (e: unknown) => e instanceof ApiError && e.code === "state_changed");
  });

  it("a network failure part-way through is thrown, never returned as a partial snapshot", async () => {
    const api = {
      pullSnapshot: async (_s?: string, page?: string): Promise<PullResponse> => {
        if (page === undefined) return { cursor: "C1", unchanged: false, state: emptyState(), notes: [note("a")], mistakes: [], next: "P2" };
        throw new Error("connection reset");
      },
    };
    await assert.rejects(fetchSnapshot(api), /connection reset/);
  });

  it("a first page without state is rejected", async () => {
    const api = { pullSnapshot: async () => ({ cursor: "C1", unchanged: false, state: null, notes: [], mistakes: [], next: null }) as PullResponse };
    await assert.rejects(fetchSnapshot(api), /no state/);
  });
});
