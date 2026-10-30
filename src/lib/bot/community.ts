import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { hashTelegramId } from "@/lib/telegram/bot-auth";
import { decryptChatId, encryptChatId } from "@/lib/telegram/chat-cipher";
import { CodeforcesError, problemset, upcomingContests, userInfo, userSolved } from "@/lib/codeforces/client";
import {
  RANDOM_DEFAULT,
  contestsStartingWithin,
  newlyPosted,
  pickDailyProblem,
  pickRandomProblem,
  problemRef,
  type CfContest,
  type CfProblem,
  type RandomFilter,
} from "@/lib/codeforces/pick";
import { formatContestList, formatContestPosted, formatContestTwoHours, formatDaily, formatRandom, seededRng } from "@/lib/codeforces/format";
import { utcDay } from "@/lib/bot/daily";
import { customRefFor } from "@/lib/bot/classroom";
import { awardPreviousWeek } from "@/lib/bot/rewards";

/**
 * Chats (private or group) receive a daily Codeforces problem, two contest notices (when a contest is first posted, and two hours
 * before it starts), and can connect Codeforces handles. Problems that a chat's connected handles have solved are not sent to that chat.
 * Each message is one NotificationDelivery row, unique per chat, kind and key, so nothing is sent twice.
 */
export const MAX_ATTEMPTS = 3;
export const MAX_HANDLES = 5;
const RETRY_AFTER_MS = 5 * 60_000;
const RECENT_DAYS = 14;
const DAILY_BATCH = 500;
const CONTEST_BATCH = 5000;
const SEEN_CONTESTS_KEY = "cf-contests-seen";

export type DueItem = { deliveryId: string; chatId: string; text: string };
export type Outcome = "sent" | "blocked" | "failed";

const chatHash = (secret: string, chatId: string) => hashTelegramId(secret, chatId);
const isUnique = (e: unknown) => typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

async function findChat(secret: string, chatId: string) {
  return db.telegramRecipient.findUnique({ where: { chatHash: chatHash(secret, chatId) }, select: { id: true, kind: true } });
}

async function handlesOf(recipientId: string): Promise<string[]> {
  const rows = await db.cfHandle.findMany({ where: { recipientId }, select: { handle: true } });
  return rows.map((r) => r.handle);
}

/** Problems solved by any of the given handles. Unknown lists (Codeforces unreachable) are skipped, and the message says nothing was checked. */
async function solvedBy(handles: string[], now: Date): Promise<Set<string>> {
  const solved = new Set<string>();
  for (const h of handles) {
    const refs = await userSolved(h, now);
    for (const r of refs ?? []) solved.add(r);
  }
  return solved;
}

/** Ref for a chat's own recent problems, so the same problem does not come back within two weeks. */
async function recentRefs(recipientId: string, now: Date): Promise<Set<string>> {
  const since = utcDay(new Date(now.getTime() - RECENT_DAYS * 86_400_000));
  const rows = await db.notificationDelivery.findMany({ where: { recipientId, kind: "daily_cf", key: { gte: since } }, select: { ref: true } });
  return new Set(rows.map((r) => r.ref).filter((r): r is string => typeof r === "string"));
}

/** Ref for the message text: the same chat and day always show the same wording. */
const wordingSeed = (hash: string, day: string) => `${hash}|${day}`;

function renderDaily(problems: CfProblem[], ref: string, day: string, kind: string, hash: string, personalized: boolean): string {
  const p = problems.find((x) => problemRef(x) === ref);
  if (!p) return `🧠 Today's Codeforces problem (${day} UTC): https://codeforces.com/problemset/problem/${ref}`;
  return formatDaily(p, day, { group: kind === "group", personalized, rng: seededRng(wordingSeed(hash, day)) });
}

