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

const bodySchema = z.object({ telegramId: telegramIdSchema, code: z.string().regex(/^[0-9a-f]{8}$/) }).strict();

/** POST /clubs/join. Joins a club with its invite code. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { telegramId, code } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-club-join:${hashTelegramId(secret, telegramId)}`, 20, HOUR);
  const userId = await requireLinkedUserId(secret, telegramId);
  return json(await joinClub(userId, code));
});
