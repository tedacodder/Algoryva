"use client";
import { useActionState } from "react";
import { createMistake } from "./actions";
import { MISTAKE_TYPES, REASONS } from "@/lib/mistake-validation";
import { Icon } from "@/components/Icon";

const label = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");
export function MistakeForm({ problems, defaultProblemId }: { problems: { id: string; title: string }[]; defaultProblemId?: string }) {
  const [state, action, pending] = useActionState(createMistake, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block"><span className="label">Problem (optional)</span><select name="problemId" defaultValue={defaultProblemId ?? ""} className="input"><option value="">None</option>{problems.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <p className="text-xs text-muted">A mistake on a problem comes back for a solve-again review tomorrow, whatever the reason.</p>
      <fieldset className="space-y-3 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-bold">Or a problem outside this site</legend>
        <p className="text-xs text-muted">Use this for LeetCode or any other problem that is not in the list above. Leave the list empty when you use it.</p>
        <label className="block"><span className="label">Title</span><input name="outsideTitle" maxLength={120} className="input" placeholder="Two Sum" /></label>
        <label className="block"><span className="label">Link (optional, https only)</span><input name="outsideUrl" type="url" maxLength={300} className="input" placeholder="https://leetcode.com/problems/two-sum" /></label>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Mistake type</span><select name="type" required className="input">{MISTAKE_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
        <label className="block"><span className="label">What happened (optional)</span><select name="reason" className="input"><option value="">Not sure</option>{REASONS.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
      </div>
      <label className="block"><span className="label">What I misunderstood</span><textarea name="misunderstood" required rows={2} className="input" placeholder="I assumed the array was already sorted." /></label>
      <label className="block"><span className="label">The correct idea</span><textarea name="correctIdea" required rows={2} className="input" placeholder="Binary search needs sorted input, so sort first or use a different approach." /></label>
      <label className="block"><span className="label">What I should recognize next time</span><textarea name="recognizeNextTime" required rows={2} className="input" placeholder="Any problem that says 'find the first index where...' on ordered data." /></label>
      <p role="alert" className="field-error">{state?.error && <><Icon name="alert" size={16} className="mt-0.5 shrink-0" />{state.error}</>}</p>
      <button disabled={pending} className="btn btn-primary">{pending ? "Saving" : "Save mistake"}</button>
    </form>
  );
}
