import "server-only";
import { db } from "@/lib/db";
import { getStats } from "@/lib/stats";
import { getStreak } from "@/lib/activity";
import { computeXp, earnedBadges, levelFor } from "@/lib/gamification";

/**
 * A student's progress for the bot. Every number comes from the functions the website already uses: getStats, getStreak,
 * computeXp, levelFor and earnedBadges. Nothing is recalculated here. The solve breakdown is added so a student can see how many
 * solves are output-matched and how many are self-reported or legacy. The XP figure matches the website, which counts every solve.
 */
export async function progressFor(userId: string) {
  const [stats, streak, solves, rewards] = await Promise.all([
    getStats(userId),
    getStreak(userId),
    db.problemSolve.findMany({ where: { userId }, select: { verification: true } }),
    db.botReward.findMany({ where: { userId }, orderBy: { awardedAt: "desc" }, take: 12, select: { kind: true, periodKey: true, detail: true } }),
  ]);
  const xp = computeXp(stats);
  const level = levelFor(xp);
  const count = (v: string) => solves.filter((s) => s.verification === v).length;
  return {
    xp,
    level: level.level,
    levelProgress: { into: level.into, needed: level.needed },
    streak: { current: streak.current, longest: streak.longest },
    solved: {
      total: solves.length,
      outputMatched: count("OUTPUT_MATCHED"),
      selfReported: count("SELF_REPORTED"),
      legacyUnverified: count("LEGACY_UNVERIFIED"),
    },
    badges: earnedBadges(stats).map((b) => b.name),
    rewards: rewards.map((r) => ({ kind: r.kind, week: r.periodKey, detail: r.detail })),
  };
}
