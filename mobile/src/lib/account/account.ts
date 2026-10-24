import type { SqlDb } from "../db/sql";
import type { AuthResponse, MeResponse, PullResponse, PushResponse, SyncEventInput } from "../api/types";
import { applySnapshot, clearServerMirror, countPending, type CompleteSnapshot } from "../learner/snapshot";
import { fetchSnapshot } from "../sync/fetch";
import type { SyncEngine } from "../sync/engine";

/**
 * Sign-in, sign-out and account deletion, on the device side.
 *
 * Signing in never silently merges two sets of data. If this device has unsent changes AND the account already has data, the user
 * chooses: combine (send the device's changes to the account) or use the account (discard the device's unsent changes). If the
 * account is empty, or the device has nothing unsent, the account data simply becomes the device's data.
 *
 * Signing out keeps unsent changes on the device unless the user explicitly discards them. Deleting the account removes everything.
 */
export type AccountApi = {
  login(input: { email: string; password: string; deviceName?: string }): Promise<AuthResponse>;
  register(input: { email: string; username: string; password: string; deviceName?: string }): Promise<AuthResponse>;
  logout(): Promise<void>;
  me(): Promise<MeResponse>;
  deleteAccount(password: string): Promise<void>;
  pullSnapshot(since?: string, page?: string): Promise<PullResponse>;
  pushEvents(events: SyncEventInput[]): Promise<PushResponse>;
};

export type SessionOps = {
  startSession(token: string): Promise<void>;
  endSession(): Promise<void>;
};

export type AuthOutcome =
  | { kind: "linked"; userId: string }
  | { kind: "choose"; pending: number; userId: string };

export type AccountDeps = {
  db: SqlDb;
  api: AccountApi;
  session: SessionOps;
  engine: SyncEngine;
  setLinkPending(v: boolean): void;
  now(): Date;
  /** Serialises local write sections with the engine and the user's actions (see db/lock.ts). */
  lock?: <T>(fn: () => Promise<T>) => Promise<T>;
};

export function createAccountService(deps: AccountDeps) {
  const locked = deps.lock ?? (<T,>(fn: () => Promise<T>) => fn());
  let awaiting: { snap: CompleteSnapshot; userId: string } | null = null;

  async function linkAfterAuth(userId: string, snap: CompleteSnapshot): Promise<AuthOutcome> {
    deps.engine.setAccount(userId);
    const pending = await countPending(deps.db);
    const serverHasData = snap.state.topicProgress.length + snap.state.reviewItems.length + snap.state.quizResults.length
      + snap.state.solves.length + snap.state.revisits.length + snap.notes.length + snap.mistakes.length > 0;
    if (pending > 0 && serverHasData) {
      awaiting = { snap, userId };
      deps.setLinkPending(true);
      return { kind: "choose", pending, userId };
    }
    await locked(() => applySnapshot(deps.db, snap, userId, deps.now()));
    await deps.engine.refreshPending();
    void deps.engine.run();
    return { kind: "linked", userId };
  }

  async function downloadAccount(): Promise<CompleteSnapshot> {
    const r = await fetchSnapshot(deps.api);
    if (r.kind !== "complete") throw new Error("Expected a complete snapshot after signing in.");
    return r;
  }

  return {
    async signIn(input: { email: string; password: string }): Promise<AuthOutcome> {
      const auth = await deps.api.login(input);
      await deps.session.startSession(auth.token);
      return linkAfterAuth(auth.user.id, await downloadAccount());
    },

    async register(input: { email: string; username: string; password: string }): Promise<AuthOutcome> {
      const auth = await deps.api.register(input);
      await deps.session.startSession(auth.token);
      return linkAfterAuth(auth.user.id, await downloadAccount());
    },

    /** Answers the question asked by a "choose" outcome. */
    async chooseLink(choice: "combine" | "account"): Promise<void> {
      if (!awaiting) throw new Error("Nothing to choose.");
      const { snap, userId } = awaiting;
      await locked(async () => {
        if (choice === "account") {
          await deps.db.runAsync("DELETE FROM outbox"); // the device's unsent changes are discarded, with the user's consent
        }
        await applySnapshot(deps.db, snap, userId, deps.now());
      });
      awaiting = null;
      deps.setLinkPending(false);
      await deps.engine.refreshPending();
      void deps.engine.run();
    },

    /**
     * Signs out. If unsent changes exist and `discardPending` is false, nothing happens and the caller must ask the user first.
     * The account's data leaves the device. Unsent changes stay, and become this device's own changes.
     */
    async signOut(opts: { discardPending: boolean }): Promise<{ kind: "signed-out" } | { kind: "needs-confirmation"; pending: number }> {
      const pending = await countPending(deps.db);
      if (pending > 0 && !opts.discardPending) return { kind: "needs-confirmation", pending };
      try {
        await deps.api.logout();
      } catch {
        // The token may already be invalid or the network may be down. Either way the device forgets it below.
      }
      await deps.session.endSession();
      awaiting = null;
      deps.setLinkPending(false);
      await locked(async () => {
        if (opts.discardPending) await deps.db.runAsync("DELETE FROM outbox");
        await clearServerMirror(deps.db, deps.now());
      });
      deps.engine.setGuest();
      await deps.engine.refreshPending();
      return { kind: "signed-out" };
    },

    /** Deletes the account on the server (which removes every server-side row), then removes everything on this device. */
    async deleteAccount(password: string): Promise<void> {
      await deps.api.deleteAccount(password);
      await deps.session.endSession();
      awaiting = null;
      deps.setLinkPending(false);
      await locked(async () => {
        await deps.db.runAsync("DELETE FROM outbox");
        await clearServerMirror(deps.db, deps.now());
      });
      deps.engine.setGuest();
      await deps.engine.refreshPending();
    },

    /** Called when the server rejects the session (401). Account data leaves the device; unsent changes are kept. */
    async handleSessionLost(): Promise<void> {
      awaiting = null;
      deps.setLinkPending(false);
      await locked(() => clearServerMirror(deps.db, deps.now()));
      deps.engine.setGuest();
      await deps.engine.refreshPending();
    },

    hasPendingChoice(): boolean {
      return awaiting !== null;
    },
  };
}
