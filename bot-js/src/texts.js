// Commands' inputs and replies. Pure functions, so they can be tested without Telegram.
export const HANDLE_RE = /^[A-Za-z0-9_.-]{3,24}$/;
const TAG_RE = /^[a-z][a-z0-9-]{1,29}$/;
const BAND_RE = /^(\d{3,4})-(\d{3,4})$/;
const RATING_RE = /^\d{3,4}$/;
export const MAX_TAGS = 5;

export const KEYBOARD_BUTTONS = {
  "🎲 Random": "random",
  "📅 Daily": "daily",
  "🏆 Contests": "contests",
  "⏰ Next Contest": "next",
  "🔗 Connect": "connect",
  "👤 My Handles": "me",
  "⚙️ Settings": "settings",
  "👥 Groups": "groups",
  "❓ Help": "help",
};

export const WELCOME =
  "👋 Hey {name}! I'm your Codeforces coach.\n\n🎲 Random problems with the rating and tags you choose\n📅 A daily challenge, every day\n🏆 Contest alerts: when a contest is posted, and two hours before it starts\n✅ Connect your handle and I skip what you have already solved\n\nTap a button below to start.";

export const HELP_TEXT =
  "❓ Commands\n\n🎲 /random - a random problem\n    /random 1400 - around rating 1400 (±100)\n    /random 1200-1600 dp graphs - a band and tags\n📅 /daily - today's challenge\n🏆 /contests - upcoming contests, soonest first\n⏰ /next - the next contest, with time left\n🔗 /connect <handle> - link your Codeforces handle\n👤 /me - your connected handles\n🧾 /disconnect [handle] - unlink one handle, or all\n⚙️ /notify daily|contests on|off - choose what you receive\n👥 /enable and /disable - group admins only\n🛑 /stop - stop all messages in this chat\n\nTags use Codeforces names, with dashes for spaces: dfs-and-similar.";

export const NOT_ADMIN = "🔒 Only a group admin can change this.";
export const NO_MATCH = "🤷 No problem matches those filters. Try a wider rating band or fewer tags.";
export const ALL_SOLVED = "🏁 You have solved every problem that matches. Try another band or tag.";
export const GENERIC = "😕 Something went wrong on my side. Try again in a moment.";

const ERRORS = {
  handle_not_found: "🤔 I can't find a Codeforces user with that handle. Check the spelling.",
  group_not_enabled: "👥 A group admin needs to send /enable first, then you can connect your handle here.",
  too_many_handles: "🧾 A chat can connect up to 5 handles. Use /disconnect <handle> to free a slot.",
  cf_unavailable: "🌧️ Codeforces is not answering right now. Try again in a few minutes.",
  rate_limited: "⏳ Too many requests. Give it a few minutes.",
  not_subscribed: "📭 This chat is not subscribed yet. Send /start, or /enable in a group.",
  bot_api_disabled: "🛠️ The bot is not set up yet. Try again later.",
  bot_api_misconfigured: "🛠️ The bot is not set up yet. Try again later.",
};

export const errorText = (code) => ERRORS[code] ?? GENERIC;

export function parseHandle(arg) {
  const value = (arg ?? "").trim().replace(/^@/, "");
  return HANDLE_RE.test(value) ? value : null;
}

/** '/random 1200-1600 dp graphs' -> { minRating, maxRating, tags }. Throws an Error whose message a user can act on. */
export function parseRandom(args) {
  let band = null;
  const tags = [];
  for (const token of (args ?? "").split(/\s+/).filter(Boolean)) {
    const range = token.match(BAND_RE);
    if (range) {
      const low = Number(range[1]);
      const high = Number(range[2]);
      if (low > high) throw new Error("The first rating in a band must not be above the second.");
      band = [low, high];
    } else if (RATING_RE.test(token)) {
      const target = Number(token);
      band = [target - 100, target + 100];
    } else {
      const tag = token.toLowerCase();
      if (!TAG_RE.test(tag)) throw new Error(`'${token}' is not a valid tag. Use letters, digits and dashes, like dp or dfs-and-similar.`);
      tags.push(tag);
    }
  }
  if (tags.length > MAX_TAGS) throw new Error(`Use at most ${MAX_TAGS} tags.`);
  const [minRating, maxRating] = band ?? [800, 2000];
  return { minRating, maxRating, tags };
}

