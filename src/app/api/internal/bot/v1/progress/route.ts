import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { requireLinkedUserId } from "@/lib/telegram/link";
import { telegramIdSchema } from "@/lib/telegram/schema";
import { progressFor } from "@/lib/bot/progress";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ telegramId: telegramIdSchema }).strict();

/** POST /api/internal/bot/v1/progress. XP, level, streak, badges and the solve breakdown, computed by the website's own functions. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { telegramId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-progress:${hashTelegramId(secret, telegramId)}`, 60, HOUR);
  const userId = await requireLinkedUserId(secret, telegramId);
  return json(await progressFor(userId));
});
