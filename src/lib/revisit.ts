/**
 * Spaced review for problems the learner got wrong or needed help with.
 * The first reminder is due one day after the help. Each later reminder waits longer: 3, 7, 14, then 30 days.
 * After the fifth reminder the revisit stops nagging, but it stays on the revisits page until it is passed.
 */
export const FIRST_DELAY_DAYS = 1;
export const REMINDER_GAPS_DAYS = [3, 7, 14, 30] as const;

const DAY_MS = 86_400_000;

export type RevisitTarget =
  | { kind: "site"; problemId: string }
  | { kind: "outside"; title: string; url: string | null };

/**
 * Which revisit a logged mistake creates. Every mistake on a problem comes back for a solve-again review, whatever its reason.
 * A judge-graded problem on this site is verified by the judge. Anything else (an external problem, or one typed by the
 * learner) is confirmed by the learner. A mistake with no problem has nothing to revisit.
 */
export function revisitTargetFor(m: {
  problemId: string | null;
  problem: { kind: "INTERNAL" | "EXTERNAL"; title: string; externalUrl: string | null } | null;
  outsideTitle: string | null;
  outsideUrl: string | null;
}): RevisitTarget | null {
  if (m.problemId && m.problem) {
    if (m.problem.kind === "INTERNAL") return { kind: "site", problemId: m.problemId };
    const url = m.problem.externalUrl?.startsWith("https://") ? m.problem.externalUrl : null;
    return { kind: "outside", title: m.problem.title, url };
  }
  if (m.outsideTitle) return { kind: "outside", title: m.outsideTitle, url: m.outsideUrl };
  return null;
}

export function firstDueAt(now: Date): Date {
  return new Date(now.getTime() + FIRST_DELAY_DAYS * DAY_MS);
}

/** Called after a reminder is sent. `step` is the number of reminders sent before this one. */
export function afterReminder(step: number, now: Date): { step: number; dueAt: Date | null } {
  const next = step + 1;
  if (next > REMINDER_GAPS_DAYS.length) return { step: next, dueAt: null };
  return { step: next, dueAt: new Date(now.getTime() + REMINDER_GAPS_DAYS[next - 1] * DAY_MS) };
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** The identity of an outside problem: its normalised https link, or otherwise its title. */
export function outsideKeyOf(title: string, url: string | null): string {
  return url ? `url:${url}` : `title:${title.trim().toLowerCase()}`;
}

/** The explanation an outside problem needs before it counts as passed. */
export const NOTE_MIN = 20;
export const NOTE_MAX = 300;