/** Records a private chat that started the bot. Returns created: false when the chat was already known. */
export async function registerPrivate(secret: string, key: Buffer, chatId: string): Promise<{ created: boolean }> {
  const hash = chatHash(secret, chatId);
  const known = await db.telegramRecipient.findUnique({ where: { chatHash: hash }, select: { id: true } });
  if (known) {
    await db.telegramRecipient.update({ where: { chatHash: hash }, data: { blocked: false, kind: "private" } });
    return { created: false };
  }
  // If this chat is already linked to an Algoryva account, attach the subscription to it, so account-based rewards still reach the chat.
  const link = await db.telegramLink.findUnique({ where: { telegramHash: hash }, select: { userId: true } });
  try {
    await db.telegramRecipient.create({ data: { chatHash: hash, chatCipher: encryptChatId(key, chatId), kind: "private", userId: link?.userId ?? null } });
  } catch (e) {
    if (isUnique(e)) return { created: false };
    throw e;
  }
  return { created: true };
}

/** Turns a group on or off. Callers must have verified that the requester is a group admin. Turning off removes the group and its handles. */
export async function setGroup(secret: string, key: Buffer, chatId: string, enable: boolean): Promise<{ enabled: boolean }> {
  const hash = chatHash(secret, chatId);
  if (!enable) {
    await db.telegramRecipient.deleteMany({ where: { chatHash: hash, kind: "group" } });
    return { enabled: false };
  }
  await db.telegramRecipient.upsert({
    where: { chatHash: hash },
    create: { chatHash: hash, chatCipher: encryptChatId(key, chatId), kind: "group" },
    update: { blocked: false, kind: "group" },
  });
  return { enabled: true };
}

export async function updateSettings(secret: string, chatId: string, patch: { dailyCf?: boolean; contestAlerts?: boolean }): Promise<boolean> {
  const r = await db.telegramRecipient.updateMany({ where: { chatHash: chatHash(secret, chatId) }, data: patch });
  return r.count === 1;
}

export async function stopChat(secret: string, chatId: string): Promise<boolean> {
  const r = await db.telegramRecipient.deleteMany({ where: { chatHash: chatHash(secret, chatId) } });
  return r.count > 0;
}

/** Today's problem for a chat, on demand (for /daily). Keeps a stored delivery if one exists, so the answer matches the scheduled message. */
export async function dailyText(secret: string, chatId: string, now: Date): Promise<string | null> {
  const day = utcDay(now);
  const problems = await problemset(now);
  if (!problems) return null;
  const hash = chatHash(secret, chatId);
  const recipient = await findChat(secret, chatId);
  // A group's own problem (set by an admin) replaces the default, from the moment it is set.
  const custom = recipient?.kind === "group" ? await customRefFor(recipient.id) : null;
  if (custom) return renderDaily(problems, custom, day, "group", hash, false);
  if (recipient) {
    const stored = await db.notificationDelivery.findUnique({
      where: { recipientId_kind_key: { recipientId: recipient.id, kind: "daily_cf", key: day } },
      select: { ref: true },
    });
    if (stored?.ref) return renderDaily(problems, stored.ref, day, recipient.kind, hash, true);
  }
  const handles = recipient ? await handlesOf(recipient.id) : [];
  const exclude = new Set<string>([...(recipient ? await recentRefs(recipient.id, now) : []), ...(await solvedBy(handles, now))]);
  const pick = pickDailyProblem(problems, wordingSeed(hash, day), exclude);
  if (!pick) return null;
  if (recipient) {
    await db.notificationDelivery.createMany({
      data: [{ recipientId: recipient.id, kind: "daily_cf", key: day, ref: problemRef(pick), status: "sent", sentAt: now }],
      skipDuplicates: true,
    });
    const saved = await db.notificationDelivery.findUnique({
      where: { recipientId_kind_key: { recipientId: recipient.id, kind: "daily_cf", key: day } },
      select: { ref: true },
    });
    return renderDaily(problems, saved?.ref ?? problemRef(pick), day, recipient.kind, hash, handles.length > 0);
  }
  return formatDaily(pick, day, { rng: seededRng(wordingSeed(hash, day)) });
}

