import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Shared cache for PUBLIC content only (problem statements and samples, practice lists, custom lesson text).
 * Never cache anything per user: solved status, progress, sessions or hidden tests.
 *
 * Every key carries a version. Admin edits bump the version, which makes all cached content stale at once, without
 * scanning keys. Without UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN the cache is off and every read hits the
 * database, so local development needs no Redis. If Redis fails, reads fall back to the database and never throw.
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
const VERSION_KEY = "content:version";

export async function cached<T>(name: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  if (!redis) return load();
  try {
    const version = (await redis.get<string>(VERSION_KEY)) ?? "0";
    const key = `${name}:v${version}`;
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
    const fresh = await load();
    await redis.set(key, fresh, { ex: ttlSeconds });
    return fresh;
  } catch (e) {
    console.error("[cache] bypassed, reading the database:", (e as Error).message);
    return load();
  }
}

/** Call after any admin change to public content. */
export async function invalidateContent(): Promise<void> {
  if (!redis) return;
  try {
    await redis.incr(VERSION_KEY);
  } catch (e) {
    console.error("[cache] could not invalidate, entries expire on their own:", (e as Error).message);
  }
}
