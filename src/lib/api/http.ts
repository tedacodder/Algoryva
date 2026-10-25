import type { ZodType, ZodTypeDef } from "zod";
import { ApiError } from "@/lib/api/errors";

export const MAX_BODY_SMALL = 8 * 1024;
export const MAX_BODY_SYNC = 256 * 1024;

/**
 * Reads a JSON request body with a hard size limit, counted on the bytes actually received (a Content-Length header
 * alone can be wrong). 415 for a wrong content type, 413 when too large, 400 for empty, non-UTF-8 or invalid JSON.
 */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(type)) throw new ApiError(415, "unsupported_media_type", "Send the request as application/json.");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError(413, "payload_too_large", "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "invalid_request", "The request body is empty.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); throw new ApiError(413, "payload_too_large", "The request is too large."); }
    chunks.push(value);
  }
  if (total === 0) throw new ApiError(400, "invalid_request", "The request body is empty.");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new ApiError(400, "invalid_request", "The request body must be valid JSON.");
  }
}

/** Validates with zod. The message names the field and the rule, never the value that was sent. */
export function parseWith<O, I>(schema: ZodType<O, ZodTypeDef, I>, data: unknown): O {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const path = issue.path.join(".");
  throw new ApiError(400, "invalid_request", `Invalid request${path ? ` (${path})` : ""}: ${issue.message}.`);
}
