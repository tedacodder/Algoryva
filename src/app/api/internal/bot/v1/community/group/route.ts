import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { chatIdSchema, telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";

import { setGroup } from "@/lib/bot/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ chatId: chatIdSchema, enable: z.boolean() }).strict();

/**
 * POST /community/group. Turns a group on or off. The bot must have checked that the requester is a group admin before calling this.
 * The bot secret is the trust boundary: only the bot holds it.
 */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const key = chatKey();
  const { chatId, enable } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-group:${hashTelegramId(secret, chatId)}`, 30, HOUR);
  return json(await setGroup(secret, key, chatId, enable));
});
