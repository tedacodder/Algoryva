// Local mode for your laptop. Telegram cannot reach localhost, so instead of a webhook this polls for messages, and it sends the due
// community messages once a minute from the same process. Production uses src/webhook.js, not this file.
import { loadConfig } from "./config.js";
import { createSite } from "./site.js";
import { createBot } from "./bot.js";
import { deliverDue } from "./deliver.js";

const config = loadConfig(process.env);
const site = createSite({ base: config.base, secret: config.secret });
const bot = createBot({ token: config.token, site });

try {
  // A webhook and polling cannot both receive updates. Clear any webhook left by a deployment.
  await bot.api.deleteWebhook({ drop_pending_updates: false });
} catch (error) {
  console.error("cannot reach Telegram or the token was rejected:", error?.name ?? "unknown");
  process.exit(1);
}

const timer = setInterval(async () => {
  try {
    const counts = await deliverDue({ bot, site });
    if (counts.sent + counts.blocked + counts.failed > 0) console.log("delivered:", counts);
  } catch (error) {
    console.error("delivery round failed:", error?.name ?? "unknown");
  }
}, 60_000);

const stop = async () => {
  clearInterval(timer);
  await bot.stop();
  process.exit(0);
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

console.log("local mode: polling for messages, delivering due messages every minute. Press Ctrl+C to stop.");
await bot.start({ allowed_updates: ["message"], onStart: (info) => console.log(`bot @${info.username} is running`) });
