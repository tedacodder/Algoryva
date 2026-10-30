import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { botSecret, hashTelegramId, readSignedJson } from "@/lib/telegram/bot-auth";
import { chatIdSchema } from "@/lib/telegram/schema";
import { HOUR } from "@/lib/rate-limit";
import { classroomReport } from "@/lib/bot/classroom";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// A report may check up to FETCH_BUDGET handles on Codeforces (about 30 seconds with the rate limit). Allow the time.
export const maxDuration = 60;

const bodySchema = z.object({ chatId: chatIdSchema }).strict();

/** POST /community/group-report. Who is registered, who solved the group's problem, who has not, and who is still being checked. */
export const POST = handle(async (request) => {
  const secret = botSecret();
  const { chatId } = parseWith(bodySchema, await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow(`bot-group-report:${hashTelegramId(secret, chatId)}`, 30, HOUR);
  return json(await classroomReport(secret, chatId, new Date()));
});