/** A random problem for a chat, with an optional rating band and tags. The default band is 800 to 2000. */
export async function randomProblem(
  secret: string,
  chatId: string,
  filter: RandomFilter = RANDOM_DEFAULT,
  now: Date,
): Promise<{ text: string } | { reason: "cf_unavailable" | "no_match" | "all_solved" }> {
  const problems = await problemset(now);
  if (!problems) return { reason: "cf_unavailable" };
  const recipient = await findChat(secret, chatId);
  const handles = recipient ? await handlesOf(recipient.id) : [];
  const solved = await solvedBy(handles, now);
  const pick = pickRandomProblem(problems, filter, solved);
  if (!pick) {
    const anyMatch = pickRandomProblem(problems, filter, new Set());
    return { reason: anyMatch ? "all_solved" : "no_match" };
  }
  return { text: formatRandom(pick, filter, { personalized: handles.length > 0 }) };
}

export async function contestsText(now: Date): Promise<string> {
  const contests = await upcomingContests(now);
  if (!contests) return "🌧️ Codeforces is not answering right now. Try again in a few minutes.";
  return formatContestList(contests.slice(0, 8));
}

/**
 * Connects a Codeforces handle to a chat. A private chat is created on first use. A group must already be enabled by an admin,
 * so a member cannot turn a group into a subscriber by connecting a handle.
 */
export async function connectHandle(
  secret: string,
  key: Buffer,
  chatId: string,
  chatType: "private" | "group",
  handle: string,
  now: Date,
): Promise<{ handle: string; rating: number | null }> {
  let recipient = await findChat(secret, chatId);
  if (!recipient) {
    if (chatType === "group") throw new ApiError(409, "group_not_enabled", "A group admin needs to send /enable first.");
    await registerPrivate(secret, key, chatId);
    recipient = await findChat(secret, chatId);
    if (!recipient) throw new ApiError(503, "try_again", "Could not save this chat. Try again.");
  }
  let info: { handle: string; rating: number | null };
  try {
    info = await userInfo(handle, now);
  } catch (e) {
    if (e instanceof CodeforcesError && e.kind === "not_found") throw new ApiError(404, "handle_not_found", "No Codeforces user has that handle.");
    throw new ApiError(503, "cf_unavailable", "Codeforces is not answering right now. Try again in a few minutes.");
  }
  const existing = await handlesOf(recipient.id);
  if (existing.some((h) => h.toLowerCase() === info.handle.toLowerCase())) return info;
  if (existing.length >= MAX_HANDLES) throw new ApiError(409, "too_many_handles", `A chat can connect up to ${MAX_HANDLES} handles. Disconnect one first.`);
  await db.cfHandle.create({ data: { recipientId: recipient.id, handle: info.handle } });
  return info;
}

/** Removes one handle, or all of a chat's handles when none is named. Returns how many were removed. */
export async function disconnectHandle(secret: string, chatId: string, handle?: string): Promise<number> {
  const recipient = await findChat(secret, chatId);
  if (!recipient) return 0;
  const r = await db.cfHandle.deleteMany({
    where: handle ? { recipientId: recipient.id, handle: { equals: handle, mode: "insensitive" } } : { recipientId: recipient.id },
  });
  return r.count;
}

/** The handles connected to a chat, with rating and the number of distinct problems solved. */
export async function connectedHandles(secret: string, chatId: string, now: Date): Promise<{ handle: string; rating: number | null; solved: number }[]> {
  const recipient = await findChat(secret, chatId);
  if (!recipient) return [];
  const out: { handle: string; rating: number | null; solved: number }[] = [];
  for (const handle of await handlesOf(recipient.id)) {
    let rating: number | null = null;
    try {
      rating = (await userInfo(handle, now)).rating;
    } catch {
      rating = null;
    }
    const solved = (await userSolved(handle, now))?.length ?? 0;
    out.push({ handle, rating, solved });
  }
  return out;
}

