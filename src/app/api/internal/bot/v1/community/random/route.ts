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

const rating = z.number().int().min(0).max(4000);
const bodySchema = z
  .object({
    chatId: chatIdSchema,
    minRating: rating.optional(),
    maxRating: rating.optional(),
    tags: z.array(z.string().regex(/^[a-z][a-z0-9-]{1,29}$/, "invalid tag")).max(5).optional(),
  })
  .strict()
  .refine((b) => b.minRating === undefined || b.maxRating === undefined || b.minRating <= b.maxRating, "minRating is above maxRating");

/** POST /community/random. A random problem in the rating band with the tags asked for, skipping problems the chat's handles solved. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId, minRating, maxRating, tags } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-random:${hashTelegramId(secret, chatId)}`, 60, HOUR);
  const filter = {
    minRating: minRating ?? 800,
    maxRating: maxRating ?? (minRating !== undefined ? Math.max(minRating, 2000) : 2000),
    tags: tags ?? [],
  };
  return json(await randomProblem(secret, chatId, filter, new Date()));
});
