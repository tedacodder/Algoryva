import { ApiError } from "../api/client";
import type { PullResponse, ServerMistake, ServerNote, SyncState } from "../api/types";
import type { CompleteSnapshot } from "../learner/snapshot";

/**
 * Fetches one complete, consistent snapshot. The server splits a snapshot into pages; if the data changes between pages, it answers
 * 409 state_changed and this function starts again from the first page (up to MAX_RESTARTS). The result is only returned when every
 * page belongs to the same snapshot, so nothing partial is ever applied.
 */
export type SnapshotApi = { pullSnapshot(since?: string, page?: string): Promise<PullResponse> };
export type SnapshotResult = { kind: "unchanged" } | ({ kind: "complete" } & CompleteSnapshot);

const MAX_RESTARTS = 3;

export async function fetchSnapshot(api: SnapshotApi, since?: string): Promise<SnapshotResult> {
  let restarts = 0;
  for (;;) {
    try {
      return await fetchOnce(api, since);
    } catch (e) {
      if (e instanceof ApiError && e.code === "state_changed" && restarts < MAX_RESTARTS) {
        restarts++;
        since = undefined; // a restart needs the full snapshot, not "unchanged"
        continue;
      }
      throw e;
    }
  }
}

async function fetchOnce(api: SnapshotApi, since?: string): Promise<SnapshotResult> {
  const first = await api.pullSnapshot(since);
  if (first.unchanged) return { kind: "unchanged" };
  if (!first.state) throw new Error("The first page of a snapshot had no state.");
  const state: SyncState = first.state;
  const notes: ServerNote[] = [...first.notes];
  const mistakes: ServerMistake[] = [...first.mistakes];
  let next = first.next;
  while (next) {
    const page = await api.pullSnapshot(undefined, next);
    if (page.unchanged) throw new Error("A later page reported unchanged, which the server should not do.");
    if (page.cursor !== first.cursor) throw new ApiError(409, "state_changed", "The data changed while downloading.");
    notes.push(...page.notes);
    mistakes.push(...page.mistakes);
    next = page.next;
  }
  return { kind: "complete", cursor: first.cursor, state, notes, mistakes };
}
