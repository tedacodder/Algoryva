import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { chatIdSchema, telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";

import { referralStats } from "@/lib/bot/community";
import { requireLinkedUserId } from "@/lib/telegram/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ telegramId: telegramIdSchema }).strict();

/** POST /community/referral. The caller's referral code, and how many referred accounts have an output-matched solve. Linked chats only. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { telegramId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-referral:${hashTelegramId(secret, telegramId)}`, 60, HOUR);
  const userId = await requireLinkedUserId(secret, telegramId);
  return json(await referralStats(userId));
});