async function createDailyDeliveries(problems: CfProblem[], day: string, now: Date) {
  const recipients = await db.telegramRecipient.findMany({
    where: { dailyCf: true, blocked: false },
    select: { id: true, chatHash: true, kind: true },
    take: DAILY_BATCH,
  });
  if (recipients.length === 0) return;
  const done = await db.notificationDelivery.findMany({
    where: { kind: "daily_cf", key: day, recipientId: { in: recipients.map((r) => r.id) } },
    select: { recipientId: true },
  });
  const finished = new Set(done.map((d) => d.recipientId));
  const rows: { recipientId: string; kind: string; key: string; ref: string }[] = [];
  for (const r of recipients) {
    if (finished.has(r.id)) continue;
    const custom = r.kind === "group" ? await customRefFor(r.id) : null;
    if (custom) {
      rows.push({ recipientId: r.id, kind: "daily_cf", key: day, ref: custom });
      continue;
    }
    const handles = await handlesOf(r.id);
    const exclude = new Set<string>([...(await recentRefs(r.id, now)), ...(await solvedBy(handles, now))]);
    const pick = pickDailyProblem(problems, wordingSeed(r.chatHash, day), exclude);
    if (pick) rows.push({ recipientId: r.id, kind: "daily_cf", key: day, ref: problemRef(pick) });
  }
  if (rows.length > 0) await db.notificationDelivery.createMany({ data: rows, skipDuplicates: true });
}

/**
 * The two contest notices. The first run only records which contests exist, and sends nothing, so enabling this does not flood chats
 * with every contest already listed. After that, a contest is announced once when first seen, and once more when two hours remain.
 */
async function createContestNotices(contests: CfContest[], now: Date) {
  const row = await db.cfCache.findUnique({ where: { key: SEEN_CONTESTS_KEY } });
  const seen = new Set<string>((row?.payload as unknown as string[] | undefined) ?? []);
  const save = async (ids: string[]) => {
    const payload = ids as unknown as import("@prisma/client").Prisma.InputJsonValue;
    await db.cfCache.upsert({ where: { key: SEEN_CONTESTS_KEY }, create: { key: SEEN_CONTESTS_KEY, payload, fetchedAt: now }, update: { payload, fetchedAt: now } });
  };
  const recipients = async () => db.telegramRecipient.findMany({ where: { contestAlerts: true, blocked: false }, select: { id: true }, take: CONTEST_BATCH });

  if (!row) {
    await save(contests.map((c) => String(c.id)));
  } else {
    const fresh = newlyPosted(contests, seen);
    if (fresh.length > 0) {
      await save([...seen, ...fresh.map((c) => String(c.id))]);
      const targets = await recipients();
      const rows = fresh.flatMap((c) => targets.map((r) => ({ recipientId: r.id, kind: "cf_posted", key: String(c.id), ref: String(c.id) })));
      if (rows.length > 0) await db.notificationDelivery.createMany({ data: rows, skipDuplicates: true });
    }
  }

  const starting = contestsStartingWithin(contests, now, 120);
  if (starting.length > 0) {
    const targets = await recipients();
    const rows = starting.flatMap((c) => targets.map((r) => ({ recipientId: r.id, kind: "cf_2h", key: String(c.id), ref: String(c.id) })));
    if (rows.length > 0) await db.notificationDelivery.createMany({ data: rows, skipDuplicates: true });
  }
}

function renderContest(contests: CfContest[], id: string, kind: "cf_posted" | "cf_2h" | "contest_cf") {
  const c = contests.find((x) => String(x.id) === id);
  if (kind === "cf_posted") return c ? formatContestPosted(c) : `🆕 A new Codeforces contest is up: https://codeforces.com/contests/${id}`;
  return c ? formatContestTwoHours(c) : `⏰ A Codeforces contest starts in about 2 hours: https://codeforces.com/contests/${id}`;
}

const REWARD_TEXT: Record<string, (detail: string) => string> = {
  podium_1: (d) => `🏆 Weekly podium: #1 on the Algoryva board last week (Mon–Sun, UTC) with ${d}. Well done!`,
  podium_2: (d) => `🥈 Weekly podium: #2 on the Algoryva board last week (Mon–Sun, UTC) with ${d}. Well done!`,
  podium_3: (d) => `🥉 Weekly podium: #3 on the Algoryva board last week (Mon–Sun, UTC) with ${d}. Well done!`,
  steady_week: (d) => `🔥 Steady week: verified solves on ${d} of last week. Showing up on different days is the habit that lasts.`,
};
function renderReward(ref: string): string {
  const [kind, detail = ""] = ref.split("|");
  return REWARD_TEXT[kind]?.(detail) ?? "🎉 You earned a reward on Algoryva. See /progress.";
}

