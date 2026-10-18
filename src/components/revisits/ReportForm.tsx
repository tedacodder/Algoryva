"use client";
import { useActionState } from "react";
import type { ReportState } from "@/app/revisits/actions";
import { NOTE_MAX, NOTE_MIN } from "@/lib/revisit";

export function ReportForm({ id, action }: { id: string; action: (s: ReportState, f: FormData) => Promise<ReportState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="block">
        <span className="label">Explain the idea in your own words</span>
        <textarea name="note" required minLength={NOTE_MIN} maxLength={NOTE_MAX} rows={2} className="input" placeholder="Sort the intervals by end time, then keep each one that starts after the last kept end." />
      </label>
      {state?.error && <p role="alert" className="field-error">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-ok">{state.message}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? "Saving" : "I solved it again on my own"}</button>
    </form>
  );
}
