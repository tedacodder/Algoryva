"use server";
import { redirect } from "next/navigation";
import { requireUser, destroySession } from "@/lib/auth/session";
import { deleteAccount } from "@/lib/account/delete";
import { HOUR, isBlocked, record } from "@/lib/rate-limit";

export type DeleteState = { error?: string } | undefined;

/**
 * Signed-in account deletion for the website. It uses the same shared routine and the same `delete-account:{userId}` limit as
 * DELETE /api/v1/me. On success the account, its sessions and its data are gone and the cookie is cleared.
 */
export async function deleteMyAccount(_: DeleteState, form: FormData): Promise<DeleteState> {
  const user = await requireUser();
  if (form.get("confirm") !== "yes") return { error: "Tick the box to confirm that you understand this is permanent." };
  const password = String(form.get("password") ?? "");
  if (!password) return { error: "Enter your password." };
  const key = `delete-account:${user.id}`;
  if (await isBlocked(key, 5, HOUR)) return { error: "Too many attempts. Try again later." };
  await record(key); // every attempt counts, right or wrong
  const r = await deleteAccount(user.id, password);
  if (!r.ok) {
    if (r.reason === "invalid_password") return { error: "Your password is incorrect." };
    if (r.reason === "last_admin") return { error: "The last administrator account cannot be deleted. Make another account an administrator first." };
    return { error: "This account no longer exists." };
  }
  await destroySession(); // the session row is already gone with the account; this clears the cookie
  redirect("/delete-account?done=1");
}
