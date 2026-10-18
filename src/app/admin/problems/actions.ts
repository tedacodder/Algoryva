"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { invalidateContent } from "@/lib/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { parseProblem } from "@/lib/problem-validation";
import { slugify } from "@/lib/url";

export type SaveState = { error?: string } | undefined;

export async function saveProblem(_: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin(); // authorization is enforced here, not in the UI
  const parsed = parseProblem(form);
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value;

  if (v.external) {
    const dup = await db.problem.findFirst({ where: { normalizedUrl: v.external.url, ...(v.id ? { NOT: { id: v.id } } : {}) }, select: { title: true } });
    if (dup) return { error: `This link already exists as "${dup.title}".` };
  }
  const topicRows = await db.topic.findMany({ where: { slug: { in: v.topics } }, select: { id: true } });
  if (topicRows.length !== v.topics.length) return { error: "A selected topic is not in the database. Run the seed." };

  const fields = {
    title: v.title, difficulty: v.difficulty, status: v.status, position: v.position, kind: v.kind,
    source: v.external?.platform ?? null, externalUrl: v.external?.url ?? null, normalizedUrl: v.external?.url ?? null,
    statement: v.internal?.statement ?? null, inputSpec: v.internal?.inputSpec || null, outputSpec: v.internal?.outputSpec || null,
    constraints: v.internal?.constraints || null, timeLimitMs: v.internal ? 1000 : null, memoryLimitMb: v.internal ? 256 : null,
  };
  try {
    await db.$transaction(async (tx) => {
      let problemId = v.id;
      if (problemId) {
        await tx.problem.update({ where: { id: problemId }, data: fields });
      } else {
        const slug = slugify(v.external ? `${v.external.platform}-${v.title}` : v.title);
        problemId = (await tx.problem.create({ data: { ...fields, slug } })).id;
      }
      await tx.problemTopic.deleteMany({ where: { problemId } });
      await tx.problemTopic.createMany({ data: topicRows.map((t) => ({ problemId: problemId!, topicId: t.id })) });
      if (v.internal) {
        await tx.testCase.deleteMany({ where: { problemId, isSample: true } });
        if (v.internal.sampleInput) await tx.testCase.create({ data: { problemId, input: v.internal.sampleInput, expected: v.internal.sampleOutput, isSample: true } });
      }
    });
  } catch {
    return { error: "Could not save. The title may already be used by another problem." };
  }
  revalidatePath("/problems", "layout");
  await invalidateContent();
  redirect("/admin/problems");
}

export async function setPublished(form: FormData) {
  await requireAdmin();
  await db.problem.update({ where: { id: String(form.get("id") ?? "") }, data: { status: form.get("publish") === "1" ? "PUBLISHED" : "DRAFT" } });
  revalidatePath("/problems", "layout"); revalidatePath("/admin/problems");
  await invalidateContent();
}

export async function deleteProblem(form: FormData) {
  await requireAdmin();
  await db.problem.delete({ where: { id: String(form.get("id") ?? "") } });
  revalidatePath("/problems", "layout"); revalidatePath("/admin/problems");
  await invalidateContent();
}
