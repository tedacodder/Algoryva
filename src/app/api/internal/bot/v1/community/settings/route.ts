import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { chatIdSchema, telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";

import { updateSettings } from "@/lib/bot/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({ chatId: chatIdSchema, dailyCf: z.boolean().optional(), contestAlerts: z.boolean().optional() })
  .strict()
  .refine((b) => b.dailyCf !== undefined || b.contestAlerts !== undefined, "nothing to change");

/** POST /community/settings. Turns the daily problem or contest reminders on or off for one chat. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId, ...patch } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-settings:${hashTelegramId(secret, chatId)}`, 60, HOUR);
  const updated = await updateSettings(secret, chatId, patch);
  if (!updated) throw new ApiError(404, "not_subscribed", "This chat is not subscribed. Send /start or /enable first.");
  return json({ updated });
});