/**
 * The messages the bot should send now. Creates today's daily rows and the contest notices that are due, then returns pending
 * messages whose previous attempt is older than five minutes. The bot acknowledges each one with ackDelivery.
 * If Codeforces is unreachable, nothing new is created, but pending messages are still returned.
 */
export async function dueItems(key: Buffer, now: Date): Promise<DueItem[]> {
  const day = utcDay(now);
  const [problems, contests] = await Promise.all([problemset(now), upcomingContests(now)]);
  await awardPreviousWeek(now); // idempotent: does nothing after the first run of each week
  if (problems) await createDailyDeliveries(problems, day, now);
  if (contests) await createContestNotices(contests, now);
  await db.notificationDelivery.updateMany({ where: { status: "pending", attempts: { gte: MAX_ATTEMPTS } }, data: { status: "failed" } });

  const due = await db.notificationDelivery.findMany({
    where: {
      status: "pending",
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ lastTriedAt: null }, { lastTriedAt: { lt: new Date(now.getTime() - RETRY_AFTER_MS) } }],
      recipient: { is: { blocked: false } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, kind: true, key: true, ref: true, recipient: { select: { chatCipher: true, chatHash: true, kind: true } } },
  });
  if (due.length === 0) return [];
  await db.notificationDelivery.updateMany({ where: { id: { in: due.map((d) => d.id) } }, data: { lastTriedAt: now, attempts: { increment: 1 } } });

  const items: DueItem[] = [];
  for (const d of due) {
    let chatId: string;
    try {
      chatId = decryptChatId(key, d.recipient.chatCipher);
    } catch {
      await db.notificationDelivery.update({ where: { id: d.id }, data: { status: "failed" } });
      continue;
    }
    const handlesConnected = (await db.cfHandle.count({ where: { recipient: { chatHash: d.recipient.chatHash } } })) > 0;
    const text =
      d.kind === "daily_cf"
        ? renderDaily(problems ?? [], d.ref ?? "", d.key, d.recipient.kind, d.recipient.chatHash, handlesConnected)
        : d.kind === "reward"
          ? renderReward(d.ref ?? "")
          : renderContest(contests ?? [], d.ref ?? "", d.kind === "cf_posted" ? "cf_posted" : d.kind === "cf_2h" ? "cf_2h" : "contest_cf");
    items.push({ deliveryId: d.id, chatId, text });
  }
  return items;
}

/** Records what happened to one message. A blocked chat is switched off so nothing else is sent to it. */
export async function ackDelivery(id: string, outcome: Outcome, now: Date): Promise<boolean> {
  const d = await db.notificationDelivery.findUnique({ where: { id }, select: { recipientId: true, attempts: true, status: true } });
  if (!d) return false;
  if (d.status !== "pending") return true; // already settled: acknowledging again changes nothing
  if (outcome === "sent") {
    await db.notificationDelivery.update({ where: { id }, data: { status: "sent", sentAt: now } });
  } else if (outcome === "blocked") {
    await db.$transaction([
      db.notificationDelivery.update({ where: { id }, data: { status: "blocked" } }),
      db.telegramRecipient.update({ where: { id: d.recipientId }, data: { blocked: true } }),
    ]);
  } else if (d.attempts >= MAX_ATTEMPTS) {
    await db.notificationDelivery.update({ where: { id }, data: { status: "failed" } });
  }
  return true;
}

/** Kept for the Algoryva referral feature. A referral counts once the referred account has an output-matched solve. */
export async function referralStats(userId: string): Promise<{ code: string; qualified: number }> {
  const existing = await db.referralCode.findUnique({ where: { userId }, select: { code: true } });
  let code = existing?.code;
  if (!code) {
    code = randomBytes(5).toString("hex");
    await db.referralCode.create({ data: { userId, code } });
  }
  const referred = await db.telegramRecipient.findMany({ where: { referrerCode: code, userId: { not: null } }, select: { userId: true } });
  const ids = referred.map((r) => r.userId).filter((u): u is string => typeof u === "string");
  if (ids.length === 0) return { code, qualified: 0 };
  const solvers = await db.problemSolve.findMany({ where: { userId: { in: ids }, verification: "OUTPUT_MATCHED" }, select: { userId: true }, distinct: ["userId"] });
  return { code, qualified: solvers.length };
}
