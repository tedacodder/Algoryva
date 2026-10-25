/** Chooses `count` questions at random, without repeats, using the supplied random source (so the choice can be tested). */
export function pickRandom<T>(items: T[], count: number, random: () => number = Math.random): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (pool.length > 0 && out.length < count) {
    const i = Math.floor(random() * pool.length);
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}

export const QUESTION_COUNTS = [5, 10, 15, 20] as const;

/** The score needed to pass a quiz of `total` questions: 80%, rounded up (the same rule as the lessons). */
export const passNeeded = (total: number): number => Math.ceil(total * 0.8);

/** Percentage shown in results, rounded. */
export const percent = (score: number, total: number): number => (total === 0 ? 0 : Math.round((score / total) * 100));
