/**
 * The one public setting the app uses: where the Algoryva website API lives. It is read at build time from
 * EXPO_PUBLIC_API_URL. Anything with the EXPO_PUBLIC_ prefix ends up in the app bundle, so it must never hold a secret.
 */
export const DEFAULT_API_BASE_URL = "https://algoryva.vercel.app";

export class ConfigError extends Error {}

/**
 * Validates and normalises the API base URL.
 * - Production builds must use https.
 * - Development builds may also use plain http, but only for a local or LAN address, because a phone cannot reach
 *   the developer's "localhost" (see mobile/README.md).
 * Returns the URL without a trailing slash.
 */
export function resolveApiBaseUrl(raw: string | undefined, isDev: boolean): string {
  const value = (raw ?? "").trim() || DEFAULT_API_BASE_URL;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError("EXPO_PUBLIC_API_URL is not a valid URL.");
  }
  if (url.username || url.password) throw new ConfigError("EXPO_PUBLIC_API_URL must not contain credentials.");
  if (url.search || url.hash) throw new ConfigError("EXPO_PUBLIC_API_URL must not contain a query or fragment.");
  if (url.protocol === "https:") return value.replace(/\/+$/, "");
  if (url.protocol === "http:" && isDev && isLocalOrLan(url.hostname)) return value.replace(/\/+$/, "");
  throw new ConfigError("EXPO_PUBLIC_API_URL must use https (plain http is allowed only in development, for a local address).");
}

/** localhost, loopback, or a private LAN address (10.x, 172.16-31.x, 192.168.x), or the Android emulator host. */
export function isLocalOrLan(host: string): boolean {
  if (host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// `__DEV__` is defined by React Native. The typeof guard keeps this module importable in Node tests.
const isDevBuild = typeof __DEV__ !== "undefined" && __DEV__;
export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, isDevBuild);
