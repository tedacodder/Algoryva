// Assembles the bot from validated configuration. Import this from your serverless entry points.
import { loadConfig } from "./config.js";
import { createSite } from "./site.js";
import { createBot } from "./bot.js";
import { createWebhookHandler } from "./webhook.js";
import { createDeliverHandler } from "./deliver.js";

export function createApp(env = process.env, { botInfo } = {}) {
  const config = loadConfig(env);
  const site = createSite({ base: config.base, secret: config.secret });
  const bot = createBot({ token: config.token, site, botInfo });
  return {
    webhook: createWebhookHandler({ bot, secretToken: config.webhookSecret }),
    deliver: createDeliverHandler({ bot, site, cronSecret: config.cronSecret }),
    bot,
    site,
  };
}
