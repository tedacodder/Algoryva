"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, currentDevice, destroySession, knownDevices, requireUser } from "@/lib/auth/session";
import { classifyDevice } from "@/lib/auth/device";
import { sendNewSignInEmail } from "@/lib/auth/account-mail";
import { completeReview, completeTopic } from "@/lib/progress";
import { HOUR, anyBlocked, recordAll, trustedClientIp, type Limit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/auth/account-mail";
import { parseLogin, parseRegister } from "@/lib/auth/validation";

export type FormState = { error?: string } | undefined;

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseRegister(form);
  if (!parsed.ok) return { error: parsed.error };
  const { email, username, password } = parsed.value;
  // Per-email limit always applies. A per-IP limit is added only when a trusted proxy IP is available.
  const ip = await trustedClientIp();
  const limits: Limit[] = [{ key: `register-email:${email}`, max: 30, windowMs: HOUR }];
  if (ip) limits.push({ key: `register-ip:${ip}`, max: 30, windowMs: HOUR });
  if (await anyBlocked(limits)) return { error: "Too many sign-up attempts. Try again later." };
  await recordAll(limits.map((l) => l.key));
  const taken = await db.user.findFirst({ where: { OR: [{ email }, { username }] }, select: { id: true } });
  if (taken) return { error: "That email or username is already in use." };
  const user = await db.user.create({ data: { email, username, passwordHash: await hashPassword(password) } });
  const sent = await sendVerificationEmail(user.id, email);
  await createSession(user.id);
  // Show the "check your inbox" step. If the send failed, say so there, and offer a resend.
  redirect(sent ? "/check-email" : "/check-email?sent=0");
}

// Same message for unknown email and wrong password to avoid account enumeration.
export async function login(_: FormState, form: FormData): Promise<FormState> {
  const parsed = parseLogin(form);
  if (!parsed.ok) return { error: parsed.error };
  // Per-email limit always applies. A per-IP limit is added only when a trusted proxy IP is available.
  const ip = await trustedClientIp();
  const limits: Limit[] = [{ key: `login-email:${parsed.value.email}`, max: 5, windowMs: 15 * 60_000 }];
  if (ip) limits.push({ key: `login-ip:${ip}`, max: 20, windowMs: 15 * 60_000 });
  if (await anyBlocked(limits)) return { error: "Too many failed attempts. Try again in 15 minutes." };
  const user = await db.user.findUnique({ where: { email: parsed.value.email } });
  if (!user) await hashPassword(parsed.value.password); // keep timing similar for unknown emails
  const ok = user && !user.suspended && (await verifyPassword(parsed.value.password, user.passwordHash));
  if (!user || !ok) { await recordAll(limits.map((l) => l.key)); return { error: "Invalid email or password." }; }
  const device = await currentDevice();
  const status = classifyDevice(await knownDevices(user.id), device);
  await createSession(user.id);
  // Warn the owner about a sign-in from a device this account has not used before. Failure to send never blocks login.
  if (status === "new") await sendNewSignInEmail(user.email, device);
  redirect("/learn");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function markComplete(form: FormData) {
  const user = await requireUser();
  await completeTopic(user.id, String(form.get("slug") ?? ""));
  revalidatePath("/dashboard");
  revalidatePath("/learn", "layout");
}

export async function reviewTopic(form: FormData) {
  const user = await requireUser();
  const rating = form.get("rating") === "good" ? "good" : "again";
  await completeReview(user.id, String(form.get("topicId") ?? ""), rating);
  revalidatePath("/dashboard");
}
