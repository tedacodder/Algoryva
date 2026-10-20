import { db } from "@/lib/db";
import { handle, json } from "@/lib/api/errors";
import { limitOrThrow } from "@/lib/api/limits";
import { authenticate } from "@/lib/api/mobile-auth";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/v1/auth/logout. Deletes exactly this token's session. Calling it again returns 401, which clients treat as signed out. */
export const POST = handle(async (request) => {
  const { user, tokenHash } = await authenticate(request);
  await limitOrThrow(`v1-logout:${user.id}`, 60, HOUR);
  await db.session.deleteMany({ where: { tokenHash } });
  return json({ ok: true });
});
