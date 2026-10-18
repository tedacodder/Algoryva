"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeEmail } from "@/lib/auth/validation";
import { sendEmailChangeNotice, sendEmailChangeVerification } from "@/lib/auth/account-mail";
import { maskEmail } from "@/lib/email-address";
import { setRevisitEmails as saveRevisitEmails } from "@/lib/revisit-store";
import { HOUR, isBlocked, record } from "@/lib/rate-limit";
import type { AuthState } from "@/app/auth-actions";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Starts an email change. Nothing changes yet: the new address gets a confirmation link, and the current address gets a
 * security notice. The password is required, and the attempt is rate-limited, so the form cannot be used to guess it.
 */
export async function requestEmailChange(_: AuthState, form: FormData): Promise<AuthState> {
  const user = await requireUser();
  const next = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!next || next.length > 254 || !EMAIL_SHAPE.test(next)) return { error: "Enter a valid email address." };
  const row = await db.user.findUnique({ where: { id: user.id }, select: { email: true, passwordHash: true } });
  if (!row) return { error: "We could not find your account. Log in again." };
  if (next === row.email) return { error: "That is already your email address." };
  const key = `email-change:${user.id}`;
  if (await isBlocked(key, 5, HOUR)) return { error: "Too many change requests. Try again in an hour." };
  await record(key);
  if (!(await verifyPassword(password, row.passwordHash))) return { error: "Your password is incorrect." };
  if (await db.user.findUnique({ where: { email: next }, select: { id: true } })) return { error: "That email address is already in use." };
  await db.user.update({ where: { id: user.id }, data: { pendingEmail: next } });
  const sent = await sendEmailChangeVerification(user.id, next);
  if (sent) await sendEmailChangeNotice(row.email, next);
  revalidatePath("/account");
  return sent
    ? { message: `We sent a confirmation link to ${maskEmail(next)}. Your address changes once you confirm it.` }
    : { error: "We could not send the confirmation email. Please try again in a few minutes." };
}

/** Drops a pending change. Any confirmation link already sent stops working, because the pending address is gone. */
export async function cancelEmailChange(): Promise<void> {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { pendingEmail: null } });
  revalidatePath("/account");
}

/** Turns the daily revisit reminder email on or off. */
export async function setRevisitEmails(form: FormData): Promise<void> {
  const user = await requireUser();
  await saveRevisitEmails(user.id, form.get("on") === "on");
  revalidatePath("/account");
}
