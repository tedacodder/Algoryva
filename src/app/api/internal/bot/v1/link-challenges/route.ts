import { z } from "zod";
import { ApiError, handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { createLinkChallenge } from "@/lib/telegram/link";
import { siteOrigin } from "@/lib/telegram/config";
import { telegramIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ telegramId: telegramIdSchema }).strict();

/**
 * POST /api/internal/bot/v1/link-challenges, signed by the bot. Body: { telegramId }. Returns 201 { expiresAt, linkUrl }.
 * The bot sends linkUrl privately to that Telegram user. The token is in the URL fragment, which browsers do not send to the
 * server, so it stays out of server and proxy logs. The bot must never log this response body.
 */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const origin = siteOrigin();
  const { telegramId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-link:${hashTelegramId(secret, telegramId)}`, 5, HOUR);
  const issued = await createLinkChallenge(secret, telegramId, new Date());
  if (!issued.ok) throw new ApiError(409, "already_linked", "This Telegram account is already linked. Send /unlink first to link a different account.");
  return json({ expiresAt: issued.expiresAt.toISOString(), linkUrl: `${origin}/telegram/link#${issued.token}` }, 201);
});
