import { z } from "zod";
import { handle, json } from "@/lib/api/errors";
import { MAX_BODY_SMALL, parseWith } from "@/lib/api/http";
import { limitOrThrow } from "@/lib/api/limits";
import { readSignedJson } from "@/lib/telegram/bot-auth";
import { HOUR } from "@/lib/rate-limit";
import { botStats } from "@/lib/bot/stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /community/stats. Only the bot calls it, and only after it has checked that the sender is the owner. */
export const POST = handle(async (request) => {
  parseWith(z.object({}).strict(), await readSignedJson(request, MAX_BODY_SMALL));
  await limitOrThrow("bot-stats:owner", 120, HOUR);
  return json(await botStats(new Date()));
});
