"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { consumeToken } from "@/lib/auth/tokens";
import { sendPasswordChangedEmail, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/auth/account-mail";
import { normalizeEmail } from "@/lib/auth/validation";
import { HOUR, anyBlocked, isBlocked, record, recordAll, trustedClientIp, type Limit } from "@/lib/rate-limit";

export type AuthState = { error?: string; message?: string } | undefined;

// The same answer whether or not the account exists, so the form cannot be used to find accounts.
const RESET_SENT = "If that email has an account, a reset link is on its way.";

export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = normalizeEmail(String(form.get("email") ?? ""));
  // Nothing can match an empty address. Answer neutrally without writing a shared empty-string bucket.
  if (!email) return { message: RESET_SENT };
  // Per-email limit always applies. A per-IP limit is added only when a trusted proxy IP is available.
  const ip = await trustedClientIp();
  const limits: Limit[] = [{ key: `forgot-email:${email}`, max: 5, windowMs: HOUR }];
  if (ip) limits.push({ key: `forgot-ip:${ip}`, max: 5, windowMs: HOUR });
  if (await anyBlocked(limits)) return { error: "Too many requests. Try again later." };
  await recordAll(limits.map((l) => l.key));
  const user = await db.user.findUnique({ where: { email }, select: { id: true, suspended: true } });
  if (user && !user.suspended) await sendPasswordResetEmail(user.id, email);
  return { message: RESET_SENT };
}

export async function resetPassword(_: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 10 || password.length > 128) return { error: "Password must be 10-128 characters." };
  const userId = await consumeToken(String(form.get("token") ?? ""), "reset");
  if (!userId) return { error: "This reset link is invalid or has already been used. Request a new one." };
  const passwordHash = await hashPassword(password);
  await db.$transaction([db.user.update({ where: { id: userId }, data: { passwordHash } }), db.session.deleteMany({ where: { userId } })]);
  // Tell the owner about the change, so a reset they did not ask for is noticed.
  const account = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (account) await sendPasswordChangedEmail(account.email);
  redirect("/login?reset=1");
}

/** Runs when the user presses the confirm button on the verify page. Only this action consumes the link. */
export async function confirmEmail(_: AuthState, form: FormData): Promise<AuthState> {
  const raw = String(form.get("token") ?? "");
  if (String(form.get("kind")) === "change") {
    const userId = await consumeToken(raw, "change-email");
    const row = userId ? await db.user.findUnique({ where: { id: userId }, select: { pendingEmail: true } }) : null;
    if (!userId || !row?.pendingEmail) return { error: "This link is invalid or has expired. Start the change again from your account page." };
    try {
      await db.user.update({ where: { id: userId }, data: { email: row.pendingEmail, pendingEmail: null, emailVerifiedAt: new Date() } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return { error: "That email address is already in use. Choose another address from your account page." };
      throw e;
    }
    redirect("/verify-email?done=change");
  }
  const userId = await consumeToken(raw, "verify");
  if (!userId) return { error: "This link is invalid or has expired. Log in and request a new one from the check-email page." };
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  redirect("/verify-email?done=1");
}

/** Sends a fresh verification email to the signed-in user, and says exactly what happened. */
export async function resendVerification(): Promise<AuthState> {
  const user = await requireUser();
  const row = await db.user.findUnique({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true } });
  if (!row) return { error: "We could not find your account. Log in again." };
  if (row.emailVerifiedAt) return { message: "Your email address is already confirmed." };
  const key = `verify:${user.id}`;
  if (await isBlocked(key, 3, HOUR)) return { error: "You have requested several emails in the last hour. Wait a while, then try again. Check your spam folder too." };
  await record(key);
  const sent = await sendVerificationEmail(user.id, row.email);
  revalidatePath("/dashboard");
  return sent
    ? { message: "Sent. Check your inbox and spam folder. The link works for 24 hours." }
    : { error: "We could not send the email just now. Please try again in a few minutes." };
}
