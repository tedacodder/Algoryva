import "server-only";
import { db } from "@/lib/db";
import { afterReminder, firstDueAt, outsideKeyOf, startOfUtcDay } from "@/lib/revisit";
import { sendRevisitDigest } from "@/lib/auth/account-mail";

const DIGEST_TITLES = 10;

/** Called when a learner logs a help-reason mistake. A new help event starts the ladder again. */
export async function scheduleRevisit(userId: string, problemId: string, now: Date): Promise<void> {
  const dueAt = firstDueAt(now);
  await db.revisit.upsert({
    where: { userId_problemId: { userId, problemId } },
    create: { userId, problemId, dueAt, step: 0 },
    update: { dueAt, step: 0, passedAt: null, passedBy: null, note: null },
  });
}

/** Queues an outside problem (the learner types its title, optionally with an https link). Passed only by self-report. */
export async function scheduleOutsideRevisit(userId: string, title: string, url: string | null, now: Date): Promise<void> {
  const outsideKey = outsideKeyOf(title, url);
  const dueAt = firstDueAt(now);
  await db.revisit.upsert({
    where: { userId_outsideKey: { userId, outsideKey } },
    create: { userId, outsideKey, outsideTitle: title, outsideUrl: url, dueAt, step: 0 },
    update: { outsideTitle: title, outsideUrl: url, dueAt, step: 0, passedAt: null, passedBy: null, note: null },
  });
}

/**
 * Called only after the judge's full server-side match. It counts only when the revisit is already due, so a re-solve
 * right after the help does not prove recall.
 */
export async function passRevisit(userId: string, problemId: string, now: Date): Promise<void> {
  await db.revisit.updateMany({
    where: { userId, problemId, passedAt: null, dueAt: { lte: now } },
    data: { passedAt: now, dueAt: null, passedBy: "judge" },
  });
}

/**
 * The learner's own report for an OUTSIDE problem, only once it is due, and only with a short explanation. It is stored
 * as passedBy "self", so it is never shown as verified. Returns how many revisits were updated (0 or 1).
 */
export async function selfReportRevisit(userId: string, id: string, note: string, now: Date): Promise<number> {
  const r = await db.revisit.updateMany({
    where: { id, userId, problemId: null, passedAt: null, dueAt: { lte: now } },
    data: { passedAt: now, dueAt: null, passedBy: "self", note },
  });
  return r.count;
}

export async function countDueRevisits(userId: string, now: Date): Promise<number> {
  return db.revisit.count({ where: { userId, passedAt: null, dueAt: { lte: now } } });
}

export async function listRevisits(userId: string, now: Date) {
  const rows = await db.revisit.findMany({
    where: { userId },
    include: { problem: { select: { slug: true, title: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const due = rows.filter((r) => !r.passedAt && r.dueAt && r.dueAt <= now);
  const open = rows.filter((r) => !r.passedAt && !(r.dueAt && r.dueAt <= now));
  const passed = rows.filter((r) => r.passedAt).slice(0, 20);
  return { due, open, passed };
}

export async function setRevisitEmails(userId: string, on: boolean): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { revisitEmails: on } });
}

/**
 * One digest per user per day, sent to users with due revisits who have not opted out. A reminder moves the revisit
 * to its next step only after the email is accepted, so a provider failure never silently skips a reminder.
 */
export async function runRevisitDigests(now: Date, batch: number): Promise<{ users: number; sent: number; failed: number }> {
  const users = await db.user.findMany({
    where: {
      revisitEmails: true,
      revisits: { some: { passedAt: null, dueAt: { lte: now } } },
      OR: [{ revisitEmailedAt: null }, { revisitEmailedAt: { lt: startOfUtcDay(now) } }],
    },
    select: { id: true, email: true },
    take: batch,
  });
  let sent = 0, failed = 0;
  for (const u of users) {
    const due = await db.revisit.findMany({
      where: { userId: u.id, passedAt: null, dueAt: { lte: now } },
      include: { problem: { select: { title: true } } },
    });
    const shown = due.slice(0, DIGEST_TITLES).map((d) => d.problem?.title ?? d.outsideTitle ?? "Untitled problem");
    const ok = await sendRevisitDigest(u.email, shown, due.length - shown.length);
    if (!ok) { failed++; continue; }
    sent++;
    await db.$transaction([
      ...due.map((d) => {
        const next = afterReminder(d.step, now);
        return db.revisit.update({ where: { id: d.id }, data: { step: next.step, dueAt: next.dueAt } });
      }),
      db.user.update({ where: { id: u.id }, data: { revisitEmailedAt: now } }),
    ]);
  }
  return { users: users.length, sent, failed };
}
