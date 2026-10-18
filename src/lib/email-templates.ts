import { BRAND } from "@/lib/brand";

export type Message = { subject: string; text: string; html: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Spec = {
  base: string;
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote: string;
};

/**
 * One layout for every Algoryva email: logo, heading, body, an optional button with a plain link under it, and a footnote.
 * The HTML and plain-text versions are built from the same text, so they always say the same thing.
 * The logo image needs a public https address, so it is used only when SITE_URL is https; otherwise the wordmark is text.
 */
export function renderEmail(s: Spec): Message {
  const logo = s.base.startsWith("https://")
    ? `<img src="${esc(s.base)}/brand/algoryva-lockup-email.png" width="180" alt="${esc(BRAND.name)}" style="display:block;border:0;height:auto">`
    : `<span style="font:800 24px/1 Helvetica,Arial,sans-serif;color:#1C2433">${esc(BRAND.name)}</span>`;
  const paragraphs = s.paragraphs.map((p) => `<p style="margin:0 0 12px">${esc(p)}</p>`).join("");
  const button = s.cta
    ? `<tr><td style="padding:8px 28px 4px"><a href="${esc(s.cta.url)}" style="display:inline-block;background:#3A59E0;color:#ffffff;padding:12px 22px;border-radius:10px;font:700 15px/1 Helvetica,Arial,sans-serif;text-decoration:none">${esc(s.cta.label)}</a></td></tr>
<tr><td style="padding:12px 28px 0;font:13px/1.5 Helvetica,Arial,sans-serif;color:#5B6676">Button not working? Copy this link into your browser:<br><a href="${esc(s.cta.url)}" style="color:#3A59E0;word-break:break-all">${esc(s.cta.url)}</a></td></tr>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F4FAFA">
<span style="display:none;max-height:0;overflow:hidden">${esc(s.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #DAE3EA;border-radius:12px">
<tr><td style="padding:24px 28px 8px">${logo}</td></tr>
<tr><td style="padding:12px 28px 4px;font:700 22px/1.3 Helvetica,Arial,sans-serif;color:#1C2433">${esc(s.heading)}</td></tr>
<tr><td style="padding:8px 28px;font:15px/1.6 Helvetica,Arial,sans-serif;color:#1C2433">${paragraphs}</td></tr>
${button}
<tr><td style="padding:20px 28px 24px;font:12px/1.5 Helvetica,Arial,sans-serif;color:#5B6676;border-top:1px solid #DAE3EA">${esc(s.footnote)}<br>${esc(BRAND.name)}</td></tr>
</table></body></html>`;
  const text = [s.heading, "", ...s.paragraphs.flatMap((p) => [p, ""]), ...(s.cta ? [`${s.cta.label}: ${s.cta.url}`, ""] : []), s.footnote, "", BRAND.name].join("\n");
  return { subject: s.subject, text, html };
}

export function verificationEmail(base: string, token: string): Message {
  return renderEmail({
    base,
    subject: "Confirm your Algoryva email address",
    preheader: "Confirm your email to finish setting up your account.",
    heading: "Confirm your email address",
    paragraphs: ["Welcome to Algoryva. Confirm this address so we can keep your account secure and help you recover it if you ever forget your password."],
    cta: { label: "Confirm email address", url: `${base}/verify-email?token=${token}` },
    footnote: "This link works for 24 hours and can be used once. If you did not create an Algoryva account, you can ignore this email.",
  });
}

export function passwordResetEmail(base: string, token: string): Message {
  return renderEmail({
    base,
    subject: "Reset your Algoryva password",
    preheader: "Choose a new password for your Algoryva account.",
    heading: "Reset your password",
    paragraphs: ["We received a request to reset the password for your Algoryva account."],
    cta: { label: "Choose a new password", url: `${base}/reset-password?token=${token}` },
    footnote: "This link works for one hour and can be used once. If you did not ask for a reset, ignore this email. Your password will not change.",
  });
}

export function passwordChangedEmail(base: string): Message {
  return renderEmail({
    base,
    subject: "Your Algoryva password was changed",
    preheader: "The password for your Algoryva account was just changed.",
    heading: "Your password was changed",
    paragraphs: ["The password for your Algoryva account was just changed.", "If this was you, no action is needed. If it was not, reset your password right away."],
    cta: { label: "Reset my password", url: `${base}/forgot-password` },
    footnote: "You are receiving this security notice because of a change to your account.",
  });
}

export function emailChangeVerifyEmail(base: string, token: string): Message {
  return renderEmail({
    base,
    subject: "Confirm your new Algoryva email address",
    preheader: "Confirm this address to finish changing your Algoryva email.",
    heading: "Confirm your new email address",
    paragraphs: ["You asked to use this address for your Algoryva account. Confirm it to make the change."],
    cta: { label: "Confirm new email address", url: `${base}/verify-email?token=${token}&kind=change` },
    footnote: "This link works for 24 hours and can be used once. If you did not ask for this, ignore this email and your address will not change.",
  });
}

export function emailChangeNoticeEmail(base: string, maskedNewEmail: string): Message {
  return renderEmail({
    base,
    subject: "An email change was requested on your Algoryva account",
    preheader: "Someone asked to change the email on your account.",
    heading: "An email change was requested",
    paragraphs: [
      `Someone asked to change the email address on your Algoryva account to ${maskedNewEmail}. Your address will not change until that new address is confirmed.`,
      "If this was not you, reset your password now so nobody else can use your account.",
    ],
    cta: { label: "Reset my password", url: `${base}/forgot-password` },
    footnote: "You are receiving this security notice because of a change to your account.",
  });
}

export function newSignInEmail(base: string, device: string, when: string): Message {
  return renderEmail({
    base,
    subject: "New sign-in to your Algoryva account",
    preheader: `A sign-in from ${device} was just made to your account.`,
    heading: "New sign-in to your account",
    paragraphs: [`Your account was signed in from ${device} on ${when}.`, "If this was you, no action is needed. If it was not, reset your password right away."],
    cta: { label: "Reset my password", url: `${base}/forgot-password` },
    footnote: "You are receiving this because this device has not signed in to your account before.",
  });
}

export function revisitDigestEmail(base: string, titles: string[], more: number): Message {
  const total = titles.length + more;
  const count = total === 1 ? "1 problem" : `${total} problems`;
  const lines = titles.map((t) => `• ${t}`);
  if (more > 0) lines.push(`…and ${more} more`);
  return renderEmail({
    base,
    subject: `${count} to solve again without help`,
    preheader: "Solve them on your own. They count as passed once you do.",
    heading: "Time to try these again",
    paragraphs: ["You solved these after looking at the editorial or a hint. Solve them again on your own to pass the review.", ...lines],
    cta: { label: "Open my revisits", url: `${base}/revisits` },
    footnote: "You are receiving this because problems are due for review. You can turn these emails off in Account settings.",
  });
}
