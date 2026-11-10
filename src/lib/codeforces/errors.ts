import { ApiError } from "@/lib/api/errors";

/**
 * Codeforces reports a missing handle or contest as "not found". That becomes a clear 404 for the bot.
 * Any other failure is passed on unchanged, so the caller can decide what to do with it.
 */
export function notFoundAs(e: unknown, code: string, message: string): never {
  if (e instanceof Error && (e as Error & { kind?: string }).kind === "not_found") throw new ApiError(404, code, message);
  throw e;
}
