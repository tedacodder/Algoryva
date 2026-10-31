// Telegram HTML for the bot's own messages: quote blocks, spoilers, code, bold and italics. Every piece of user-facing text goes through esc().
export const EAT_ZONE = "Africa/Addis_Ababa"; // Ethiopia does not use daylight saving time, so this is exact.

export const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const DAY_EAT = new Intl.DateTimeFormat("en-GB", { timeZone: EAT_ZONE, weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DAY_UTC = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Local time first (Ethiopian time), for example "Sun 27 Oct, 17:35 EAT". */
export const localStamp = (seconds) => `${DAY_EAT.format(new Date(seconds * 1000))} EAT`;
export const utcStamp = (seconds) => `${DAY_UTC.format(new Date(seconds * 1000))} UTC`;
export const durationText = (seconds) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

/** Time until a start, for example "2h 25m", "3d 4h", or "already started". */
export function timeLeft(seconds, now = new Date()) {
  const diff = seconds * 1000 - now.getTime();
  if (diff <= 0) return "already started";
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

const badge = (rating) => (rating == null ? "⚪" : rating < 1000 ? "🟢" : rating < 1400 ? "🟡" : rating < 1800 ? "🟠" : rating < 2200 ? "🔴" : "🟣");

/** A problem as a quote, with its tags hidden behind a spoiler. */
export function problemHtml(problem, { header, personalized = false } = {}) {
  const tags = problem.tags?.length ? problem.tags.slice(0, 4).map((t) => `#${esc(t)}`).join(" ") : "#untagged";
  const lines = [
    `<b>${esc(header)}</b>`,
    `<blockquote>${badge(problem.rating)} <b>${esc(problem.name)}</b>`,
    `⭐ Rating <code>${problem.rating ?? "unrated"}</code>`,
    `🏷️ <tg-spoiler>${tags}</tg-spoiler> <i>tap to reveal</i>`,
    `🔗 ${esc(problem.url)}</blockquote>`,
  ];
  if (personalized) lines.push("<i>✅ Problems you have solved are skipped for you.</i>");
  return lines.join("\n");
}

/** Contests soonest first, each in its own quote with local time, UTC, the countdown and the official link. */
export function contestsHtml(contests, now = new Date()) {
  const sorted = [...contests].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  if (sorted.length === 0) return "📭 <b>No upcoming Codeforces contests</b> right now. Check back soon!";
  const blocks = sorted.map((c) =>
    [
      `<blockquote><b>🏆 ${esc(c.name)}</b>`,
      `🗓 ${localStamp(c.startTimeSeconds)} · <i>${utcStamp(c.startTimeSeconds)}</i>`,
      `⏳ Starts in <b>${timeLeft(c.startTimeSeconds, now)}</b> · ⏱ ${durationText(c.durationSeconds)}`,
      `🔗 ${esc(c.url)}</blockquote>`,
    ].join("\n"),
  );
  return [
    "📅 <b>Upcoming Codeforces contests</b>",
    "<i>soonest first · Ethiopian time first</i>",
    "",
    ...blocks,
    "",
    "<i>Registration happens on the official contest pages.</i>",
  ].join("\n");
}

/** The single next contest, with a warning inside the last two hours. */
export function nextContestHtml(contest, now = new Date()) {
  const soon = contest.startTimeSeconds * 1000 - now.getTime() <= 2 * 3600 * 1000;
  return [
    "⏰ <b>Next Codeforces contest</b>",
    `<blockquote><b>🏆 ${esc(contest.name)}</b>`,
    `🗓 ${localStamp(contest.startTimeSeconds)}`,
    `🌍 ${utcStamp(contest.startTimeSeconds)}`,
    `⏳ <b>${timeLeft(contest.startTimeSeconds, now)}</b> left · ⏱ ${durationText(contest.durationSeconds)}`,
    `🔗 ${esc(contest.url)}</blockquote>`,
    soon ? "🚨 <b>Less than two hours to go!</b>" : "",
    "<i>Register on the official page. I can't register you.</i>",
  ]
    .filter(Boolean)
    .join("\n");
}

const LIST_LIMIT = 40;
function names(list) {
  if (list.length === 0) return "<i>none</i>";
  const shown = list.slice(0, LIST_LIMIT).map((n) => `<code>${esc(n)}</code>`).join(", ");
  return list.length > LIST_LIMIT ? `${shown} … +${list.length - LIST_LIMIT} more` : shown;
}

/** The class report, with each group of students in its own quote. */
export function reportHtml(data) {
  const problem = data.problem
    ? `📌 ${esc(data.problem.name ?? "today's problem")} <code>${esc(data.problem.ref)}</code>`
    : "📌 none today yet. An admin can set one with /setdaily.";
  const roster = data.rosterCount ? `${data.registered}/${data.rosterCount} registered` : `${data.registered} registered`;
  const lines = [
    "📋 <b>Class report</b>",
    `<blockquote>${problem}\n👥 ${roster}</blockquote>`,
    data.usesConnectedFallback ? "<i>No roster set: showing students who ran /connect here.</i>" : "",
    `✅ <b>Solved (${data.solved.length})</b>`,
    `<blockquote>${names(data.solved)}</blockquote>`,
    `⏳ <b>Not solved yet (${data.unsolved.length})</b>`,
    `<blockquote>${names(data.unsolved)}</blockquote>`,
    `📝 <b>Not registered (${data.notRegistered.length})</b>`,
    `<blockquote>${names(data.notRegistered)}</blockquote>`,
  ];
  if (data.pending.length) {
    lines.push(`🔄 <b>Still being checked (${data.pending.length})</b>`, `<blockquote>${names(data.pending)}</blockquote>`, "Send /report again in a minute.");
  }
  lines.push("", "<i>Solved means an accepted submission on Codeforces at any time. Not registered: students send /connect &lt;handle&gt; to me in private.</i>");
  return lines.filter((l) => l !== "").join("\n");
}

export function meHtml(handles) {
  if (!handles?.length) return "👤 No handles connected yet. Use <code>/connect &lt;handle&gt;</code>.";
  const rows = handles.map((h) => `• <code>${esc(h.handle)}</code> · rating <b>${h.rating ?? "unrated"}</b> · ${h.solved} solved`);
  return ["👤 <b>Connected handles</b>", `<blockquote>${rows.join("\n")}</blockquote>`].join("\n");
}

export function helpHtml() {
  const commands = [
    ["/random", "a random problem"],
    ["/random 1400", "around rating 1400"],
    ["/random 1200-1600 dp graphs", "a band and tags"],
    ["/daily", "today's challenge"],
    ["/contests", "upcoming contests, soonest first"],
    ["/next", "the next contest, with time left"],
    ["/connect <handle>", "link your Codeforces handle"],
    ["/me", "your connected handles"],
    ["/disconnect [handle]", "unlink one handle, or all"],
    ["/notify daily|contests on|off", "choose what you receive"],
    ["/enable · /disable", "group admins only"],
    ["/roster set <handles>", "group admins: the class list"],
    ["/setdaily 1800C", "group admins: the group's problem"],
    ["/report", "the class report, in a group"],
    ["/stop", "stop all messages here"],
  ];
  return [
    "❓ <b>Commands</b>",
    `<blockquote>${commands.map(([c, d]) => `<code>${esc(c)}</code> — ${esc(d)}`).join("\n")}</blockquote>`,
    "<i>Tags use Codeforces names, with dashes for spaces: <code>dfs-and-similar</code>.</i>",
  ].join("\n");
}
