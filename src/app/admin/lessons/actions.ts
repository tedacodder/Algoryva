"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { invalidateContent } from "@/lib/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { bySlug } from "@/lib/curriculum";
import { parseLessonMarkdown } from "@/lib/lesson-markdown";

export type SaveState = { error?: string } | undefined;

export async function saveLesson(_: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const slug = String(form.get("slug") ?? "");
  const def = bySlug.get(slug);
  if (!def || def.status !== "PUBLISHED") return { error: "Unknown topic." };
  const md = String(form.get("markdown") ?? "").replace(/\r\n/g, "\n");
  if (md.length > 50_000) return { error: "Lesson is too long (max 50000 characters)." };
  if (parseLessonMarkdown(md).length === 0) return { error: 'Add at least one section that starts with "## Heading".' };
  const status = form.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const topic = await db.topic.findUnique({ where: { slug }, select: { id: true, title: true } });
  if (!topic) return { error: "Topic is not in the database. Run the seed." };
  await db.$transaction(async (tx) => {
    const lesson = await tx.lesson.upsert({
      where: { topicId_slug: { topicId: topic.id, slug: "main" } },
      update: { status, title: topic.title }, create: { topicId: topic.id, slug: "main", title: topic.title, status },
    });
    await tx.lessonSection.deleteMany({ where: { lessonId: lesson.id } });
    await tx.lessonSection.create({ data: { lessonId: lesson.id, kind: "markdown", body: md, position: 0 } });
  });
  revalidatePath(`/learn/${slug}`);
  await invalidateContent();
  redirect("/admin/lessons");
}

export async function revertLesson(form: FormData) {
  await requireAdmin();
  const slug = String(form.get("slug") ?? "");
  await db.lesson.deleteMany({ where: { slug: "main", topic: { slug } } });
  revalidatePath(`/learn/${slug}`); revalidatePath("/admin/lessons");
  await invalidateContent();
}

/** Publish or unpublish a custom lesson without opening the editor. A lesson with no sections cannot be published. */
export async function setLessonStatus(form: FormData) {
  await requireAdmin();
  const slug = String(form.get("slug") ?? "");
  if (!bySlug.get(slug)) return;
  const status = form.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const row = await db.lesson.findFirst({ where: { slug: "main", topic: { slug } }, select: { id: true, sections: { select: { id: true }, take: 1 } } });
  if (!row || row.sections.length === 0) return;
  await db.lesson.update({ where: { id: row.id }, data: { status } });
  revalidatePath(`/learn/${slug}`);
  await invalidateContent();
  revalidatePath("/admin/lessons");
  await invalidateContent();
}
