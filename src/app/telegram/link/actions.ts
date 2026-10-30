"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { confirmLink, unlinkForUser, type ConfirmReason } from "@/lib/telegram/link";

/** A message for the person, never an id or an internal reason code. */
export type LinkState = { ok: boolean; message: string } | undefined;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const MESSAGES: Record<ConfirmReason, string> = {
  invalid_or_expired: "This link has expired or was already used. Ask the bot for a new one.",
  account_has_other_telegram: "Your Algoryva account is already linked to a different Telegram account. Disconnect it below first, or send /unlink in that chat.",
  telegram_in_use: "That Telegram account is linked to a different Algoryva account.",
};

/** Confirms the link for the signed-in account. The token arrives as a form field, never in a URL. */
export async function confirmTelegramLink(_prev: LinkState, form: FormData): Promise<LinkState> {
  const user = await requireUser();
  const token = String(form.get("token") ?? "");
  if (!TOKEN_RE.test(token)) return { ok: false, message: MESSAGES.invalid_or_expired };
  const result = await confirmLink(token, user.id, new Date());
  revalidatePath("/telegram/link");
  if (!result.ok) return { ok: false, message: MESSAGES[result.reason] };
  return { ok: true, message: "Telegram is linked. Your bot commands now use this account." };
}

/** Disconnects Telegram from the signed-in account. The bot stops recognising the chat immediately. */
export async function unlinkTelegram(): Promise<LinkState> {
  const user = await requireUser();
  await unlinkForUser(user.id);
  revalidatePath("/telegram/link");
  return { ok: true, message: "Telegram is disconnected from this account." };
}
