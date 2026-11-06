import { COMMANDS, SECTIONS, SUPPORT_EMAIL } from "./commands.js";

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
  const rows = handles.map((h) =>
    h.pending
      ? `• <code>${esc(h.handle)}</code> · <i>checking, try again shortly</i>`
      : `• <code>${esc(h.handle)}</code> · rating <b>${h.rating ?? "unrated"}</b> · ${h.solved} solved`,
  );
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

/** The card for one command: usage, what it does, examples, and its subcommands. */
export function commandCardHtml(cmd) {
  const lines = [`📖 <b>/${esc(cmd.name)}</b>`, `<blockquote>${esc(cmd.summary)}</blockquote>`, `<b>Usage</b>`, `<code>${esc(cmd.usage)}</code>`];
  if (cmd.where === "group") lines.push("<i>Works in a group chat.</i>");
  if (cmd.admin === true) lines.push("<i>Group admins only.</i>");
  if (cmd.subcommands) {
    lines.push("", "<b>Subcommands</b>");
    for (const sub of cmd.subcommands) lines.push(`<code>${esc(sub.usage)}</code>${sub.admin ? " 🔒" : ""}\n   ${esc(sub.summary)}`);
    lines.push("<i>🔒 needs a group admin</i>");
  }
  if (cmd.examples?.length && !cmd.subcommands) lines.push("", "<b>Examples</b>", `<pre>${cmd.examples.map(esc).join("\n")}</pre>`);
  return lines.join("\n");
}

/** The overview: every section, with its commands and a one-line summary of each. */
export function helpIndexHtml() {
  const blocks = SECTIONS.map((section) => {
    const items = COMMANDS.filter((c) => c.section === section.id).map((c) => `<code>/${esc(c.name)}</code> ${esc(c.summary)}`);
    return [`<b>${esc(section.title)}</b>`, `<i>${esc(section.blurb)}</i>`, `<blockquote>${items.join("\n")}</blockquote>`].join("\n");
  });
  return [
    "❓ <b>Help</b>",
    "<i>Send /help followed by a command name for its details, for example /help roster.</i>",
    "",
    ...blocks,
    "",
    `💬 <b>Support</b>: <code>${esc(SUPPORT_EMAIL)}</code>`,
  ].join("\n");
}

const PERIOD_LABEL = { week: "this week (7 days)", month: "this month (30 days)", all: "all time" };
export const periodLabel = (period) => PERIOD_LABEL[period] ?? PERIOD_LABEL.week;

export function progressBar(done, total) {
  const cells = 10;
  const filled = total > 0 ? Math.round((done / total) * cells) : 0;
  return "▰".repeat(filled) + "▱".repeat(cells - filled);
}

export function leaderboardCheckingHtml(period) {
  return [`📊 <b>Group leaderboard · ${esc(periodLabel(period))}</b>`, "<blockquote>⏳ Checking Codeforces for the group's members…</blockquote>", "<i>This takes about 30 seconds.</i>"].join("\n");
}

const MEDALS = ["🥇", "🥈", "🥉"];
const cell = (value, width) => String(value).padEnd(width).slice(0, width);
const NAME_WIDTH = 14;

/** The ranking, one member per two short lines, so it reads well on a phone. Points and day counts are not shown. */
export function leaderboardHtml(data) {
  const lines = [`📊 <b>Group leaderboard · ${esc(periodLabel(data.period))}</b>`];
  if (data.rows.length === 0) {
    lines.push("<blockquote>No verified solves in this period yet. Solve something and check again.</blockquote>");
  } else {
    const rows = data.rows.map((r) => {
      const place = MEDALS[r.rank - 1] ?? `${r.rank}.`;
      const rating = r.rating == null ? "unrated" : String(r.rating);
      return `${place} <b>${esc(r.handle)}</b> — ${esc(rating)}\n      ${r.solved} solved · ${r.consistency}% consistent`;
    });
    lines.push(`<blockquote>${rows.join("\n")}</blockquote>`);
  }
  if (data.pending.length) {
    lines.push(`🔄 <b>Still being checked (${data.pending.length})</b>: ${data.pending.map((h) => `<code>${esc(h)}</code>`).join(", ")}`);
    lines.push("<i>Press 🔄 Refresh to check the next group of students.</i>");
  }
  if (data.notRegistered.length) {
    lines.push(`📝 <b>Not registered (${data.notRegistered.length})</b>: ${data.notRegistered.slice(0, 30).map((h) => `<code>${esc(h)}</code>`).join(", ")}`);
  }
  if (data.checking > 0) lines.push(`⏳ <b>${data.checking} student${data.checking === 1 ? " is" : "s are"} still being verified</b>. They join the table automatically.`);
  lines.push("", "<i>Ranked by points: problems solved, plus consistency (days with a solve ÷ days in the period). Ties go to rating.</i>");
  lines.push(`<i>Updated ${esc(new Date(data.checkedAt).toISOString().slice(11, 19))} UTC · ${data.registered}/${data.rosterCount} registered</i>`);
  return lines.join("\n");
}

