import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { chatIdSchema, telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";

import { ackDelivery } from "@/lib/bot/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ deliveryId: z.string().min(1).max(64), outcome: z.enum(["sent", "blocked", "failed"]) }).strict();

/** POST /notifications/ack. Records what happened to one message. A blocked chat is switched off. */
export const POST = handle(async (request) => {
  botSecret();
  const { deliveryId, outcome } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow("bot-ack", 2000, HOUR);
  const ok = await ackDelivery(deliveryId, outcome, new Date());
  if (!ok) throw new ApiError(404, "not_found", "No such message.");
  return json({ ok });
});
