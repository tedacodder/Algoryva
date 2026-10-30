import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { hashTelegramId } from "@/lib/telegram/bot-auth";
import { CodeforcesError, problemset, userSolved, USER_TTL_MS } from "@/lib/codeforces/client";
import { pickDailyProblem, problemRef, type CfProblem } from "@/lib/codeforces/pick";
import { utcDay } from "@/lib/bot/daily";

/**
 * Classroom tools for a group: a roster of handles, a group-specific daily problem, and a report that shows who has registered,
 * who has solved the current problem, and who has not. Solved status is read from Codeforces, which is rate-limited, so a report checks
 * at most FETCH_BUDGET handles that are not cached. Handles beyond that are shown as "still checking", and a second report completes them.
 */
export const ROSTER_MAX = 200;
export const FETCH_BUDGET = 12;
const HANDLE_RE = /^[A-Za-z0-9_.-]{3,24}$/;
const PROBLEM_RE = /^\d{1,5}\/[A-Za-z][0-9]?$/;

export type ReportData = {
  problem: { ref: string; name: string | null } | null;
  rosterCount: number;
  registered: number;
  notRegistered: string[];
  solved: string[];
  unsolved: string[];
  pending: string[];
  usesConnectedFallback: boolean;
};

const lower = (s: string) => s.toLowerCase();
const isUnique = (e: unknown) => typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

/** The group's chat, which must have been enabled by an admin first. */
async function groupChat(secret: string, chatId: string) {
  const row = await db.telegramRecipient.findUnique({ where: { chatHash: hashTelegramId(secret, chatId) }, select: { id: true, chatHash: true, kind: true } });
  if (!row || row.kind !== "group") throw new ApiError(409, "group_not_enabled", "A group admin needs to send /enable first.");
  return row;
}

/** The problem this group uses instead of the default, or null when the default applies. */
export async function customRefFor(recipientId: string): Promise<string | null> {
  const row = await db.groupDaily.findUnique({ where: { recipientId }, select: { problemRef: true } });
  return row?.problemRef ?? null;
}

function unique(handles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of handles) {
    if (!seen.has(lower(h))) {
      seen.add(lower(h));
      out.push(h);
    }
  }
  return out;
}

export async function rosterAction(
  secret: string,
  chatId: string,
  action: "set" | "add" | "remove" | "list" | "clear",
  handles: string[],
): Promise<{ count: number; handles: string[] }> {
  const group = await groupChat(secret, chatId);
  const bad = handles.find((h) => !HANDLE_RE.test(h));
  if (bad !== undefined) throw new ApiError(400, "invalid_handle", "Handles are 3 to 24 letters, numbers, dots, dashes or underscores.");
  if (action === "set" || action === "clear") await db.groupRoster.deleteMany({ where: { recipientId: group.id } });
  if (action === "remove") {
    await db.groupRoster.deleteMany({ where: { recipientId: group.id, OR: handles.map((h) => ({ handle: { equals: h, mode: "insensitive" as const } })) } });
  }
  if (action === "set" || action === "add") {
    const current = await db.groupRoster.count({ where: { recipientId: group.id } });
    const incoming = unique(handles);
    if (current + incoming.length > ROSTER_MAX) throw new ApiError(400, "roster_too_large", `A roster holds up to ${ROSTER_MAX} handles.`);
    for (const handle of incoming) {
      try {
        await db.groupRoster.create({ data: { recipientId: group.id, handle } });
      } catch (e) {
        if (!isUnique(e)) throw e;
      }
    }
  }
  const rows = await db.groupRoster.findMany({ where: { recipientId: group.id }, orderBy: { addedAt: "asc" }, select: { handle: true } });
  return { count: rows.length, handles: rows.map((r) => r.handle) };
}

