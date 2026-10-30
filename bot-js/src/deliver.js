// Sends the community messages that are due. Serverless functions have no always-on loop, so an external scheduler calls this
// endpoint once a minute with the CRON_SECRET bearer token. Each message is acknowledged, so a retry never sends it twice.
import { GrammyError, HttpError } from "grammy";
import { toHtml } from "./render.js";

const PAUSE_MS = 60;
const MAX_WAIT_MS = 30_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function deliverDue({ bot, site }) {
  const counts = { sent: 0, blocked: 0, failed: 0 };
  const { items = [] } = await site.due();
  for (const item of items) {
    let outcome = "sent";
    try {
      await bot.api.sendMessage(Number(item.chatId), toHtml(item.text), {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 403) {
        outcome = "blocked"; // the user blocked the bot, or the bot was removed from the group
      } else if (error instanceof GrammyError && error.error_code === 429) {
        outcome = "failed";
        await sleep(Math.min((error.parameters?.retry_after ?? 1) * 1000, MAX_WAIT_MS));
      } else {
        outcome = "failed"; // includes network trouble; the website retries a bounded number of times
        if (!(error instanceof GrammyError) && !(error instanceof HttpError)) console.error("send failed:", error?.name ?? "unknown");
      }
    }
    counts[outcome] += 1;
    await site.ack(item.deliveryId, outcome);
    await sleep(PAUSE_MS);
  }
  return counts;
}

// Constant-time comparison, so the secret cannot be guessed one character at a time from response timing.
function sameSecret(given, expected) {
  if (!given || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function createDeliverHandler({ bot, site, cronSecret }) {
  return async (request) => {
    const header = request.headers.get("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!sameSecret(given, cronSecret)) return new Response("unauthorized", { status: 401 });
    const counts = await deliverDue({ bot, site });
    return Response.json(counts);
  };
}