/** The result of a roster change: who was registered, who is not a Codeforces account, and who still needs checking. */
export function rosterResultHtml(action, data) {
  const names = (list) => list.map((h) => `<code>${esc(h)}</code>`).join(", ");
  const count = `${data.count} student${data.count === 1 ? "" : "s"}`;
  const lines = [`📋 <b>Class list</b> · ${count}`];
  if (action === "list") {
    lines.push(data.handles.length ? `<blockquote>${names(data.handles)}</blockquote>` : "<blockquote>The list is empty. Add students with /roster add.</blockquote>");
    return lines.join("\n");
  }
  if (action === "remove" || action === "clear") lines.push("🗑 <b>Updated.</b>");
  if (data.added?.length) lines.push(`✅ <b>Registered (${data.added.length})</b>`, `<blockquote>${names(data.added)}</blockquote>`);
  if (data.invalid?.length) lines.push(`❌ <b>Not a Codeforces account (${data.invalid.length})</b>`, `<blockquote>${names(data.invalid)}</blockquote>`, "<i>Check the spelling, then send them again.</i>");
  if (data.unchecked?.length) lines.push(`⏳ <b>Queued for checking (${data.unchecked.length})</b>`, `<blockquote>${names(data.unchecked)}</blockquote>`);
  if (data.checking > 0) lines.push(`⏳ <b>Checking on Codeforces: ${data.checking}.</b> A background check finishes these within a few minutes. /roster list shows the progress.`);
  return lines.join("\n");
}

export function supportHtml() {
  return [
    "💬 <b>Support</b>",
    `<blockquote>Email: <code>${esc(SUPPORT_EMAIL)}</code>\nInclude the command you sent and what the bot replied, so we can help quickly.</blockquote>`,
  ].join("\n");
}

/** One line of advice for a member, from what they did. Simple rules, so it is predictable and free to run. */
export function motivationFor(m) {
  if (m.pending) return "⏳ Rating still loading. Press again in a minute.";
  if (m.ratingChange != null && m.ratingChange > 0) return "🚀 Rating up. Your practice is paying off. Keep the streak going.";
  if (m.solved === 0) return "🌱 No solves this time. Pick one problem you skipped and upsolve it tomorrow. One calm problem a day beats a panic.";
  if (m.ratingChange != null && m.ratingChange < 0) return "💪 A tough round happens to everyone. Review the problems you did not finish: that is where the growth is.";
  if (m.rank <= 3) return "🏅 A podium finish. Share your approach with the group.";
  return "🔥 Solid effort. Consistency is the secret: keep practicing a little every day.";
}

export function ratingHtml(p) {
  const best = p.maxRating ? ` · best ${p.maxRating}` : "";
  const rank = `${esc(p.rank ?? "unranked")}${p.maxRank ? ` (best: ${esc(p.maxRank)})` : ""}`;
  return [
    `⭐ <b>${esc(p.handle)}</b>`,
    `<blockquote>Rating <b>${p.rating ?? "unrated"}</b>${best}\nRank: ${rank}\nRated contests: ${p.contests ?? "unknown"}</blockquote>`,
    "<i>Ratings update after each rated contest.</i>",
  ].join("\n");
}

const LIVE = "🔴 <b>LIVE</b>. Press 🔄 Refresh for the latest standings.";

/** The top of the field and this chat's members. Live while the contest runs, final afterwards. */
// Telegram rejects a message longer than 4096 characters, so long output is split at this safe size.
const SAFE_LIMIT = 3800;

