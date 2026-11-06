// The bot's public profile: the description shown before a user starts the bot, the short line shown in search and shares,
// and the "/" command menu. Set once with: npm run profile (it changes nothing on the website).
import { COMMANDS, MENU_TEXT, SUPPORT_EMAIL } from "./commands.js";

export const DESCRIPTION = "🧠 Your Codeforces coach, in Telegram.\n\n🎲 Random problems by rating and tags\n📅 A new daily problem, every day\n🏆 Contest alerts: when posted, and 2 hours before\n✅ Problems you've solved are skipped once you connect your handle\n👥 For groups and classes: class list, class report and live leaderboard\n\nGet started: send /start\nNeed help: /help\nSupport: Algoryva@gmail.com";

export const SHORT_DESCRIPTION = "🧠 Daily Codeforces problems, contest alerts & class leaderboards. Send /start";

// What a private chat shows under the ☰ menu button, and what a group shows when someone types "/".
const PRIVATE_MENU = ["start", "random", "daily", "contests", "next", "rating", "ranklist", "summary", "connect", "me", "disconnect", "notify", "stop", "support", "help"];
const GROUP_MENU = ["random", "daily", "contests", "next", "ranklist", "summary", "leaderboard", "report", "roster", "setdaily", "enable", "disable", "help", "support"];

function menuFor(names) {
  return names.filter((n) => COMMANDS.some((c) => c.name === n) && MENU_TEXT[n]).map((n) => ({ command: n, description: MENU_TEXT[n] }));
}

export const privateMenu = () => menuFor(PRIVATE_MENU);
export const groupMenu = () => menuFor(GROUP_MENU);
export const botCommands = privateMenu;

export async function applyProfile(api) {
  // About and Description are not set here: they are written in BotFather and must not be overwritten.
  await api.setMyCommands(privateMenu()); // default: used wherever no scope is set
  await api.setMyCommands(privateMenu(), { scope: { type: "all_private_chats" } });
  await api.setMyCommands(groupMenu(), { scope: { type: "all_group_chats" } });
  await api.setChatMenuButton({ menu_button: { type: "commands" } }); // the ☰ button shows the command list
  return { privateCommands: privateMenu().length, groupCommands: groupMenu().length };
}

/** The token, read from BOT_TOKEN only. The profile needs nothing else, so the other secrets are not required. */
export function readToken(env) {
  const token = (env.BOT_TOKEN ?? "").trim();
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) throw new Error("BOT_TOKEN is missing or not in the form 123456789:AA...");
  return token;
}

