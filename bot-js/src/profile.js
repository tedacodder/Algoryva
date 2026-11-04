// The bot's public profile: the description shown before a user starts the bot, the short line shown in search and shares,
// and the "/" command menu. Set once with: npm run profile (it changes nothing on the website).
import { COMMANDS, SUPPORT_EMAIL } from "./commands.js";

export const DESCRIPTION = "🧠 Your Codeforces coach, in Telegram.\n\n🎲 Random problems by rating and tags\n📅 A new daily problem, every day\n🏆 Contest alerts: when posted, and 2 hours before\n✅ Problems you've solved are skipped once you connect your handle\n👥 For groups and classes: class list, class report and live leaderboard\n\nGet started: send /start\nNeed help: /help\nSupport: Algoryva@gmail.com";

export const SHORT_DESCRIPTION = "🧠 Daily Codeforces problems, contest alerts & class leaderboards. Send /start";

export function botCommands() {
  return COMMANDS.map((c) => ({ command: c.name, description: c.summary.slice(0, 256) }));
}

export async function applyProfile(api) {
  await api.setMyDescription({ description: DESCRIPTION });
  await api.setMyShortDescription({ short_description: SHORT_DESCRIPTION });
  await api.setMyCommands(botCommands());
  return { commands: botCommands().length };
}

/** The token, read from BOT_TOKEN only. The profile needs nothing else, so the other secrets are not required. */
export function readToken(env) {
  const token = (env.BOT_TOKEN ?? "").trim();
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) throw new Error("BOT_TOKEN is missing or not in the form 123456789:AA...");
  return token;
}