export async function groupProblemAction(secret: string, chatId: string, problem: string | null, now: Date): Promise<{ ref: string | null; name: string | null }> {
  const group = await groupChat(secret, chatId);
  if (problem === null) {
    await db.groupDaily.deleteMany({ where: { recipientId: group.id } });
    return { ref: null, name: null };
  }
  if (!PROBLEM_RE.test(problem)) throw new ApiError(400, "invalid_problem", "Use a problem like 1800/C or paste its Codeforces link.");
  const problems = await problemset(now);
  if (!problems) throw new ApiError(503, "cf_unavailable", "Codeforces is not answering right now. Try again in a few minutes.");
  const found = problems.find((p) => problemRef(p) === problem);
  if (!found) throw new ApiError(404, "problem_not_found", "No Codeforces problem has that number.");
  await db.groupDaily.upsert({
    where: { recipientId: group.id },
    create: { recipientId: group.id, problemRef: problem },
    update: { problemRef: problem, setAt: now },
  });
  return { ref: problem, name: found.name };
}

/** Handles with a fresh cached solved list. Null when the list is missing or stale. */
async function cachedSolved(handle: string, now: Date): Promise<string[] | null> {
  const row = await db.cfCache.findUnique({ where: { key: `solved:${lower(handle)}` } });
  if (!row || now.getTime() - row.fetchedAt.getTime() >= USER_TTL_MS) return null;
  return row.payload as unknown as string[];
}

async function currentProblem(group: { id: string; chatHash: string }, problems: CfProblem[] | null, now: Date): Promise<string | null> {
  const custom = await customRefFor(group.id);
  if (custom) return custom;
  const day = utcDay(now);
  const stored = await db.notificationDelivery.findUnique({
    where: { recipientId_kind_key: { recipientId: group.id, kind: "daily_cf", key: day } },
    select: { ref: true },
  });
  if (stored?.ref) return stored.ref;
  if (!problems) return null;
  const pick = pickDailyProblem(problems, `${group.chatHash}|${day}`);
  return pick ? problemRef(pick) : null;
}

export async function classroomReport(secret: string, chatId: string, now: Date): Promise<ReportData> {
  const group = await groupChat(secret, chatId);
  const rosterRows = await db.groupRoster.findMany({ where: { recipientId: group.id }, orderBy: { addedAt: "asc" }, select: { handle: true } });
  const fallback = rosterRows.length === 0;
  let roster: string[];
  if (fallback) {
    const own = await db.cfHandle.findMany({ where: { recipientId: group.id }, select: { handle: true } });
    roster = own.map((r) => r.handle);
  } else {
    roster = rosterRows.map((r) => r.handle);
  }

  // Registered = connected to the bot in any chat, so a student who ran /connect privately still counts.
  const known = roster.length
    ? await db.cfHandle.findMany({ where: { OR: roster.map((h) => ({ handle: { equals: h, mode: "insensitive" as const } })) }, select: { handle: true } })
    : [];
  const knownSet = new Set(known.map((r) => lower(r.handle)));
  const registered = roster.filter((h) => knownSet.has(lower(h)));
  const notRegistered = roster.filter((h) => !knownSet.has(lower(h)));

  const problems = await problemset(now);
  const ref = await currentProblem(group, problems, now);
  const name = ref && problems ? (problems.find((p) => problemRef(p) === ref)?.name ?? null) : null;

  const solved: string[] = [];
  const unsolved: string[] = [];
  const pending: string[] = [];
  let budget = FETCH_BUDGET;
  for (const handle of registered) {
    let refs = await cachedSolved(handle, now);
    if (!refs && budget > 0) {
      budget -= 1;
      try {
        refs = await userSolved(handle, now);
      } catch (e) {
        if (!(e instanceof CodeforcesError)) throw e;
        refs = null;
      }
    }
    if (!refs || !ref) {
      pending.push(handle);
      continue;
    }
    (refs.includes(ref) ? solved : unsolved).push(handle);
  }
  return {
    problem: ref ? { ref, name } : null,
    rosterCount: roster.length,
    registered: registered.length,
    notRegistered,
    solved,
    unsolved,
    pending,
    usesConnectedFallback: fallback,
  };
}
