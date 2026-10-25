import type { PullResponse, PushResponse, SyncEventInput, SyncState, ServerNote, ServerMistake, MeResponse, AuthResponse } from "../api/types";

export const emptyState = (): SyncState => ({ topicProgress: [], reviewItems: [], quizResults: [], solves: [], revisits: [] });

/**
 * A scripted server for tests. `snapshot` is what the server holds; `push` decides how it answers each batch.
 * Every call is recorded so tests can assert on what the device sent and asked for.
 */
export function fakeApi(init: { snapshot?: { cursor: string; state?: SyncState; notes?: ServerNote[]; mistakes?: ServerMistake[] }; userId?: string } = {}) {
  const server = {
    cursor: init.snapshot?.cursor ?? "CURSOR_0000000000000000001",
    state: init.snapshot?.state ?? emptyState(),
    notes: init.snapshot?.notes ?? [],
    mistakes: init.snapshot?.mistakes ?? [],
  };
  const userId = init.userId ?? "user-1";
  const calls = { push: [] as SyncEventInput[][], pull: [] as { since?: string; page?: string }[], logout: 0, delete: [] as string[] };
  const hooks: {
    push?: (events: SyncEventInput[]) => Promise<PushResponse> | PushResponse;
    pull?: (since?: string, page?: string) => Promise<PullResponse> | PullResponse;
    login?: () => Promise<AuthResponse>;
    me?: () => Promise<MeResponse>;
  } = {};

  const api = {
    server,
    calls,
    hooks,
    userId,
    async pushEvents(events: SyncEventInput[]): Promise<PushResponse> {
      calls.push.push(events);
      if (hooks.push) return hooks.push(events);
      return { accepted: events.map((e) => e.id), rejected: [], results: {} };
    },
    async pullSnapshot(since?: string, page?: string): Promise<PullResponse> {
      calls.pull.push({ ...(since !== undefined ? { since } : {}), ...(page !== undefined ? { page } : {}) });
      if (hooks.pull) return hooks.pull(since, page);
      if (since === server.cursor && page === undefined) return { cursor: server.cursor, unchanged: true };
      return { cursor: server.cursor, unchanged: false, state: server.state, notes: server.notes, mistakes: server.mistakes, next: null };
    },
    async me(): Promise<MeResponse> {
      if (hooks.me) return hooks.me();
      return { user: { id: userId, email: "a@example.test", username: "ana", emailVerified: true, preferredLanguage: "python" } };
    },
    async login(): Promise<AuthResponse> {
      if (hooks.login) return hooks.login();
      return { token: "alv_" + "a".repeat(43), expiresAt: new Date(Date.now() + 86_400_000).toISOString(), user: { id: userId, email: "a@example.test", username: "ana", emailVerified: true, preferredLanguage: "python" } };
    },
    async register(): Promise<AuthResponse> {
      return api.login();
    },
    async logout(): Promise<void> {
      calls.logout++;
    },
    async deleteAccount(password: string): Promise<void> {
      calls.delete.push(password);
    },
  };
  return api;
}

export type FakeApi = ReturnType<typeof fakeApi>;
