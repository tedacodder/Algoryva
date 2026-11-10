import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { hashTelegramId } from "@/lib/telegram/bot-auth";
import { contestStandings, contestsAll, userProfile, userRatingHistory } from "@/lib/codeforces/client";
import { notFoundAs } from "@/lib/codeforces/errors";

const CONTEST_NOT_FOUND = "That contest was not found on Codeforces. Check the contest id, for example /ranklist 2283.";
const HANDLE_NOT_FOUND = "That handle was not found on Codeforces. Check the spelling.";
const UNAVAILABLE = "Codeforces is not answering right now. Try again in a few minutes.";

/** Codeforces calls one summary or ranklist may spend. The rest wait for the next press. */
const BUDGET_MS = 35_000;

/** The handles a chat cares about: its valid class list in a group, or the handles connected here. */
async function chatHandles(secret: string, chatId: string): Promise<string[]> {
  const recipient = await db.telegramRecipient.findUnique({ where: { chatHash: hashTelegramId(secret, chatId) }, select: { id: true, kind: true } });
  if (!recipient) throw new ApiError(404, "not_started", "Start the bot first with /start.");
  if (recipient.kind === "group") {
    const roster = await db.groupRoster.findMany({ where: { recipientId: recipient.id, status: "valid" }, select: { handle: true } });
    if (roster.length) return roster.map((r) => r.handle);
  }
  return (await db.cfHandle.findMany({ where: { recipientId: recipient.id }, select: { handle: true } })).map((r) => r.handle);
}

/** The running contest if there is one, otherwise the most recent finished one. */
export async function latestContest(now: Date) {
  const list = await contestsAll(now);
  if (!list) return null;
  const live = list.find((c) => c.phase === "CODING");
  if (live) return live;
  return list.filter((c) => c.phase === "FINISHED").sort((a, b) => b.startTimeSeconds - a.startTimeSeconds)[0] ?? null;
}

async function resolveContest(contestId: number | null, now: Date) {
  if (contestId) return { id: contestId, name: null as string | null, phase: null as string | null };
  const found = await latestContest(now);
  if (!found) throw new ApiError(404, "no_contest", "No Codeforces contest was found right now.");
  return { id: found.id, name: found.name, phase: found.phase };
}

/** The top of the field plus this chat's members, live or final. */
export async function ranklistFor(secret: string, chatId: string, contestId: number | null, now: Date) {
  const contest = await resolveContest(contestId, now);
  const handles = await chatHandles(secret, chatId);
  let top;
  let members;
  try {
    top = await contestStandings(contest.id, [], 10, now);
    members = handles.length ? await contestStandings(contest.id, handles, handles.length, now) : null;
  } catch (e) {
    notFoundAs(e, "contest_not_found", CONTEST_NOT_FOUND);
  }
  if (top === null || (handles.length > 0 && members === null)) throw new ApiError(503, "codeforces_unavailable", UNAVAILABLE);
  const memberRows = [...(members?.rows ?? [])].sort((a, b) => a.rank - b.rank);
  return {
    contest: { id: contest.id, name: top?.contest.name ?? contest.name ?? `Contest ${contest.id}`, phase: top?.contest.phase ?? contest.phase ?? "" },
    top: top?.rows ?? [],
    members: memberRows,
    missing: handles.filter((h) => !memberRows.some((r) => r.handle.toLowerCase() === h.toLowerCase())),
    checkedAt: now.toISOString(),
  };
}

/** After a contest: each member's place, problems solved, and rating change. Members past the budget are marked pending. */
export async function summaryFor(secret: string, chatId: string, contestId: number | null, now: Date) {
  const contest = await resolveContest(contestId, now);
  const handles = await chatHandles(secret, chatId);
  if (!handles.length) throw new ApiError(409, "no_members", "Add members first with /roster add, or /connect your handle.");
  let standings;
  try {
    standings = await contestStandings(contest.id, handles, handles.length, now);
  } catch (e) {
    notFoundAs(e, "contest_not_found", CONTEST_NOT_FOUND);
  }
  if (standings === null) throw new ApiError(503, "codeforces_unavailable", UNAVAILABLE);
  const deadline = Date.now() + BUDGET_MS;
  const members: { handle: string; rank: number; solved: number; points: number; ratingChange: number | null; pending: boolean }[] = [];
  for (const row of standings?.rows ?? []) {
    let ratingChange: number | null = null;
    let pending = false;
    if (Date.now() < deadline) {
      const change = (await userRatingHistory(row.handle, now))?.find((h) => h.contestId === contest.id);
      ratingChange = change ? change.newRating - change.oldRating : null;
    } else {
      pending = true;
    }
    members.push({ handle: row.handle, rank: row.rank, solved: row.solved, points: row.points, ratingChange, pending });
  }
  members.sort((a, b) => a.rank - b.rank);
  return {
    contest: { id: contest.id, name: standings?.contest.name ?? contest.name ?? `Contest ${contest.id}`, phase: standings?.contest.phase ?? contest.phase ?? "" },
    members,
    missing: handles.filter((h) => !members.some((m) => m.handle.toLowerCase() === h.toLowerCase())),
    checkedAt: now.toISOString(),
  };
}

/** A handle's profile: current rating, best rating, rank and the number of rated contests. */
export async function ratingFor(handle: string, now: Date) {
  let profile;
  let history;
  try {
    profile = await userProfile(handle, now);
    history = profile ? await userRatingHistory(handle, now) : null;
  } catch (e) {
    notFoundAs(e, "handle_not_found", HANDLE_NOT_FOUND);
  }
  if (!profile) throw new ApiError(503, "codeforces_unavailable", UNAVAILABLE);
  return { ...profile, contests: history?.length ?? null };
}
