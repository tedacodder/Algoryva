import * as SecureStore from "expo-secure-store";
import { createApiClient } from "../api/client";
import { API_BASE_URL } from "../config";

/**
 * The signed-in session. The bearer token lives only in the device's secure storage (Android Keystore through expo-secure-store)
 * and in memory while the app runs. It is never written to AsyncStorage, SQLite, logs or the app bundle.
 * `WHEN_UNLOCKED_THIS_DEVICE_ONLY` keeps it out of device backups on iOS; on Android, app backup is disabled in app.json.
 */
const TOKEN_KEY = "algoryva.session-token";
const STORE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

let token: string | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

/** Reads the stored token once at startup. Safe to call repeatedly. */
export async function loadSession(): Promise<void> {
  if (loaded) return;
  token = await SecureStore.getItemAsync(TOKEN_KEY, STORE_OPTIONS);
  loaded = true;
  notify();
}

export async function startSession(newToken: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, newToken, STORE_OPTIONS);
  token = newToken;
  loaded = true;
  notify();
}

/** Clears the token from memory first, so a failed disk delete can never leave an active session in the app. */
export async function endSession(): Promise<void> {
  token = null;
  notify();
  await SecureStore.deleteItemAsync(TOKEN_KEY, STORE_OPTIONS);
}

export function isSignedIn(): boolean {
  return token !== null;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The one API client for the app. A 401 on a request that sent the token signs the device out cleanly: the token is removed,
 * and subscribers (the UI) are told. Sign-in screens come in a later phase.
 */
let sessionLost: (() => Promise<void>) | null = null;

/** Called when the server rejects the session. The sync layer uses it to remove account data from the device. */
export function setSessionLostHandler(handler: () => Promise<void>): void {
  sessionLost = handler;
}

export const api = createApiClient({
  baseUrl: API_BASE_URL,
  getToken: () => token,
  onUnauthorized: async () => {
    await endSession();
    await sessionLost?.();
  },
});
