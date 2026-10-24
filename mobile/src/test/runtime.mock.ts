/** Test double for the sync runtime: records calls and exposes a status the tests can set. */
export const engineStatus = { state: "guest", pending: 0, lastSyncedAt: null, message: null, issues: [] as { id: string; reason: string }[] };
export const runtimeCalls = { submitAnswers: [] as { problemId: string; outputs: string[] }[], completeTopic: [] as string[], setGuest: 0 };
export const submitResult: { value: { ok: boolean; reason?: string } } = { value: { ok: true } };
