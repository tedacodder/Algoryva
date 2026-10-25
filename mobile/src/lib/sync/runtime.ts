import * as Crypto from "expo-crypto";
import { api, endSession, isSignedIn, loadSession, setSessionLostHandler, startSession, subscribeSession } from "../auth/session";
import { getDatabase } from "../db/open";
import { enqueueLocal, type LocalAction } from "../learner/apply";
import { createSyncEngine } from "./engine";
import { createAccountService } from "../account/account";
import { subscribeConnectivity } from "../network";
import { withDbLock } from "../db/lock";
import { processSubmissions, queueSubmission } from "../judge/queue";
import type { MistakePayload } from "../api/types";

/**
 * The app's single sync engine, account service and learner actions. Screens call the functions here; they never write the
 * database directly. Expo-only modules are imported here, so the logic modules stay testable in Node.
 */
const newId = () => Crypto.randomUUID();
const SYNC_EVERY_MS = 3 * 60_000;

type Runtime = ReturnType<typeof build>;
let runtime: Runtime | null = null;
let started = false;

function build() {
  // The engine needs the database before the first call, so it is created lazily through a small adapter.
  let linkPending = false;
  const engine = createSyncEngine({
    db: dbProxy(),
    api,
    isSignedIn,
    linkPending: () => linkPending,
    now: () => new Date(),
    random: Math.random,
    lock: withDbLock,
    afterCycle: async () => {
      await processSubmissions(await getDatabase(), api, () => new Date(), withDbLock);
    },
  });
  const account = createAccountService({
    db: dbProxy(),
    api,
    session: { startSession, endSession },
    engine,
    setLinkPending: (v) => { linkPending = v; },
    now: () => new Date(),
    lock: withDbLock,
  });
  return { engine, account };
}

/**
 * Lets modules that need a SqlDb get it asynchronously. The database is opened on first use and the same handle is reused.
 * Methods that run before the database exists wait for it; nothing is dropped.
 */
function dbProxy() {
  const get = () => getDatabase();
  return {
    execAsync: async (sql: string) => (await get()).execAsync(sql),
    runAsync: async (sql: string, params?: (string | number | null)[]) => (await get()).runAsync(sql, params),
    getAllAsync: async <T,>(sql: string, params?: (string | number | null)[]) => (await get()).getAllAsync<T>(sql, params),
    getFirstAsync: async <T,>(sql: string, params?: (string | number | null)[]) => (await get()).getFirstAsync<T>(sql, params),
    withTransactionAsync: async (task: () => Promise<void>) => (await get()).withTransactionAsync(task),
  };
}

export function getRuntime(): Runtime {
  runtime ??= build();
  return runtime;
}

/**
 * Starts the background behaviour once per app run: a sync when the app opens (if signed in), a sync when connectivity returns,
 * and a sync every few minutes while signed in. The session-lost handler removes account data from the device.
 */
export async function startSync(): Promise<void> {
  if (started) return;
  started = true;
  const rt = getRuntime();
  setSessionLostHandler(() => rt.account.handleSessionLost());
  await loadSession().catch(() => undefined);
  if (isSignedIn()) void rt.engine.run();
  subscribeConnectivity((online) => {
    if (online === true && isSignedIn()) void rt.engine.run();
  });
  setInterval(() => {
    if (isSignedIn()) void rt.engine.run();
  }, SYNC_EVERY_MS);
  subscribeSession(() => {
    if (!isSignedIn()) rt.engine.setGuest();
  });
}

/**
 * Learner actions. Each one applies the change locally and queues it for the server in one step. It returns the local rule's answer,
 * so the screen can say "this can't be done yet" without writing anything.
 */
async function act(action: LocalAction) {
  const db = await getDatabase();
  const result = await withDbLock(() => enqueueLocal(db, action, newId(), new Date()));
  if (result.applied) getRuntime().engine.nudge();
  return result;
}

/** Saves an answer for judging. The server checks it when the phone is online; nothing is shown as accepted before that. */
export async function submitAnswers(problemId: string, outputs: string[]) {
  const db = await getDatabase();
  const result = await withDbLock(() => queueSubmission(db, { problemId, outputs, clientId: newId(), now: new Date() }));
  if (result.ok) getRuntime().engine.nudge();
  return result;
}

export const learner = {
  completeTopic: (slug: string) => act({ type: "topic.complete", payload: { slug } }),
  reviewTopic: (slug: string, rating: "good" | "again") => act({ type: "topic.review", payload: { slug, rating } }),
  submitQuiz: (slug: string, answers: number[]) => act({ type: "quiz.submit", payload: { slug, answers } }),
  setExternalSolved: (problemId: string, solved: boolean) => act({ type: "solve.external", payload: { problemId, solved } }),
  addNote: (title: string, body: string, tags: string[]) => act({ type: "note.create", payload: { id: newId(), title, body, tags } }),
  deleteNote: (id: string) => act({ type: "note.delete", payload: { id } }),
  deleteMistake: (id: string) => act({ type: "mistake.delete", payload: { id } }),
  addMistake: (fields: Omit<MistakePayload, "id">) => act({ type: "mistake.create", payload: { id: newId(), ...fields } }),
  reportOutside: (id: string, note: string) => act({ type: "revisit.report_outside", payload: { id, note } }),
};

/**
 * Removes this device's learner data: progress, solves, notes, mistakes, revisits, unsent changes and unsent answers. Only allowed when
 * signed out, so the account's own data is never removed from the device by mistake. The content (lessons, problems) stays.
 */
export async function clearLocalData(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (isSignedIn()) return { ok: false, reason: "Sign out first, then clear the data on this device." };
  const db = await getDatabase();
  await withDbLock(() => db.withTransactionAsync(async () => {
    for (const t of ["outbox", "submissions", "progress", "solves", "revisits", "mistakes", "notes", "sync_state"]) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
  }));
  getRuntime().engine.setGuest();
  return { ok: true };
}
export { newId };
