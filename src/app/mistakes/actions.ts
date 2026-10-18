"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { parseMistake } from "@/lib/mistake-validation";
import { revisitTargetFor } from "@/lib/revisit";
import { scheduleOutsideRevisit, scheduleRevisit } from "@/lib/revisit-store";

export type SaveState = { error?: string } | undefined;

export async function createMistake(_: SaveState, form: FormData): Promise<SaveState> {
  const user = await requireUser();
  const r = parseMistake(form);
  if (!r.ok) return { error: r.error };
  const problem = r.value.problemId ? await db.problem.findFirst({ where: { id: r.value.problemId, status: "PUBLISHED" }, select: { id: true, kind: true, title: true, externalUrl: true } }) : null;
  if (r.value.problemId && !problem) return { error: "Unknown problem." };
  await db.mistake.create({ data: { ...r.value, userId: user.id } });
  // Every mistake on a problem comes back for a review. The judge verifies site problems; the learner confirms the rest.
  const target = revisitTargetFor({ problemId: problem?.id ?? null, problem, outsideTitle: r.value.outsideTitle, outsideUrl: r.value.outsideUrl });
  if (target?.kind === "site") await scheduleRevisit(user.id, target.problemId, new Date());
  if (target?.kind === "outside") await scheduleOutsideRevisit(user.id, target.title, target.url, new Date());
  revalidatePath("/mistakes");
  redirect("/mistakes");
}

export async function deleteMistake(form: FormData) {
  const user = await requireUser();
  await db.mistake.deleteMany({ where: { id: String(form.get("id") ?? ""), userId: user.id } }); // scoped to owner (no IDOR)
  revalidatePath("/mistakes");
}
