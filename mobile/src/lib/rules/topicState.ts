/**
 * The state shown on each topic card, as the website shows it (src/components/TopicCard.tsx):
 * done (completed), current (the next one to study), open (unlocked), locked (prerequisites missing) or soon (no lesson yet).
 */
export type TopicState = "done" | "current" | "open" | "locked" | "soon";

export type TopicRef = { slug: string; position: number; status: string; prereqs: string[] };

export function topicStates(topics: TopicRef[], completed: ReadonlySet<string>): Map<string, TopicState> {
  const ordered = [...topics].sort((a, b) => a.position - b.position);
  const current = ordered.find((t) => t.status === "PUBLISHED" && !completed.has(t.slug) && t.prereqs.every((p) => completed.has(p)));
  const out = new Map<string, TopicState>();
  for (const t of topics) {
    if (t.status !== "PUBLISHED") out.set(t.slug, "soon");
    else if (completed.has(t.slug)) out.set(t.slug, "done");
    else if (current && t.slug === current.slug) out.set(t.slug, "current");
    else if (t.prereqs.every((p) => completed.has(p))) out.set(t.slug, "open");
    else out.set(t.slug, "locked");
  }
  return out;
}

export const STATE_LABEL: Record<TopicState, string> = { done: "Completed", current: "Up next", open: "Available", locked: "Locked", soon: "Coming soon" };
