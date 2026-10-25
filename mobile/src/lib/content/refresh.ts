import type { SqlDb } from "../db/sql";
import type { ContentResponse } from "../api/types";
import { NetworkError } from "../api/client";
import { readContentState, storeContentSnapshot, type ContentState } from "./repository";

/**
 * Brings the local content up to date with the server. It sends the stored ETag, so an unchanged content costs one small 304 response.
 *
 *  - current:  the server has the same content (304). Nothing is written.
 *  - updated:  new content was downloaded and stored in one transaction.
 *  - offline:  no connection, but content is already stored. The app keeps working from it.
 *
 * First run without a connection cannot succeed: there is no content yet, so ContentUnavailableError is thrown and the UI asks for internet once.
 */
export type ContentClient = {
  getContent(etag?: string): Promise<{ status: "unchanged" } | { status: "ok"; etag: string; data: ContentResponse }>;
};

export type RefreshOutcome =
  | { status: "current"; state: ContentState }
  | { status: "updated"; state: ContentState }
  | { status: "offline"; state: ContentState };

export class ContentUnavailableError extends Error {
  constructor() {
    super("Connect to the internet once to download the lessons. After that they work offline.");
    this.name = "ContentUnavailableError";
  }
}

export async function refreshContent(db: SqlDb, client: ContentClient, now: () => Date = () => new Date()): Promise<RefreshOutcome> {
  const stored = await readContentState(db);
  try {
    const r = await client.getContent(stored?.etag);
    if (r.status === "unchanged") {
      if (!stored) throw new Error("The server said unchanged, but no content is stored.");
      return { status: "current", state: stored };
    }
    await storeContentSnapshot(db, { etag: r.etag, data: r.data }, now());
    const state = await readContentState(db);
    if (!state) throw new Error("Content was stored but could not be read back.");
    return { status: "updated", state };
  } catch (e) {
    if (e instanceof NetworkError) {
      if (stored) return { status: "offline", state: stored };
      throw new ContentUnavailableError();
    }
    throw e;
  }
}
