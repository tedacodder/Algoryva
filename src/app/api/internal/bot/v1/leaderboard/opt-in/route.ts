import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { setLeaderboardOptIn } from "@/lib/telegram/link";
import { telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ telegramId: telegramIdSchema, optIn: z.boolean() }).strict();

/** POST /api/internal/bot/v1/leaderboard/opt-in. Shows or hides the caller on the public board. Off by default. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { telegramId, optIn } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-optin:${hashTelegramId(secret, telegramId)}`, 10, HOUR);
  const result = await setLeaderboardOptIn(secret, telegramId, optIn);
  if (!result) throw new ApiError(403, "not_linked", "This chat is not connected to an Algoryva account. Send /link to connect it.");
  return json(result);
});
