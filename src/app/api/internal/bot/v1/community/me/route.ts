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

const bodySchema = z.object({ chatId: chatIdSchema }).strict();

/** POST /community/me. The Codeforces handles connected to this chat, with rating and solved count. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-me:${hashTelegramId(secret, chatId)}`, 60, HOUR);
  return json({ handles: await connectedHandles(secret, chatId, new Date()) });
});
