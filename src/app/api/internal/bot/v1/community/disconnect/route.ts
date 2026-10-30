import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatKey } from "@/lib/telegram/chat-cipher";
import { chatIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";
import { connectHandle, connectedHandles, disconnectHandle, randomProblem } from "@/lib/bot/community";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ chatId: chatIdSchema, handle: z.string().regex(/^[A-Za-z0-9_.-]{3,24}$/).optional() }).strict();

/** POST /community/disconnect. Removes one connected handle, or all of them when none is named. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId, handle: cfHandle } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-disconnect:${hashTelegramId(secret, chatId)}`, 30, HOUR);
  return json({ removed: await disconnectHandle(secret, chatId, cfHandle) });
});
