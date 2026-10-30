"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { awardSolve } from "@/lib/solve";

/**
 * Manual solve mark. Allowed only for EXTERNAL problems, whose statements live on another site, so the learner's own mark is the
 * only signal. INTERNAL problems are never marked here: they are solved only by checkOutput after every hidden test passes.
 * Client-supplied fields such as "solved" or "passed" are ignored. Unmarking is always allowed and never grants anything.
 */
export async function toggleSolved(form: FormData) {
  const user = await requireUser();
  const p = await db.problem.findFirst({ where: { id: String(form.get("problemId") ?? ""), status: "PUBLISHED" }, select: { id: true, kind: true } });
  if (!p) return;
  const removed = await db.problemSolve.deleteMany({ where: { userId: user.id, problemId: p.id } });
  if (removed.count === 0 && p.kind === "EXTERNAL") await awardSolve(user.id, p.id, "SELF_REPORTED");
  revalidatePath("/problems", "layout");
  revalidatePath("/dashboard");
}
