import "server-only";
import { db } from "@/lib/db";
import { cached } from "@/lib/cache";

const FIVE_MINUTES = 300;

/** A published problem with its topics and SAMPLE tests only. Hidden tests are never selected here. */
export const problemDetail = (slug: string) =>
  cached(`problem:${slug}`, FIVE_MINUTES, () =>
    db.problem.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        topics: { select: { topic: { select: { slug: true, title: true } } } },
        testCases: { where: { isSample: true }, orderBy: { id: "asc" } },
      },
    }),
  );

/** Practice problems for a published topic, the same for every visitor. */
export const topicPractice = (topicSlug: string) =>
  cached(`practice:${topicSlug}`, FIVE_MINUTES, () =>
    db.problem.findMany({
      where: { status: "PUBLISHED", topics: { some: { topic: { slug: topicSlug } } } },
      orderBy: [{ kind: "desc" }, { position: "asc" }],
      take: 60,
      select: { id: true, slug: true, title: true, kind: true, difficulty: true, source: true, externalUrl: true },
    }),
  );

/** The published custom lesson text for a topic, if one exists. */
export const customLesson = (topicSlug: string) =>
  cached(`lesson:${topicSlug}`, FIVE_MINUTES, () =>
    db.lesson.findFirst({
      where: { slug: "main", status: "PUBLISHED", topic: { slug: topicSlug } },
      select: { sections: { orderBy: { position: "asc" }, take: 1, select: { body: true } } },
    }),
  );
