/**
 * Rules the app uses to show what the server will decide. They are copies of the website's rules (lib/recommend.ts, lib/revisit.ts,
 * lib/mastery.ts). The server stays authoritative: it re-checks every event. Keep these in step with the website if the rules change.
 */
const LADDER_DAYS = [1, 3, 7, 14, 30];
const DAY_MS = 86_400_000;

/** Review intervals: the item is due again after LADDER_DAYS[step] days (the last rung repeats). */
export function nextReviewDate(from: Date, step: number): Date {
  const days = LADDER_DAYS[Math.min(step, LADDER_DAYS.length - 1)]!;
  return new Date(from.getTime() + days * DAY_MS);
}

export function firstDueAt(now: Date): Date {
  return new Date(now.getTime() + DAY_MS);
}

/** Quiz pass mark: 80% of the questions, rounded up. */
export const passMark = (total: number): number => Math.ceil(total * 0.8);

export const NOTE_MIN = 20;
export const NOTE_MAX = 300;

/** The identity of an outside problem: its https link, or otherwise its title. */
export function outsideKeyOf(title: string, url: string | null): string {
  return url ? `url:${url}` : `title:${title.trim().toLowerCase()}`;
}

/** Topic unlock: every prerequisite must be completed. Uses the prerequisites stored with the content. */
export function unlockState(prereqs: string[], completed: ReadonlySet<string>): { unlocked: boolean; missing: string[] } {
  const missing = prereqs.filter((p) => !completed.has(p));
  return { unlocked: missing.length === 0, missing };
}
