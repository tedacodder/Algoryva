import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { scoreWeek } from "@/lib/bot/leaderboard";
import { weekStart } from "@/lib/bot/rewards";

/**
 * Clubs v1. Rules, all enforced here:
 *   - A linked student can create a club or join one with its code. One club per student.
 *   - A club's weekly score is the sum of its members' output-matched points for the current week. Self-reported and legacy solves
 *     count for nothing, and the daily cap of the public board applies to each member.
 *   - The board shows club names and scores only. Member names are never shown on it.
 *   - The leader cannot leave while other members remain. Leadership transfer is not built yet.
 *   - Deleting the leader's account deletes the club, and every membership goes with it.
 */
export const CLUB_NAME = /^[A-Za-z0-9][A-Za-z0-9 .'-]{2,39}$/;

export function validClubName(name: string): boolean {
  return CLUB_NAME.test(name.trim());
}

const isUnique = (e: unknown) => typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === "P2002";

export async function createClub(userId: string, rawName: string): Promise<{ name: string; code: string }> {
  const name = rawName.trim();
  if (!validClubName(name)) throw new ApiError(400, "invalid_name", "Club names are 3 to 40 letters, numbers, spaces, dots, apostrophes or hyphens.");
  if (await db.clubMembership.findUnique({ where: { userId }, select: { clubId: true } })) {
    throw new ApiError(409, "already_in_club", "You are already in a club. Leave it first.");
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomBytes(4).toString("hex");
    try {
      const club = await db.$transaction(async (tx) => {
        const created = await tx.club.create({ data: { name, code, leaderUserId: userId } });
        await tx.clubMembership.create({ data: { clubId: created.id, userId } });
        return created;
      });
      return { name: club.name, code: club.code };
    } catch (e) {
      if (!isUnique(e)) throw e;
    }
  }
  throw new ApiError(503, "try_again", "Could not create a club right now. Try again.");
}

export async function joinClub(userId: string, code: string): Promise<{ name: string }> {
  if (await db.clubMembership.findUnique({ where: { userId }, select: { clubId: true } })) {
    throw new ApiError(409, "already_in_club", "You are already in a club. Leave it first.");
  }
  const club = await db.club.findUnique({ where: { code }, select: { id: true, name: true } });
  if (!club) throw new ApiError(404, "club_not_found", "No club has that code.");
  try {
    await db.clubMembership.create({ data: { clubId: club.id, userId } });
  } catch (e) {
    if (isUnique(e)) throw new ApiError(409, "already_in_club", "You are already in a club. Leave it first.");
    throw e;
  }
  return { name: club.name };
}

export async function leaveClub(userId: string): Promise<{ left: boolean; club?: string }> {
  const membership = await db.clubMembership.findUnique({
    where: { userId },
    select: { clubId: true, club: { select: { name: true, leaderUserId: true, _count: { select: { members: true } } } } },
  });
  if (!membership) return { left: false };
  if (membership.club.leaderUserId === userId && membership.club._count.members > 1) {
    throw new ApiError(409, "leader_must_stay", "The leader cannot leave while other members remain. Leadership transfer is not available yet.");
  }
  if (membership.club.leaderUserId === userId) {
    await db.club.delete({ where: { id: membership.clubId } }); // sole member: the club goes with them
  } else {
    await db.clubMembership.delete({ where: { userId } });
  }
  return { left: true, club: membership.club.name };
}

async function weeklyScores(userIds: string[], now: Date): Promise<Map<string, number>> {
  const start = weekStart(now);
  const rows = await db.problemSolve.findMany({
    where: { userId: { in: userIds }, verification: "OUTPUT_MATCHED", solvedAt: { gte: start, lt: new Date(now.getTime() + 1) }, user: { suspended: false } },
    select: { userId: true, solvedAt: true, problem: { select: { difficulty: true } }, user: { select: { username: true } } },
  });
  const ranked = scoreWeek(rows.map((r) => ({ userId: r.userId, username: r.user.username, solvedAt: r.solvedAt, difficulty: r.problem.difficulty })));
  return new Map(ranked.map((r) => [r.userId, r.score]));
}

export async function myClub(userId: string, now: Date) {
  const membership = await db.clubMembership.findUnique({
    where: { userId },
    select: { club: { select: { id: true, name: true, code: true, leaderUserId: true, members: { select: { userId: true } } } } },
  });
  if (!membership) return null;
  const members = membership.club.members.map((m) => m.userId);
  const scores = await weeklyScores(members, now);
  const total = members.reduce((sum, id) => sum + (scores.get(id) ?? 0), 0);
  return {
    name: membership.club.name,
    code: membership.club.code,
    isLeader: membership.club.leaderUserId === userId,
    members: members.length,
    weekScore: total,
  };
}

/** The top clubs this week. Names and scores only. */
export async function clubBoard(now: Date) {
  const clubs = await db.club.findMany({ select: { name: true, members: { select: { userId: true } } } });
  const all = clubs.flatMap((c) => c.members.map((m) => m.userId));
  const scores = await weeklyScores(all, now);
  return clubs
    .map((c) => ({ name: c.name, members: c.members.length, weekScore: c.members.reduce((sum, m) => sum + (scores.get(m.userId) ?? 0), 0) }))
    .filter((c) => c.weekScore > 0)
    .sort((a, b) => b.weekScore - a.weekScore || a.name.localeCompare(b.name))
    .slice(0, 10);
}

