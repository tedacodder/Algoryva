import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { chatIdSchema, telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";

import { dueItems } from "@/lib/bot/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({}).strict();

/**
 * POST /notifications/due. The messages the bot should send now. Chat ids are decrypted here, and returned only over this signed
 * channel to the bot. Every returned message must be acknowledged with /notifications/ack.
 */
export const POST = handle(async (request) => {
  botSecret();
  const key = chatKey();
  parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow("bot-due", 120, HOUR);
  return json({ items: await dueItems(key, new Date()) });
});
