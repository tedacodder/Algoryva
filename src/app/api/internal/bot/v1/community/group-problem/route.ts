import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";
import { groupProblemAction } from "@/lib/bot/classroom";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ chatId: chatIdSchema, problem: z.string().max(20).nullable() }).strict();

/** POST /community/group-problem. Sets the group's own daily problem ("1800/C"), or resets it to the default with null. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId, problem } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-group-problem:${hashTelegramId(secret, chatId)}`, 30, HOUR);
  return json(await groupProblemAction(secret, chatId, problem, new Date()));
});
