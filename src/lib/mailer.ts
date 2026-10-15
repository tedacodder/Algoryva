import "server-only";
import { brevoBody } from "@/lib/email-address";
import type { Message } from "@/lib/email-templates";

/**
 * Sends one message through Resend (RESEND_API_KEY) or Brevo (BREVO_API_KEY), with EMAIL_FROM as the sender.
 * Returns true only when the provider accepted the message, so callers can tell the user the truth.
 * Without a provider, development prints the message to the console and counts it as sent. Production never prints it,
 * because the message contains live links; it logs a configuration error and returns false.
 */
export async function sendEmail(to: string, msg: Message): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY, brevoKey = process.env.BREVO_API_KEY, from = process.env.EMAIL_FROM;
  if (!from || (!resendKey && !brevoKey)) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[email not sent: no provider configured]\nTo: ${to}\nSubject: ${msg.subject}\n${msg.text}\n`);
      return true;
    }
    console.error("[email] not sent: EMAIL_FROM and BREVO_API_KEY (or RESEND_API_KEY) must be set in production.");
    return false;
  }
  try {
    const res = resendKey
      ? await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to, subject: msg.subject, text: msg.text, html: msg.html }),
        })
      : await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey!, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(brevoBody({ from, to, subject: msg.subject, text: msg.text, html: msg.html })),
        });
    if (res.ok) return true;
    // The provider's error body names the problem (for example an unverified sender); it never contains our API key.
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    console.error(`[email] provider rejected the message (HTTP ${res.status}): ${detail}`);
    return false;
  } catch (e) {
    console.error("[email] send failed:", (e as Error).message);
    return false;
  }
}
