import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { chatIdSchema, telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";

import { dailyResult } from "@/lib/bot/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ chatId: chatIdSchema }).strict();

/** POST /community/daily. Today's problem for any chat (private or group), on demand. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-daily-cf:${hashTelegramId(secret, chatId)}`, 60, HOUR);
  return json((await dailyResult(secret, chatId, new Date())) ?? { text: null, problem: null });
});
