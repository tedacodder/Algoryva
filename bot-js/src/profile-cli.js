// Run once after a change to the commands or the description: npm run profile
// Needs only BOT_TOKEN in the environment (for example: set -a; . ~/algoryva-prod-bot.env; set +a).
import { Bot } from "grammy";
import { applyProfile, readToken } from "./profile.js";

const bot = new Bot(readToken(process.env));
const result = await applyProfile(bot.api);
console.log(`profile updated: ${result.commands} commands, description and short description set.`);
