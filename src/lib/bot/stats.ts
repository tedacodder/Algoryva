import "server-only";
import { db } from "@/lib/db";

/** Owner-only numbers: who uses the bot, how active they are, and what the scheduled messages did in the last day. */
export async function botStats(now: Date) {
  const day = new Date(now.getTime() - 86_400_000);
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const [chatGroups, activeChats, deliveries, accounts, linked, optedIn, handles, rosterValid, rosterPending, weekSolvers] = await Promise.all([
    db.telegramRecipient.groupBy({ by: ["kind", "blocked"], _count: { _all: true } }),
    db.notificationDelivery.findMany({ where: { status: "sent", sentAt: { gte: week } }, distinct: ["recipientId"], select: { recipient: { select: { kind: true } } } }),
    db.notificationDelivery.groupBy({ by: ["status"], where: { createdAt: { gte: day } }, _count: { _all: true } }),
    db.user.count(),
    db.telegramLink.count(),
    db.telegramLink.count({ where: { leaderboardOptIn: true } }),
    db.cfHandle.count(),
    db.groupRoster.count({ where: { status: "valid" } }),
    db.groupRoster.count({ where: { status: "pending" } }),
    db.problemSolve.findMany({ where: { solvedAt: { gte: week } }, distinct: ["userId"], select: { userId: true } }),
  ]);
  const count = (kind: string, blocked: boolean) => chatGroups.filter((g) => g.kind === kind && g.blocked === blocked).reduce((n, g) => n + g._count._all, 0);
  const sentBy = (status: string) => deliveries.find((d) => d.status === status)?._count._all ?? 0;
  return {
    privateChats: count("private", false),
    groups: count("group", false),
    blocked: count("private", true) + count("group", true),
    activePrivate7d: activeChats.filter((c) => c.recipient.kind === "private").length,
    activeGroups7d: activeChats.filter((c) => c.recipient.kind === "group").length,
    accounts,
    linked,
    optedIn,
    activeLearners7d: weekSolvers.length,
    handles,
    rosterValid,
    rosterPending,
    sent24h: sentBy("sent"),
    failed24h: sentBy("failed"),
    blocked24h: sentBy("blocked"),
    checkedAt: now.toISOString(),
  };
}
