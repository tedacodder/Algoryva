"use client";
import { useActionState } from "react";
import { deleteMyAccount } from "@/app/delete-account/actions";
import { Icon } from "@/components/Icon";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteMyAccount, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Your password</span>
        <input name="password" type="password" required autoComplete="current-password" className="input h-11" />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input name="confirm" type="checkbox" value="yes" required className="mt-1 h-4 w-4" />
        <span>I understand that deleting my account is permanent and removes my progress, notes and mistakes.</span>
      </label>
      <p role="alert" className="field-error">{state?.error && <><Icon name="alert" size={16} className="mt-0.5 shrink-0" />{state.error}</>}</p>
      <button disabled={pending} className="btn btn-primary btn-lg w-full">{pending ? "Deleting" : "Delete my account permanently"}</button>
    </form>
  );
}