/** Packs whole blocks into pages that each fit one Telegram message. A block is never split in the middle. */
export function pageLines(blocks, limit = SAFE_LIMIT) {
  const pages = [];
  let current = [];
  let size = 0;
  for (const block of blocks) {
    const add = block.length + 1;
    if (size + add > limit && current.length) {
      pages.push(current.join("\n"));
      current = [];
      size = 0;
    }
    current.push(block);
    size += add;
  }
  if (current.length) pages.push(current.join("\n"));
  return pages.length ? pages : [""];
}

/** The ranking for one message. The class list is shortened only when it would not fit, and says how many are hidden. */
export function ranklistHtml(data) {
  const status = data.contest.phase === "CODING" ? LIVE : data.contest.phase === "FINISHED" ? "✅ <b>Final results</b>" : `<i>${esc(data.contest.phase || "Upcoming")}</i>`;
  const head = [`🏁 <b>${esc(data.contest.name)}</b>`, status];
  if (data.top.length) {
    const top = data.top.map((r) => `${MEDALS[r.rank - 1] ?? `${r.rank}.`} ${esc(r.handle)} — ${r.points} pts · ${r.solved} solved`);
    head.push("<b>Top 10</b>", `<blockquote>${top.join("\n")}</blockquote>`);
  }
  const foot = [];
  if (data.missing.length) foot.push(`<i>Not in the official standings: ${data.missing.slice(0, 30).map((h) => esc(h)).join(", ")}. Virtual or unofficial participation is not counted here.</i>`);
  foot.push(`<i>Updated ${esc(new Date(data.checkedAt).toISOString().slice(11, 19))} UTC</i>`);
  const used = [...head, ...foot].join("\n").length + 300;
  const rows = [];
  let room = SAFE_LIMIT - used;
  for (const r of data.members) {
    const line = `#${r.rank} ${esc(r.handle)} — ${r.solved} solved · ${r.points} pts`;
    if (line.length + 1 > room) break;
    rows.push(line);
    room -= line.length + 1;
  }
  const hidden = data.members.length - rows.length;
  const mine = [];
  if (data.members.length) {
    mine.push("<b>Your class</b>", `<blockquote>${rows.join("\n")}${hidden ? `\n… and ${hidden} more` : ""}</blockquote>`);
  }
  return [...head, ...mine, ...foot].join("\n");
}

/** After a contest: one quote per member, split into pages that each fit one Telegram message. */
export function summaryPages(data) {
  const final = data.contest.phase === "FINISHED";
  const blocks = [`📝 <b>Contest summary</b> · ${esc(data.contest.name)}`, final ? "✅ <i>Final results</i>" : "🔴 <i>Still running: numbers may change</i>"];
  for (const m of data.members) {
    const change = m.pending ? "rating pending" : m.ratingChange == null ? "no rating change" : `rating ${m.ratingChange > 0 ? "+" : ""}${m.ratingChange}`;
    blocks.push(`<blockquote>#${m.rank} <b>${esc(m.handle)}</b> · ${m.solved} solved · ${m.points} pts\n📈 ${change}\n${motivationFor(m)}</blockquote>`);
  }
  if (data.missing.length) blocks.push(`<i>Not in the official standings: ${data.missing.slice(0, 30).map((h) => esc(h)).join(", ")}. Virtual or unofficial participation is not counted here.</i>`);
  return pageLines(blocks);
}

export function summaryHtml(data) {
  return summaryPages(data).join("\n");
}

/** What Codeforces returned for one handle, read by the server: official standings, and with unofficial ones included. */
export function cfcheckHtml(contestId, handle, data) {
  const line = (label, probe) => {
    if (probe.status !== "OK") return `${label}: Codeforces returned an error${probe.comment ? ` (${esc(probe.comment)})` : ""}`;
    const row = probe.rows.find((r) => r.handle.toLowerCase() === handle.toLowerCase());
    return row ? `${label}: rank <b>${row.rank}</b> (${esc(row.type || "official")})` : `${label}: not listed`;
  };
  return [
    "🔎 <b>Codeforces check</b>",
    `<blockquote>Contest <code>${contestId}</code> · handle <code>${esc(handle)}</code></blockquote>`,
    line("Official standings", data.official),
    line("Including unofficial", data.unofficial),
    "<i>This asks Codeforces directly, now, with no cache.</i>",
  ].join("\n");
}

