import "server-only";
import { siteUrl } from "@/lib/brand";
import { createToken } from "@/lib/auth/tokens";
import { HOUR } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/mailer";
import { emailChangeNoticeEmail, emailChangeVerifyEmail, newSignInEmail, passwordChangedEmail, passwordResetEmail, verificationEmail } from "@/lib/email-templates";
import { maskEmail } from "@/lib/email-address";

/*
 * Each helper creates the link (where needed) and sends the message. They return true only when the provider accepted it,
 * so the caller can say "check your inbox" or "we could not send it" truthfully.
 */

export async function sendVerificationEmail(userId: string, email: string): Promise<boolean> {
  try {
    const token = await createToken(userId, "verify", 24 * HOUR);
    return await sendEmail(email, verificationEmail(siteUrl(), token));
  } catch (e) {
    console.error("[email] could not create the verification link:", (e as Error).message);
    return false;
  }
}

export async function sendPasswordResetEmail(userId: string, email: string): Promise<boolean> {
  try {
    const token = await createToken(userId, "reset", HOUR);
    return await sendEmail(email, passwordResetEmail(siteUrl(), token));
  } catch (e) {
    console.error("[email] could not create the reset link:", (e as Error).message);
    return false;
  }
}

export async function sendPasswordChangedEmail(email: string): Promise<boolean> {
  return sendEmail(email, passwordChangedEmail(siteUrl()));
}

/** Sends the confirmation link to the NEW address. The account keeps its old address until this link is used. */
export async function sendEmailChangeVerification(userId: string, newEmail: string): Promise<boolean> {
  try {
    const token = await createToken(userId, "change-email", 24 * HOUR);
    return await sendEmail(newEmail, emailChangeVerifyEmail(siteUrl(), token));
  } catch (e) {
    console.error("[email] could not create the email-change link:", (e as Error).message);
    return false;
  }
}

/** Tells the OLD address that a change was requested, so the owner can act if it was not them. The new address is masked. */
export async function sendEmailChangeNotice(oldEmail: string, newEmail: string): Promise<boolean> {
  return sendEmail(oldEmail, emailChangeNoticeEmail(siteUrl(), maskEmail(newEmail)));
}

export async function sendNewSignInEmail(email: string, device: string): Promise<boolean> {
  return sendEmail(email, newSignInEmail(siteUrl(), device, new Date().toUTCString()));
}
