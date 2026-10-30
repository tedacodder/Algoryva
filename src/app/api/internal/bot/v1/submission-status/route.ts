import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { requireLinkedUserId } from "@/lib/telegram/link";
import { telegramIdSchema } from "@/lib/telegram/schema";
import { submissionStatus } from "@/lib/bot/submission";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ telegramId: telegramIdSchema, clientId: z.string().uuid() }).strict();

/** POST /api/internal/bot/v1/submission-status. The stored outcome of the caller's own submission. Other users' ids are not found. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { telegramId, clientId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-status:${hashTelegramId(secret, telegramId)}`, 120, HOUR);
  const userId = await requireLinkedUserId(secret, telegramId);
  const status = await submissionStatus(userId, clientId);
  if (!status) throw new ApiError(404, "not_found", "No submission with that id was found.");
  return json(status);
});
