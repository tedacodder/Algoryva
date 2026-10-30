import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { chatIdSchema, telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";

import { registerPrivate, dailyText } from "@/lib/bot/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ chatId: chatIdSchema }).strict();

/** POST /community/start. A private chat started the bot. Records it and returns today's Codeforces problem. No account is needed. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const key = chatKey();
  const { chatId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-start:${hashTelegramId(secret, chatId)}`, 30, HOUR);
  const now = new Date();
  const { created } = await registerPrivate(secret, key, chatId);
  return json({ created, text: await dailyText(secret, chatId, now) });
});
