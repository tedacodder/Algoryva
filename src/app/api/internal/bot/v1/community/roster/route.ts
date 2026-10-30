import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";
import { rosterAction, ROSTER_MAX } from "@/lib/bot/classroom";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z
  .object({
    chatId: chatIdSchema,
    action: z.enum(["set", "add", "remove", "list", "clear"]),
    handles: z.array(z.string().max(64)).max(ROSTER_MAX).optional(),
  })
  .strict();

/** POST /community/roster. Group admins manage the class roster (the bot checks admin status before calling this). */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId, action, handles: list } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-roster:${hashTelegramId(secret, chatId)}`, 120, HOUR);
  return json(await rosterAction(secret, chatId, action, list ?? []));
});
