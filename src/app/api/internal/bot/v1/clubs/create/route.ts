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

const bodySchema = z.object({ telegramId: telegramIdSchema, name: z.string().min(1).max(60) }).strict();

/** POST /clubs/create. Creates a club and makes the caller its leader. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { telegramId, name } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-club-create:${hashTelegramId(secret, telegramId)}`, 10, HOUR);
  const userId = await requireLinkedUserId(secret, telegramId);
  return json(await createClub(userId, name), 201);
});
