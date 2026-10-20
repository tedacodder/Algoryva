import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith, readJson } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { authenticate, publicUser } from "@/lib/api/mobile-auth";
import { deleteAccount } from "@/lib/account/delete";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/v1/me. */
export const GET = handle(async (request) => {
  const { user } = await authenticate(request);
  await limitOrThrow(`v1-read:${user.id}`, 300, HOUR);
  return json({ user: publicUser(user) });
});

const deleteSchema = z.object({ password: z.string().min(1).max(256) }).strict();

/** DELETE /api/v1/me with { password }. Permanently deletes the account and all of its data (see lib/account/delete.ts). */
export const DELETE = handle(async (request) => {
  const { user } = await authenticate(request);
  const { password } = parseWith(deleteSchema, await readJson(request, MAX_BODY_SMALL));
  // Recorded before the password is checked, so every guess counts, right or wrong.
  await limitOrThrow(`delete-account:${user.id}`, 5, HOUR, "Too many attempts. Try again later.");
  const r = await deleteAccount(user.id, password);
  if (r.ok) return json({ deleted: true });
  if (r.reason === "invalid_password") throw new ApiError(403, "invalid_password", "Your password is incorrect.");
  if (r.reason === "last_admin") throw new ApiError(409, "last_admin", "The last administrator account cannot be deleted. Make another account an administrator first.");
  throw new ApiError(401, "unauthorized", "Sign in to continue.");
});
