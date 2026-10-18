"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { NOTE_MAX, NOTE_MIN } from "@/lib/revisit";
import { selfReportRevisit } from "@/lib/revisit-store";

export type ReportState = { error?: string; message?: string } | undefined;

/** Passes a due OUTSIDE revisit by the learner's own report. Site problems cannot be passed this way. */
export async function reportOutsideRevisit(_: ReportState, form: FormData): Promise<ReportState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (!id) return { error: "Choose a revisit." };
  if (note.length < NOTE_MIN || note.length > NOTE_MAX) return { error: `Explain the idea in ${NOTE_MIN}-${NOTE_MAX} characters, in your own words.` };
  const updated = await selfReportRevisit(user.id, id, note, new Date());
  if (updated === 0) return { error: "This revisit is not due yet, or it has already been passed." };
  revalidatePath("/revisits");
  revalidatePath("/dashboard");
  return { message: "Marked as passed. This is recorded as your own report, not a verified solve." };
}
