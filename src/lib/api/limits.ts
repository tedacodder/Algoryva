import { isBlocked, record } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api/errors";

/**
 * Check-then-record on top of the website's AuthAttempt limiter (src/lib/rate-limit.ts), unchanged. Inherited
 * weaknesses, documented in docs/MOBILE_API.md: the check and the record are separate queries, so concurrent
 * requests can exceed a limit by roughly the concurrency, and cleanup of old rows is probabilistic.
 * Retry-After is the window length, an upper bound, because the limiter does not expose the oldest attempt.
 */
export async function limitOrThrow(key: string, max: number, windowMs: number, message = "Too many requests. Try again later."): Promise<void> {
  await checkOrThrow(key, max, windowMs, message);
  await record(key);
}

/** Check only, without recording an attempt. */
export async function checkOrThrow(key: string, max: number, windowMs: number, message = "Too many requests. Try again later."): Promise<void> {
  if (await isBlocked(key, max, windowMs)) throw new ApiError(429, "rate_limited", message, { "Retry-After": String(Math.ceil(windowMs / 1000)) });
}
