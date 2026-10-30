// The serverless entry point: a standard Request -> Response handler. Telegram sends each update here as a POST.
// grammY checks the secret token header itself and answers 401 when it does not match, so a stranger cannot push fake updates.
import { webhookCallback } from "grammy";

export function createWebhookHandler({ bot, secretToken }) {
  const handle = webhookCallback(bot, "std/http", { secretToken, timeoutMilliseconds: 25_000 });
  return (request) => handle(request);
}
