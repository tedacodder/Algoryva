import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { requireLinkedUserId } from "@/lib/telegram/link";
import { telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";
import { createClub, joinClub, leaveClub, myClub, clubBoard } from "@/lib/bot/clubs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ telegramId: telegramIdSchema }).strict();

/** POST /clubs/leave. Leaves the caller's club. The leader cannot leave while others remain. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { telegramId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-club-leave:${hashTelegramId(secret, telegramId)}`, 20, HOUR);
  const userId = await requireLinkedUserId(secret, telegramId);
  return json(await leaveClub(userId));
});
