import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";
import { groupLeaderboard } from "@/lib/bot/group-leaderboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// One batch may check up to FETCH_BUDGET students on Codeforces (about 30 seconds with its rate limit).
export const maxDuration = 60;

const bodySchema = z.object({ chatId: chatIdSchema, period: z.enum(["week", "month", "all"]).default("week") }).strict();

/** POST /community/leaderboard. The group's ranking for a period. Call it again to check the members still pending. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId, period } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-leaderboard:${hashTelegramId(secret, chatId)}`, 60, HOUR);
  return json(await groupLeaderboard(secret, chatId, period, new Date()));
});
