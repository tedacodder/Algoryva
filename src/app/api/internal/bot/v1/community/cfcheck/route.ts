import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";
import { probeStanding } from "@/lib/codeforces/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  chatId: chatIdSchema,
  contestId: z.number().int().positive(),
  handle: z.string().regex(/^[A-Za-z0-9_.-]{3,24}$/),
}).strict();

/** POST /community/cfcheck. Asks Codeforces directly, now, with no cache: official and unofficial standings for one handle. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const body = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-cfcheck:${hashTelegramId(secret, body.chatId)}`, 20, HOUR);
  return json({
    official: await probeStanding(body.contestId, body.handle, false),
    unofficial: await probeStanding(body.contestId, body.handle, true),
  });
});
