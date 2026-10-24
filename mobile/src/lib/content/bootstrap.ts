import { api } from "../auth/session";
import { getDatabase } from "../db/open";
import { refreshContent, ContentUnavailableError, type RefreshOutcome } from "./refresh";
import { readContentState } from "./repository";

/**
 * App startup for content: open the database, then refresh the content if the device can reach the server.
 * Returns the outcome so the root layout can decide what to show. It never throws for being offline.
 */
export type StartupResult =
  | { kind: "ready"; outcome: RefreshOutcome }
  | { kind: "needs-internet" }
  | { kind: "failed"; message: string };

export async function startContent(): Promise<StartupResult> {
  try {
    const db = await getDatabase();
    const outcome = await refreshContent(db, api);
    return { kind: "ready", outcome };
  } catch (e) {
    if (e instanceof ContentUnavailableError) return { kind: "needs-internet" };
    const message = e instanceof Error ? e.message : "The content could not be loaded.";
    // If content already exists locally, a failure to refresh must not block studying.
    try {
      const db = await getDatabase();
      const state = await readContentState(db);
      if (state) return { kind: "ready", outcome: { status: "offline", state } };
    } catch {
      // fall through to the error state
    }
    return { kind: "failed", message };
  }
}
