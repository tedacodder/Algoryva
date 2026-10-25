/**
 * The topic to study next: the first published topic (in course order) that is unlocked and not yet completed.
 * Returns null when everything available is done or nothing is unlocked.
 */
export type TopicLike = { slug: string; position: number; status: string; prereqs: string[] };

export function nextTopic<T extends TopicLike>(topics: T[], completed: ReadonlySet<string>): T | null {
  const ordered = [...topics].sort((a, b) => a.position - b.position);
  return ordered.find((t) => t.status === "PUBLISHED" && !completed.has(t.slug) && t.prereqs.every((p) => completed.has(p))) ?? null;
}
