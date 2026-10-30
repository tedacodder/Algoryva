import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { requireLinkedUserId } from "@/lib/telegram/link";
import { siteOrigin } from "@/lib/telegram/config";
import { telegramIdSchema } from "@/lib/telegram/schema";
import { dailyChallengeFor, utcDay } from "@/lib/bot/daily";
import { HOUR } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ telegramId: telegramIdSchema }).strict();

/** POST /api/internal/bot/v1/daily. Today's challenge for a linked chat. Sample cases only, never hidden tests. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const origin = siteOrigin();
  const { telegramId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-daily:${hashTelegramId(secret, telegramId)}`, 60, HOUR);
  const userId = await requireLinkedUserId(secret, telegramId);
  const now = new Date();
  const problem = await dailyChallengeFor(userId, now);
  if (!problem) return json({ day: utcDay(now), problem: null });
  return json({
    day: utcDay(now),
    problem: {
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      url: `${origin}/problems/${problem.slug}`,
      samples: problem.samples,
    },
  });
});
