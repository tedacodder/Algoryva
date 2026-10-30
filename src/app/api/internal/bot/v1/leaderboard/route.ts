import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { requireLinkedUserId } from "@/lib/telegram/link";
import { telegramIdSchema } from "@/lib/telegram/schema";
import { weeklyLeaderboard } from "@/lib/bot/leaderboard";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ telegramId: telegramIdSchema, offset: z.number().int().min(0).max(1000).optional() }).strict();

/**
 * POST /api/internal/bot/v1/leaderboard. The weekly board for linked chats only, so the table is not open to anyone who messages
 * the bot. Lists opted-in accounts with output-matched solves only.
 */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { telegramId, offset } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-leaderboard:${hashTelegramId(secret, telegramId)}`, 120, HOUR);
  await requireLinkedUserId(secret, telegramId);
  return json(await weeklyLeaderboard(new Date(), offset ?? 0));
});
