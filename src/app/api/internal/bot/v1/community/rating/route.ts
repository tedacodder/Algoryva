import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { readSignedJson } from "@/lib/telegram/bot-auth";
import { HOUR } from "@/lib/rate-limit";
import { ratingFor } from "@/lib/bot/contest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ handle: z.string().regex(/^[A-Za-z0-9_.-]{3,24}$/) }).strict();

/** POST /community/rating. A Codeforces handle's rating, best rating and rank. */
export const POST = handle(async (request) => {
  const { handle: name } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow("bot-rating:all", 600, HOUR);
  return json(await ratingFor(name, new Date()));
});
