import type { SqlDb } from "../db/sql";
import type { MeResponse, PushResponse, SyncEventInput } from "../api/types";
import { ApiError, NetworkError } from "../api/client";
import { applySnapshot, countPending, readSyncState } from "../learner/snapshot";
import { backoffDelayMs } from "./backoff";
import { fetchSnapshot, type SnapshotApi } from "./fetch";

/**
 * The sync engine. One cycle is: identify the account, push the outbox (in batches), then pull a complete snapshot and apply it.
 *
 * Rules, all enforced here:
 *  - One cycle at a time. A request while a cycle runs marks it "run again" instead of starting a second one.
 *  - An outbox entry is removed only when the server has answered for it (accepted or rejected). Anything else stays.
 *  - The cursor is stored only together with a complete, applied snapshot (applySnapshot does both in one transaction).
 *  - 4xx answers (other than 401 and 429) stop the retries: retrying the same request cannot succeed. The user sees the error.
 *  - Network errors, 429 and 5xx retry with exponential backoff and jitter. A 401 ends the session.
 *  - While `linkPending()` is true (the user must choose how to combine data after signing in), nothing is pushed.
 */
export type EngineState = "guest" | "synced" | "pending" | "syncing" | "offline" | "error";
export type Issue = { id: string; reason: string };
export type EngineStatus = {
  state: EngineState;
  pending: number;
  lastSyncedAt: string | null;
  message: string | null;
  issues: Issue[];
};

export type SyncApi = SnapshotApi & {
  pushEvents(events: SyncEventInput[]): Promise<PushResponse>;
  me(): Promise<MeResponse>;
};

export type EngineDeps = {
  db: SqlDb;
  api: SyncApi;
  isSignedIn(): boolean;
  linkPending(): boolean;
  now(): Date;
  random(): number;
  /** Largest JSON body per push. The server accepts 256 KB; keep well below it. */
  maxBatchBytes?: number;
  /** Serialises local write sections with the user's actions (see db/lock.ts). Defaults to running directly. */
  lock?: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Work that needs the network after a snapshot is applied, such as judging queued answers. A failure is handled like a sync failure. */
  afterCycle?: () => Promise<void>;
};

const BATCH_LIMIT = 50;
const DEFAULT_BATCH_BYTES = 200_000;

export type SyncEngine = ReturnType<typeof createSyncEngine>;

