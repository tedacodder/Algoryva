import { ApiError, handle, json } from "@/lib/api/errors";
import { limitOrThrow } from "@/lib/api/limits";
import { authenticate } from "@/lib/api/mobile-auth";
import { pull, sinceSchema } from "@/lib/mobile/pull";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/v1/sync/pull?since=<cursor>&page=<token>. A snapshot of the user's server state; see lib/mobile/pull.ts. */
export const GET = handle(async (request) => {
  const { user } = await authenticate(request);
  const params = new URL(request.url).searchParams;
  const sinceRaw = params.get("since");
  const since = sinceRaw === null ? null : sinceSchema.safeParse(sinceRaw).success ? sinceRaw : (() => { throw new ApiError(400, "invalid_request", "Invalid request (since): not a cursor."); })();
  const page = params.get("page");
  await limitOrThrow(`v1-read:${user.id}`, 300, HOUR);
  return json(await pull(user.id, since, page));
});
