import { createHash } from "node:crypto";
import { contestUrl, problemUrl, type CfContest, type CfProblem, type RandomFilter } from "@/lib/codeforces/pick";

/** Every message is plain text, so no formatting can break it. Wording is chosen at random from short lists, so repeats are rare. */
export type Rng = () => number;

export function choose<T>(items: readonly T[], rng: Rng = Math.random): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** A repeatable random sequence for a seed. Used for the daily message, so the same chat and day always read the same way. */
export function seededRng(seed: string): Rng {
  let i = 0;
  return () => {
    const digest = createHash("sha256").update(`${seed}|${i++}`).digest();
    return digest.readUInt32BE(0) / 0x100000000;
  };
}

export const utcStamp = (seconds: number) => `${new Date(seconds * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
/** Ethiopia does not use daylight saving time, so a fixed +3 offset is exact. */
export const eatStamp = (seconds: number) => `${new Date((seconds + 3 * 3600) * 1000).toISOString().slice(11, 16)} EAT`;
export const durationText = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

const DAILY_OPENERS = ["🧠 Brain teaser of the day", "🔥 Fresh from Codeforces", "⚡ Quick challenge for you", "🎯 Today's target", "🚀 Ready for this one?", "🧩 Puzzle time"];
const RANDOM_OPENERS = ["🎲 Random pick, no excuses", "🎰 Spin! Here is your problem", "🎲 Mystery problem unlocked", "🃏 Your card is…"];
const CLOSERS = [
  "Good luck, and share your idea in the chat 💬",
  "Check the edge cases before you code 🔍",
  "Solve it, then show off a little 😎",
  "No peeking at the editorial! 🙈",
  "Your future rating says thanks 📈",
  "Struggle now, smile later 🌱",
];

export function difficultyBadge(rating: number | undefined): string {
  if (rating === undefined) return "⚪";
  if (rating < 1000) return "🟢";
  if (rating < 1400) return "🟡";
  if (rating < 1800) return "🟠";
  if (rating < 2200) return "🔴";
  return "🟣";
}

const tagLine = (tags: string[]) => (tags.length ? tags.slice(0, 4).map((t) => `#${t}`).join(" ") : "#untagged");

export function formatDaily(p: CfProblem, day: string, opts: { group?: boolean; personalized?: boolean; rng?: Rng } = {}): string {
  const rng = opts.rng ?? Math.random;
  const head = opts.group ? "👥 Group challenge · " : "";
  const lines = [
    `${choose(DAILY_OPENERS, rng)} · ${head}${day} UTC`,
    "",
    `${difficultyBadge(p.rating)} ${p.name}`,
    `⭐ Rating ${p.rating ?? "unrated"}   🏷️ ${tagLine(p.tags)}`,
    `🔗 ${problemUrl(p)}`,
    "",
    choose(CLOSERS, rng),
  ];
  if (opts.personalized) lines.push("✅ Problems you have already solved are skipped for you.");
  return lines.join("\n");
}

export function describeFilter(f: RandomFilter): string {
  const band = f.minRating === f.maxRating ? `${f.minRating}` : `${f.minRating}–${f.maxRating}`;
  const tags = f.tags.length ? `   🏷️ ${f.tags.map((t) => `#${t}`).join(" ")}` : "";
  return `🎚️ Rating ${band}${tags}`;
}

export function formatRandom(p: CfProblem, filter: RandomFilter, opts: { personalized?: boolean; rng?: Rng } = {}): string {
  const rng = opts.rng ?? Math.random;
  const lines = [
    choose(RANDOM_OPENERS, rng),
    "",
    `${difficultyBadge(p.rating)} ${p.name}`,
    `⭐ Rating ${p.rating ?? "unrated"}   🏷️ ${tagLine(p.tags)}`,
    `🔗 ${problemUrl(p)}`,
    "",
    describeFilter(filter),
    choose(CLOSERS, rng),
  ];
  if (opts.personalized) lines.push("✅ Problems you have already solved are skipped for you.");
  return lines.join("\n");
}

const POSTED_OPENERS = ["🆕 A new Codeforces contest just got posted!", "📣 Heads up, a new contest is up!", "🆕 Fresh contest on the board!"];
const TWO_HOUR_OPENERS = ["⏰ Two hours left!", "⏳ Contest starts in 2 hours!", "🔔 Final call: 2 hours to go!"];

export function formatContestPosted(c: CfContest): string {
  return [
    choose(POSTED_OPENERS),
    `🏆 ${c.name}`,
    `🗓️ Starts ${utcStamp(c.startTimeSeconds)} · ${eatStamp(c.startTimeSeconds)}`,
    `⏱️ Length ${durationText(c.durationSeconds)}`,
    `🔗 Official page (register there): ${contestUrl(c.id)}`,
    "I cannot register you, so sign up on the official page before it starts ✅",
  ].join("\n");
}

export function formatContestTwoHours(c: CfContest): string {
  return [
    choose(TWO_HOUR_OPENERS),
    `🏆 ${c.name}`,
    `🗓️ Starts ${utcStamp(c.startTimeSeconds)} · ${eatStamp(c.startTimeSeconds)}`,
    `🔗 Register on the official page now: ${contestUrl(c.id)}`,
    "Registration happens on Codeforces, not here 🙌",
  ].join("\n");
}

export function formatContestList(contests: CfContest[]): string {
  if (contests.length === 0) return "📭 No upcoming Codeforces contests right now. Check back soon!";
  const lines = contests.map((c) => `🏆 ${c.name}\n   🗓️ ${utcStamp(c.startTimeSeconds)} · ${eatStamp(c.startTimeSeconds)}\n   🔗 ${contestUrl(c.id)}`);
  return ["📅 Upcoming Codeforces contests", "", ...lines.flatMap((l, i) => (i === 0 ? [l] : ["", l])), "", "Registration is on the official pages above ✅"].join("\n");
}
