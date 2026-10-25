import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SYNC, parseWith, readJson } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { authenticate } from "@/lib/api/mobile-auth";
import { processEvents, pushSchema } from "@/lib/mobile/events";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/v1/sync/push. Idempotent per event id. See docs/MOBILE_API.md for the event types and rejection reasons. */
export const POST = handle(async (request) => {
  const { user } = await authenticate(request);
  const { events } = parseWith(pushSchema, await readJson(request, MAX_BODY_SYNC));
  await limitOrThrow(`v1-push:${user.id}`, 120, HOUR);
  return json(await processEvents(user.id, events));
});
