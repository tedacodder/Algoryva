import { TOPICS } from "@/lib/curriculum";
import type { FakeDb } from "@/lib/test-support/fake-db";

export const topicId = (slug: string) => `t_${slug}`;

/** Every curriculum topic as a Topic row, a user, and nothing else. */
export function seedBasics(db: FakeDb, userIds: string[] = ["u1"]): void {
  db.seed("topic", TOPICS.map((t) => ({ id: topicId(t.slug), slug: t.slug, title: t.title })));
  db.seed("user", userIds.map((id) => ({ id, email: `${id}@example.test`, username: id, passwordHash: "x", role: "USER", suspended: false, preferredLanguage: "python", emailVerifiedAt: null, pendingEmail: null })));
}

export function ev(type: string, payload: unknown, id: string = crypto.randomUUID(), at: string = new Date().toISOString()) {
  return { id, type, payload, at };
}
