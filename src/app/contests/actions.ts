"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getOrStartEntry, contestState } from "@/lib/contests";
import { awardContestSolve } from "@/lib/solve";

export async function startContest(form: FormData) {
  const user = await requireUser();
  const contestId = String(form.get("contestId") ?? "");
  const c = await db.contest.findFirst({ where: { id: contestId, status: "PUBLISHED" }, select: { slug: true } });
  if (!c) return;
  await getOrStartEntry(user.id, contestId);
  revalidatePath(`/contests/${c.slug}`);
}

// Self-reported for EXTERNAL problems that belong to this contest. Internal problems are graded by checkOutput. Counts only while the entry's own timer is running.
export async function markSolvedInContest(form: FormData) {
  const user = await requireUser();
  const contestId = String(form.get("contestId") ?? ""), problemId = String(form.get("problemId") ?? "");
  const c = await db.contest.findFirst({ where: { id: contestId, status: "PUBLISHED" }, select: { durationMin: true, slug: true } });
  if (!c) return;
  const state = await contestState(contestId, c.durationMin, user.id);
  if (!state.started || !state.running) return;
  // kind and status come from the database, never from the form.
  const cp = await db.contestProblem.findUnique({ where: { contestId_problemId: { contestId, problemId } }, select: { problem: { select: { kind: true, status: true } } } });
  if (!cp || cp.problem.kind !== "EXTERNAL" || cp.problem.status !== "PUBLISHED") return;
  await awardContestSolve(state.entry.id, user.id, problemId, "SELF_REPORTED");
  revalidatePath(`/contests/${c.slug}`);
}
