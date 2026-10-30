// Settings from environment variables. Errors name the variable, never its value.
const TOKEN_RE = /^[0-9]{5,}:[A-Za-z0-9_-]{30,}$/;
const WEBHOOK_SECRET_RE = /^[A-Za-z0-9_-]{16,256}$/;

function parseBase(raw) {
  let url;
  try {
    url = new URL(raw ?? "");
  } catch {
    throw new Error("ALGORYVA_API_BASE must be a URL");
  }
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error("ALGORYVA_API_BASE must be https (http is allowed for localhost only)");
  if (url.pathname !== "/" || url.search || url.hash) throw new Error("ALGORYVA_API_BASE must be an origin with no path");
  return url.origin;
}

export function loadConfig(env = process.env) {
  if (!TOKEN_RE.test(env.BOT_TOKEN ?? "")) throw new Error("BOT_TOKEN is missing or not in the BotFather format");
  if ((env.TELEGRAM_BOT_API_SECRET ?? "").length < 32) throw new Error("TELEGRAM_BOT_API_SECRET is missing or shorter than 32 characters");
  if (!WEBHOOK_SECRET_RE.test(env.TELEGRAM_WEBHOOK_SECRET ?? "")) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET must be 16 to 256 letters, digits, dashes or underscores");
  }
  if ((env.CRON_SECRET ?? "").length < 32) throw new Error("CRON_SECRET is missing or shorter than 32 characters");
  return Object.freeze({
    token: env.BOT_TOKEN,
    secret: env.TELEGRAM_BOT_API_SECRET,
    base: parseBase(env.ALGORYVA_API_BASE),
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    cronSecret: env.CRON_SECRET,
  });
}
