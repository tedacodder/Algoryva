import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";
import { ranklistFor, summaryFor } from "@/lib/bot/contest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({ chatId: chatIdSchema, contestId: z.number().int().positive().optional() }).strict();

/** POST /community/ranklist. The top of a contest and this chat's members, live or final. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId, contestId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-ranklist:${hashTelegramId(secret, chatId)}`, 60, HOUR);
  return json(await ranklistFor(secret, chatId, contestId ?? null, new Date()));
});
