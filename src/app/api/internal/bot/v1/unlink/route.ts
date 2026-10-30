import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { unlinkByTelegram } from "@/lib/telegram/link";
import { telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ telegramId: telegramIdSchema }).strict();

/** POST /api/internal/bot/v1/unlink, signed by the bot. Idempotent. Returns { unlinked }. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { telegramId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-unlink:${hashTelegramId(secret, telegramId)}`, 10, HOUR);
  return json(await unlinkByTelegram(secret, telegramId));
});