export function createSyncEngine(deps: EngineDeps) {
  const locked = deps.lock ?? (<T,>(fn: () => Promise<T>) => fn());
  let status: EngineStatus = { state: "guest", pending: 0, lastSyncedAt: null, message: null, issues: [] };
  const listeners = new Set<(s: EngineStatus) => void>();
  let running: Promise<void> | null = null;
  let dirty = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryAt: number | null = null;

  const set = (patch: Partial<EngineStatus>) => {
    status = { ...status, ...patch };
    for (const l of listeners) l(status);
  };

  async function refreshPending(): Promise<number> {
    const pending = await countPending(deps.db);
    set({ pending });
    return pending;
  }

  /** Pushes the whole outbox in size-limited batches. Returns the issues the server reported. */
  async function pushAll(): Promise<Issue[]> {
    const issues: Issue[] = [];
    const maxBytes = deps.maxBatchBytes ?? DEFAULT_BATCH_BYTES;
    for (;;) {
      const rows = await deps.db.getAllAsync<{ id: string; type: string; payload: string; at: string }>(
        "SELECT id, type, payload, at FROM outbox ORDER BY seq LIMIT ?", [BATCH_LIMIT],
      );
      if (rows.length === 0) return issues;
      const batch: SyncEventInput[] = [];
      let bytes = 0;
      for (const r of rows) {
        const ev = { id: r.id, type: r.type, payload: JSON.parse(r.payload), at: r.at } as SyncEventInput;
        const size = r.payload.length + 120;
        if (batch.length > 0 && bytes + size > maxBytes) break;
        batch.push(ev);
        bytes += size;
      }
      const res = await deps.api.pushEvents(batch);
      const answered = new Set([...res.accepted, ...res.rejected.map((r) => r.id)]);
      for (const r of res.rejected) issues.push({ id: r.id, reason: r.reason });
      // Remove only the entries the server answered for. Anything it did not mention stays queued.
      const done = batch.filter((e) => answered.has(e.id)).map((e) => e.id);
      if (done.length > 0) {
        await locked(() => deps.db.withTransactionAsync(async () => {
          for (const id of done) await deps.db.runAsync("DELETE FROM outbox WHERE id = ?", [id]);
        }));
      }
      if (batch.some((e) => !answered.has(e.id))) throw new Error("The server did not answer for every change in a batch.");
    }
  }

  /**
   * Who is signed in now. The stored account id describes the cursor, not the session, so it is never trusted for this.
   * The answer is remembered until sign-out or a new sign-in, which means one extra request per app session at most.
   */
  let account: string | null = null;
  async function ensureAccount(): Promise<string> {
    if (account) return account;
    const me = await deps.api.me();
    account = me.user.id;
    return account;
  }

  async function cycle(): Promise<void> {
    if (!deps.isSignedIn()) {
      set({ state: "guest", message: null });
      await refreshPending();
      return;
    }
    set({ state: "syncing", message: null });
    try {
      const accountId = await ensureAccount();
      let issues: Issue[] = [];
      if (!deps.linkPending()) issues = await pushAll();
      const stored = await readSyncState(deps.db);
      const since = stored?.accountId === accountId ? stored.cursor ?? undefined : undefined;
      const snap = await fetchSnapshot(deps.api, since);
      if (snap.kind === "complete") {
        await locked(() => applySnapshot(deps.db, snap, accountId, deps.now()));
      }
      if (deps.afterCycle) await deps.afterCycle();
      failures = 0;
      retryAt = null;
      const pending = await refreshPending();
      const now = deps.now().toISOString();
      set({
        state: pending > 0 ? "pending" : "synced",
        lastSyncedAt: now,
        issues: [...status.issues, ...issues].slice(-50),
        message: pending > 0 ? `${pending} change${pending === 1 ? "" : "s"} waiting to sync` : null,
      });
    } catch (e) {
      await handleFailure(e);
    }
  }

  async function handleFailure(e: unknown): Promise<void> {
    await refreshPending();
    if (e instanceof NetworkError) {
      failures++;
      set({ state: "offline", message: "You are offline. Changes are saved and will sync when you reconnect." });
      scheduleRetry();
      return;
    }
    if (e instanceof ApiError) {
      if (e.status === 401) {
        // The session is gone. The session module already removed the token.
        set({ state: "guest", message: null });
        return;
      }
      if (e.status === 429 || e.status >= 500) {
        failures++;
        set({ state: "error", message: "The server is busy. Trying again shortly." });
        scheduleRetry();
        return;
      }
      // Any other 4xx: retrying the same request cannot succeed, so stop and tell the user.
      set({ state: "error", message: `Sync stopped: ${e.message}` });
      return;
    }
    failures++;
    set({ state: "error", message: "Sync failed. Trying again shortly." });
    scheduleRetry();
  }

  function scheduleRetry(): void {
    const delay = backoffDelayMs(failures, deps.random);
    retryAt = deps.now().getTime() + delay;
    schedule(delay);
  }

  /** Runs one cycle now. Concurrent calls share the running cycle; a call during a cycle runs one more cycle afterwards. */
  function run(): Promise<void> {
    if (running) {
      dirty = true;
      return running;
    }
    running = (async () => {
      do {
        dirty = false;
        if (timer) { clearTimeout(timer); timer = null; }
        await cycle();
      } while (dirty);
    })().finally(() => {
      running = null;
    });
    return running;
  }

  /** Runs a cycle after `delayMs`. Asking for an earlier time replaces a later one. */
  function schedule(delayMs: number): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, delayMs);
    // In Node (tests, tools) a pending retry must not keep the process alive. React Native's timers have no unref: skip it there.
    (timer as unknown as { unref?: () => void }).unref?.();
  }

  return {
    run,
    schedule,
    /** Schedules a cycle soon after a local change, so a burst of changes is sent together. */
    nudge(): void {
      if (!running && retryAt === null) schedule(1_500);
      else if (retryAt !== null) dirty = true;
    },
    get status(): EngineStatus { return status; },
    subscribe(l: (s: EngineStatus) => void): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    refreshPending,
    /** Clears the history of rejected changes once the user has seen them. */
    dismissIssues(): void {
      set({ issues: [] });
    },
    /** Sets the status for states the account service decides on (signed out, waiting for a choice). */
    setGuest(): void {
      account = null;
      set({ state: "guest", message: null, lastSyncedAt: null });
    },
    /** Called by the account service after a sign-in, so the engine knows the user without asking the server again. */
    setAccount(userId: string): void {
      account = userId;
    },
  };
}
