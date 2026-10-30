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

const bodySchema = z
  .object({ chatId: chatIdSchema, chatType: z.enum(["private", "group"]), handle: z.string().regex(/^[A-Za-z0-9_.-]{3,24}$/, "invalid handle") })
  .strict();

/** POST /community/connect. Connects a Codeforces handle to a chat. The handle is checked against Codeforces before it is saved. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const key = chatKey();
  const { chatId, chatType, handle: cfHandle } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-connect:${hashTelegramId(secret, chatId)}`, 20, HOUR);
  return json(await connectHandle(secret, key, chatId, chatType, cfHandle, new Date()));
});