/** '/notify daily on' -> ['daily', true]. Returns null for anything else. */
export function parseNotify(args) {
  const parts = (args ?? "").trim().split(/\s+/);
  if (parts.length !== 2 || !["daily", "contests"].includes(parts[0]) || !["on", "off"].includes(parts[1])) return null;
  return [parts[0], parts[1] === "on"];
}

export const GROUP_GUIDE =
  "👥 Groups\n\nAn admin sends /enable to get the daily problem and contest alerts here.\nMembers connect their own handle with /connect <handle>, and I skip problems any of them solved.\n\n📋 Classroom: /roster set <handles> (admins), /setdaily <problem> (admins), /report (anyone).\n/disable turns it all off.";

export const SETTINGS_GUIDE =
  "⚙️ Settings\n\n/notify daily on|off - the daily problem\n/notify contests on|off - contest alerts\n/stop - stop everything in this chat";

/** '/roster set h1 h2, h3' -> { action, handles }. Handles may be separated by spaces or commas. */
export function parseRoster(args) {
  const [action = "list", ...rest] = (args ?? "").trim().split(/\s+/).filter(Boolean);
  const allowed = ["set", "add", "remove", "list", "clear"];
  if (!allowed.includes(action.toLowerCase())) throw new Error("Use: /roster set|add|remove|list|clear, then handles.");
  const handles = rest.join(" ").split(/[\s,]+/).map((h) => h.replace(/^@/, "")).filter(Boolean);
  if (handles.some((h) => !HANDLE_RE.test(h))) throw new Error("One of those is not a valid handle. Handles are 3 to 24 letters, numbers, dots, dashes or underscores.");
  return { action: action.toLowerCase(), handles };
}

/** '/setdaily 1800C', '/setdaily 1800/C', a Codeforces problem link, or 'reset'. Returns { problem: '1800/C' } or { problem: null }. */
export function parseSetDaily(args) {
  const value = (args ?? "").trim();
  if (value.toLowerCase() === "reset") return { problem: null };
  const fromLink = value.match(/problemset\/problem\/(\d{1,5})\/([A-Za-z][0-9]?)/) ?? value.match(/contest\/(\d{1,5})\/problem\/([A-Za-z][0-9]?)/);
  const compact = value.match(/^(\d{1,5})\s*\/?\s*([A-Za-z][0-9]?)$/);
  const match = fromLink ?? compact;
  if (!match) throw new Error("Use: /setdaily 1800C, /setdaily 1800/C, a Codeforces problem link, or /setdaily reset.");
  return { problem: `${match[1]}/${match[2].toUpperCase()}` };
}

const LIST_LIMIT = 40;
function names(list) {
  if (list.length === 0) return "none";
  const shown = list.slice(0, LIST_LIMIT).join(", ");
  return list.length > LIST_LIMIT ? `${shown} … and ${list.length - LIST_LIMIT} more` : shown;
}

/** The class report as a message. The data comes from the website's group-report route. */
export function formatReport(data) {
  const problemLine = data.problem
    ? `📌 Problem: ${data.problem.name ?? "today's problem"} (${data.problem.ref})`
    : "📌 Problem: none today yet. An admin can set one with /setdaily.";
  const roster = data.rosterCount ? `${data.registered}/${data.rosterCount} registered` : `${data.registered} registered`;
  const lines = [
    "📋 Class report",
    "",
    problemLine,
    `👥 ${roster}${data.usesConnectedFallback ? " (no roster set: showing students who ran /connect here)" : ""}`,
    "",
    `✅ Solved (${data.solved.length}): ${names(data.solved)}`,
    `⏳ Not solved yet (${data.unsolved.length}): ${names(data.unsolved)}`,
    `📝 Not registered (${data.notRegistered.length}): ${names(data.notRegistered)}`,
  ];
  if (data.pending.length) lines.push(`🔄 Still being checked (${data.pending.length}): ${names(data.pending)}. Send /report again in a minute.`);
  lines.push("", "Solved means the handle has an accepted submission for this problem on Codeforces (any time).");
  if (data.notRegistered.length) lines.push("Not registered: each student sends /connect <handle> to me in a private chat.");
  return lines.join("\n");
}
